/**
 * Error reports from the web app (POST /e): a short summary of an uncaught
 * error, forwarded to the owner's Discord channel through the
 * ERROR_WEBHOOK_URL Worker secret, or only logged when it is unset. Nothing is
 * stored: a report costs no KV read or write.
 */

export const MAX_ERROR_BYTES = 8 * 1024;
/** The same message from the same build is forwarded once in this window, per Worker isolate. */
export const ERROR_DEDUPE_MS = 10 * 60 * 1000;
const DEDUPE_CAPACITY = 500;
const WEBHOOK_TIMEOUT_MS = 5000;
/** Discord refuses a message over 2,000 characters. */
const MAX_CONTENT_CHARS = 1900;
/** Discord's flag for a message without link previews. */
const SUPPRESS_EMBEDS = 1 << 2;
const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

const LIMITS = { build: 64, kind: 64, message: 1000, stack: 4000, path: 300 };

/** One line or block of text from a report: control characters dropped, code fences broken, cut to `max`. */
function clean(value, max, multiline = false) {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ')
    .replace(/`{3,}/g, "'''")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The report in a request body, with each field cleaned and cut, or null when it isn't one. */
export function errorReport(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const report = {
    build: clean(body.build, LIMITS.build) || 'unknown',
    kind: clean(body.kind, LIMITS.kind) || 'error',
    message: clean(body.message, LIMITS.message),
    stack: clean(body.stack, LIMITS.stack, true),
    path: clean(body.path, LIMITS.path),
  };
  return report.message || report.stack ? report : null;
}

const recent = new Map();

/**
 * Whether this message from this build hasn't been forwarded in the last
 * ERROR_DEDUPE_MS by this isolate. Remembers it when it hasn't.
 */
export function firstInWindow(report, now = Date.now()) {
  const key = `${report.build}\n${report.message}`;
  const until = recent.get(key);
  if (until !== undefined && until > now) return false;
  if (recent.size >= DEDUPE_CAPACITY) {
    for (const [seen, expires] of recent) {
      if (expires <= now) recent.delete(seen);
    }
    // Still full of live entries: forget the oldest.
    if (recent.size >= DEDUPE_CAPACITY) recent.delete(recent.keys().next().value);
  }
  recent.delete(key);
  recent.set(key, now + ERROR_DEDUPE_MS);
  return true;
}

/** Forget every remembered report (tests). */
export function resetErrorDedupe() {
  recent.clear();
}

/** The report as a short Discord message: a heading line, then the message and stack as literal text. */
export function errorSummary(report) {
  const heading = `Fate Locked ${report.kind} · build ${report.build}${report.path ? ` · ${report.path}` : ''}`;
  const room = MAX_CONTENT_CHARS - heading.length - '\n```\n\n```'.length;
  let detail = [report.message, report.stack].filter(Boolean).join('\n');
  if (detail.length > room) detail = `${detail.slice(0, Math.max(0, room - 1))}…`;
  return `${heading}\n\`\`\`\n${detail}\n\`\`\``;
}

/** Log a report, and post it to the owner's webhook when ERROR_WEBHOOK_URL is a Discord webhook. Never throws. */
export async function forwardError(env, report) {
  const summary = errorSummary(report);
  console.error('client error', summary);
  const url = env.ERROR_WEBHOOK_URL;
  if (typeof url !== 'string' || !WEBHOOK_RE.test(url.trim())) return;
  try {
    await fetch(url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: summary, allowed_mentions: { parse: [] }, flags: SUPPRESS_EMBEDS }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('error webhook failed', error?.name ?? 'error');
  }
}
