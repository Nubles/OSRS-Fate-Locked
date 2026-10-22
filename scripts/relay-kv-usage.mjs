// How much of the Cloudflare free plan's daily KV quota the relay has used
// today, and an alert when it nears the limit (.github/workflows/relay-kv-usage.yml).
//
// The free plan gives the whole account 1,000 KV writes, 1,000 deletes and
// 1,000 lists a day, reset at 00:00 UTC; past them every write fails until
// midnight, for every player (docs/online-relay.md, "Daily KV quota"). The
// Worker can't see account-wide usage, so this asks Cloudflare's GraphQL
// Analytics API (kvOperationsAdaptiveGroups) with a read-only token.
//
// Environment:
//   CLOUDFLARE_ANALYTICS_TOKEN  an API token with Account Analytics: Read.
//                               Without it this does nothing and succeeds.
//   CLOUDFLARE_ACCOUNT_ID       optional; found with the token when unset.
//   RELAY_ALERT_DISCORD_WEBHOOK optional Discord webhook, posted once a day
//                               when the alert fires.
//   KV_ALERT_PERCENT            optional, default 80.
//   GITHUB_TOKEN, GITHUB_REPOSITORY  for the alert issue (set by Actions).
//   GITHUB_STEP_SUMMARY         where the usage table goes (set by Actions).
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The free plan's daily KV limits, per account. */
export const FREE_DAILY_LIMITS = { write: 1000, delete: 1000, list: 1000 };
export const DEFAULT_ALERT_PERCENT = 80;
/** The alert issue is found by this title; one stays open until closed by hand. */
export const ALERT_ISSUE_TITLE = 'Relay is near the free plan\'s daily KV limit';
const ISSUE_MARKER = '<!-- relay-kv-usage -->';
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const DISCORD_WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

export const KV_USAGE_QUERY = `query RelayKvUsage($accountTag: string!, $date: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      kvOperationsAdaptiveGroups(filter: { date_geq: $date, date_leq: $date }, limit: 100) {
        sum { requests }
        dimensions { actionType }
      }
    }
  }
}`;

/** The UTC day KV's daily limits count, as YYYY-MM-DD. */
export const utcDay = (now) => new Date(now).toISOString().slice(0, 10);

/** Today's operations by type from a GraphQL response, e.g. { read: 812, write: 140 }; throws on an error reply. */
export function operationsByType(body) {
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    throw new Error(`Cloudflare analytics refused the query: ${body.errors.map((error) => error?.message).join('; ')}`);
  }
  const accounts = body?.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('Cloudflare analytics returned no account: check the account id and the token\'s Account Analytics permission.');
  }
  const totals = {};
  for (const group of accounts[0].kvOperationsAdaptiveGroups ?? []) {
    const type = group?.dimensions?.actionType;
    const requests = Number(group?.sum?.requests);
    if (typeof type !== 'string' || !Number.isFinite(requests)) continue;
    totals[type] = (totals[type] ?? 0) + requests;
  }
  return totals;
}

/** Each limited operation's use today against its limit, and which are at or past the alert level. */
export function quotaUse(totals, percent = DEFAULT_ALERT_PERCENT) {
  const rows = Object.entries(FREE_DAILY_LIMITS).map(([type, limit]) => {
    const used = totals[type] ?? 0;
    return { type, used, limit, percent: Math.round((used / limit) * 100), alert: used >= (limit * percent) / 100 };
  });
  return { rows, alert: rows.some((row) => row.alert), reads: totals.read ?? 0 };
}

/** A Markdown table of today's use, for the job summary and the alert. */
export function usageTable(use, day) {
  const lines = [
    `KV operations on ${day} (UTC), whole Cloudflare account:`,
    '',
    '| Operation | Used today | Free daily limit | Used |',
    '| --- | ---: | ---: | ---: |',
    ...use.rows.map((row) => `| ${row.type}s | ${row.used} | ${row.limit} | ${row.percent}%${row.alert ? ' ⚠️' : ''} |`),
    `| reads | ${use.reads} | 100000 | ${Math.round((use.reads / 100000) * 100)}% |`,
  ];
  return lines.join('\n');
}

/** The text of the alert: what is happening, what it means for players, and what to do. */
export function alertText(use, day, percent = DEFAULT_ALERT_PERCENT) {
  return [
    `The relay has used at least ${percent}% of one of the Cloudflare free plan's daily KV limits today (${day}, UTC).`,
    '',
    usageTable(use, day),
    '',
    'At 100%, every relay write fails until 00:00 UTC: RuneLite stops getting new rules, online backups stop,',
    'and shared progress stops reaching Discord. Nothing is lost; it all resumes at midnight UTC.',
    '',
    'What to do: see docs/online-relay.md, "Daily KV quota". If this happens often, Workers Paid',
    '($5 a month) raises the limit to a million writes a day.',
  ].join('\n');
}

const jsonOrNull = async (response) => {
  try { return await response.json(); } catch { return null; }
};

/** The account the token can read, when exactly one. */
export async function discoverAccountId(token, fetchFn = fetch) {
  const response = await fetchFn(`${CLOUDFLARE_API}/accounts?per_page=5`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await jsonOrNull(response);
  const accounts = Array.isArray(body?.result) ? body.result : [];
  if (!response.ok || accounts.length !== 1 || typeof accounts[0]?.id !== 'string') {
    throw new Error('Couldn\'t tell which Cloudflare account to check: add the CLOUDFLARE_ACCOUNT_ID secret (docs/online-relay.md, "Daily KV quota").');
  }
  return accounts[0].id;
}

export async function fetchOperations(token, accountId, day, fetchFn = fetch) {
  const response = await fetchFn(`${CLOUDFLARE_API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: KV_USAGE_QUERY, variables: { accountTag: accountId, date: day } }),
  });
  const body = await jsonOrNull(response);
  if (!response.ok && !body?.errors) throw new Error(`Cloudflare analytics answered ${response.status}.`);
  return operationsByType(body);
}

/**
 * Open the alert issue, or comment on the open one, at most once a UTC day.
 * Returns 'opened', 'commented' or 'already' (today's alert is posted).
 */
export async function raiseIssue({ repository, token, day, text }, fetchFn = fetch) {
  const api = `https://api.github.com/repos/${repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const dayMarker = `<!-- relay-kv-usage ${day} -->`;
  const listed = await fetchFn(`${api}/issues?state=open&per_page=100`, { headers });
  if (!listed.ok) throw new Error(`GitHub issues answered ${listed.status}.`);
  const open = ((await jsonOrNull(listed)) ?? [])
    .find((issue) => !issue.pull_request && issue.title === ALERT_ISSUE_TITLE && String(issue.body ?? '').includes(ISSUE_MARKER));
  if (!open) {
    const created = await fetchFn(`${api}/issues`, {
      method: 'POST', headers, body: JSON.stringify({ title: ALERT_ISSUE_TITLE, body: `${ISSUE_MARKER}\n${dayMarker}\n${text}` }),
    });
    if (!created.ok) throw new Error(`Opening the alert issue failed: ${created.status}.`);
    return 'opened';
  }
  if (String(open.body ?? '').includes(dayMarker)) return 'already';
  const comments = await fetchFn(`${api}/issues/${open.number}/comments?per_page=100`, { headers });
  if (!comments.ok) throw new Error(`GitHub comments answered ${comments.status}.`);
  if (((await jsonOrNull(comments)) ?? []).some((comment) => String(comment.body ?? '').includes(dayMarker))) return 'already';
  const commented = await fetchFn(`${api}/issues/${open.number}/comments`, {
    method: 'POST', headers, body: JSON.stringify({ body: `${dayMarker}\n${text}` }),
  });
  if (!commented.ok) throw new Error(`Commenting on the alert issue failed: ${commented.status}.`);
  return 'commented';
}

/** Post the alert to a Discord webhook, when one is set. Never throws. */
export async function postDiscord(webhook, text, fetchFn = fetch) {
  const url = webhook?.trim();
  if (!url || !DISCORD_WEBHOOK_RE.test(url)) return false;
  try {
    const content = text.length > 1900 ? `${text.slice(0, 1899)}…` : text;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] }, flags: 1 << 2 }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** One check: read today's use, write the summary, raise the alert once a day. Returns what it did. */
export async function run(env = process.env, fetchFn = fetch, now = Date.now(), log = console.log) {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN?.trim();
  if (!token) {
    log('::notice title=Relay KV usage not checked::Add the CLOUDFLARE_ANALYTICS_TOKEN repository secret to check the relay\'s daily KV use (docs/online-relay.md, "Daily KV quota").');
    return { checked: false };
  }
  const day = utcDay(now);
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() || await discoverAccountId(token, fetchFn);
  const percent = Number(env.KV_ALERT_PERCENT) > 0 ? Number(env.KV_ALERT_PERCENT) : DEFAULT_ALERT_PERCENT;
  const use = quotaUse(await fetchOperations(token, accountId, day, fetchFn), percent);
  const table = usageTable(use, day);
  log(table);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${table}\n`);
  if (!use.alert) return { checked: true, alert: false, use };

  const text = alertText(use, day, percent);
  log(`::warning title=Relay KV use is high::${use.rows.filter((row) => row.alert).map((row) => `${row.type}s ${row.used}/${row.limit}`).join(', ')} today (UTC).`);
  let issue = 'skipped';
  if (env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) {
    issue = await raiseIssue({ repository: env.GITHUB_REPOSITORY, token: env.GITHUB_TOKEN, day, text }, fetchFn);
  }
  // Discord hears once a day too: with the issue, or every run when there is no issue to remember it by.
  const discord = issue === 'already' ? false : await postDiscord(env.RELAY_ALERT_DISCORD_WEBHOOK, text, fetchFn);
  return { checked: true, alert: true, use, issue, discord };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    console.log(`::error title=Relay KV usage check failed::${error?.message ?? error}`);
    process.exitCode = 1;
  }
}
