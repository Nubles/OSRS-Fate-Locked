// Sends the newest What's New entries to the Discord bot after a Pages deploy
// (.github/workflows/discord-whats-new.yml). Run with
// `node --experimental-strip-types`, so it can read data/changelog.ts.
import { createHmac } from 'node:crypto';
import { CHANGELOG_RELEASES } from '../data/changelog.ts';
import { whatsNewEvent } from './whats-new-event.mjs';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const log = (status, response = {}) => {
  console.log(JSON.stringify({ type: 'whats_new', status, ...response }));
};

const safeResponse = (value) => {
  const response = record(value);
  return {
    ...(typeof response?.ok === 'boolean' ? { ok: response.ok } : {}),
    ...(typeof response?.duplicate === 'boolean' ? { duplicate: response.duplicate } : {}),
    ...(Number.isSafeInteger(response?.posted) ? { posted: response.posted } : {}),
  };
};

const required = (name) => process.env[name]?.trim() || null;

const main = async () => {
  const event = whatsNewEvent(CHANGELOG_RELEASES);
  if (event.releases.length === 0) {
    log(0, { skipped: 'no entries to announce' });
    return;
  }

  const endpoint = required('DISCORD_AUTOMATION_ENDPOINT');
  const hmac = required('DISCORD_AUTOMATION_HMAC');
  if (!endpoint || !hmac) {
    log(0);
    process.exitCode = 1;
    return;
  }

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
    log(0);
    process.exitCode = 1;
  }
};

await main();
