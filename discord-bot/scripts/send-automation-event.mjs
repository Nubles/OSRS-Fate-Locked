import { createHmac } from 'node:crypto';

const eventTypes = new Set(['register_commands', 'release', 'weekly_seed']);

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const safeResponse = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const response = {};
  if (typeof value.ok === 'boolean') response.ok = value.ok;
  if (typeof value.duplicate === 'boolean') response.duplicate = value.duplicate;
  if (typeof value.type === 'string' && eventTypes.has(value.type)) response.type = value.type;
  return response;
};

const log = (type, status, response) => {
  console.log(JSON.stringify({ type, status, response }));
};

const main = async () => {
  let event;
  try {
    event = JSON.parse(required('AUTOMATION_EVENT_JSON'));
  } catch {
    log('invalid', 0, {});
    process.exitCode = 1;
    return;
  }

  if (!event || typeof event !== 'object' || Array.isArray(event) || !eventTypes.has(event.type)) {
    log('invalid', 0, {});
    process.exitCode = 1;
    return;
  }

  if (!Object.hasOwn(event, 'sentAt')) event.sentAt = new Date().toISOString();

  let endpoint;
  let hmac;
  try {
    endpoint = required('DISCORD_AUTOMATION_ENDPOINT');
    hmac = required('DISCORD_AUTOMATION_HMAC');
  } catch {
    log(event.type, 0, {});
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
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* Only the safe JSON subset is logged. */ }
    log(event.type, response.status, safeResponse(parsed));
    if (!response.ok) process.exitCode = 1;
  } catch {
    log(event.type, 0, {});
    process.exitCode = 1;
  }
};

await main();
