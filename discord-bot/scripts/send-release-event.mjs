import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const safeFailure = () => {
  console.error(JSON.stringify({ type: 'release', status: 0, response: {} }));
  process.exitCode = 1;
};

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const main = async () => {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return safeFailure();

  let payload;
  try {
    payload = JSON.parse(await readFile(eventPath, 'utf8'));
  } catch {
    return safeFailure();
  }

  const repository = record(record(payload)?.repository)?.full_name;
  const release = record(record(payload)?.release);
  const tagName = release?.tag_name;
  const url = release?.html_url;
  const publishedAt = release?.published_at;
  if (
    typeof repository !== 'string' ||
    typeof release?.id !== 'number' ||
    !Number.isSafeInteger(release.id) ||
    typeof tagName !== 'string' ||
    typeof url !== 'string' ||
    typeof publishedAt !== 'string'
  ) return safeFailure();

  const event = {
    type: 'release',
    repository,
    sentAt: new Date().toISOString(),
    release: {
      id: release.id,
      tagName,
      name: typeof release.name === 'string' ? release.name : tagName,
      url,
      body: typeof release.body === 'string' ? release.body : '',
      publishedAt,
    },
  };
  const sender = fileURLToPath(new URL('./send-automation-event.mjs', import.meta.url));
  const child = spawn(process.execPath, [sender], {
    env: { ...process.env, AUTOMATION_EVENT_JSON: JSON.stringify(event) },
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => child.on('close', resolve));
  process.exitCode = typeof code === 'number' ? code : 1;
};

await main();
