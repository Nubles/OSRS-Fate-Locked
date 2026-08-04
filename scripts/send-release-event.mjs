import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const safeResponse = (value) => {
  const response = record(value);
  return {
    ...(typeof response?.ok === 'boolean' ? { ok: response.ok } : {}),
    ...(typeof response?.duplicate === 'boolean' ? { duplicate: response.duplicate } : {}),
  };
};

const log = (status, response = {}) => {
  console.log(JSON.stringify({ type: 'release', status, ...response }));
};

const required = (name) => {
  const value = process.env[name]?.trim();
  return value || null;
};

const releaseEvent = (payload) => {
  const repository = record(payload)?.repository;
  const release = record(record(payload)?.release);
  const fullName = typeof repository?.full_name === 'string' ? repository.full_name : null;
  const tagName = typeof release?.tag_name === 'string' ? release.tag_name : null;
  const name = typeof release?.name === 'string' ? release.name : tagName;
  const url = typeof release?.html_url === 'string' ? release.html_url : null;
  const body = typeof release?.body === 'string' ? release.body : '';
  const publishedAt = typeof release?.published_at === 'string' ? release.published_at : null;

  if (
    !fullName ||
    typeof release?.id !== 'number' ||
    !Number.isSafeInteger(release.id) ||
    release.id <= 0 ||
    !tagName ||
    !name ||
    !url ||
    !publishedAt
  ) return null;

  return {
    type: 'release',
    repository: fullName,
    sentAt: new Date().toISOString(),
    release: { id: release.id, tagName, name, url, body, publishedAt },
  };
};

const fail = () => {
  log(0);
  process.exitCode = 1;
};

const main = async () => {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return fail();

  let payload;
  try {
    payload = JSON.parse(await readFile(eventPath, 'utf8'));
  } catch {
    return fail();
  }

  const event = releaseEvent(payload);
  const endpoint = required('DISCORD_AUTOMATION_ENDPOINT');
  const hmac = required('DISCORD_AUTOMATION_HMAC');
  if (!event || !endpoint || !hmac) return fail();

  const body = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v1=${createHmac('sha256', hmac).update(`${timestamp}.${body}`).digest('hex')}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-fate-timestamp': timestamp,
        'x-fate-signature': signature,
      },
      body,
    });
    let responseBody = null;
    try { responseBody = JSON.parse(await response.text()); } catch { /* Do not log response bodies. */ }
    log(response.status, safeResponse(responseBody));
    if (!response.ok) process.exitCode = 1;
  } catch {
    fail();
  }
};

await main();