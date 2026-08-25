import fs from 'node:fs';
import path from 'node:path';

const originalFetch = globalThis.fetch;
const CHUNK_EXPORT_URL = 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/refs/heads/gh-pages/chunkpicker-chunkinfo-export.json';
let sourceTaskGroups = {};

globalThis.fetch = async (input, init) => {
  const requestedUrl = typeof input === 'string' ? input : input?.url || '';
  if (!requestedUrl.includes('tasksMap.json')) return originalFetch(input, init);

  const response = await originalFetch(CHUNK_EXPORT_URL, init);
  if (!response.ok) throw new Error(`Chunk Picker export failed: ${response.status} ${response.statusText}`);

  const text = await response.text();
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  const mergedQuestTasks = {};
  const contributingPaths = new Map();
  const stack = [{ value: data, path: [] }];

  while (stack.length) {
    const { value, path: sourcePath } = stack.pop();
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    if (typeof value.BaseQuest === 'string' && sourcePath.length) {
      const taskKey = String(sourcePath.at(-1));
      if (!Object.hasOwn(mergedQuestTasks, taskKey)) mergedQuestTasks[taskKey] = value;
      const parentPath = sourcePath.slice(0, -1).join('.') || '(root)';
      contributingPaths.set(parentPath, (contributingPaths.get(parentPath) || 0) + 1);
      if (!sourceTaskGroups[value.BaseQuest]) sourceTaskGroups[value.BaseQuest] = [];
      sourceTaskGroups[value.BaseQuest].push({ taskKey, sourcePath: sourcePath.join('.'), ...value });
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') stack.push({ value: child, path: [...sourcePath, key] });
    }
  }

  for (const tasks of Object.values(sourceTaskGroups)) {
    tasks.sort((left, right) => left.taskKey.localeCompare(right.taskKey));
  }

  data.challenges = { ...(data.challenges || {}), Quest: mergedQuestTasks };
  const pathSummary = [...contributingPaths.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([sourcePath, count]) => `${sourcePath}:${count}`)
    .join(', ');
  console.log(`Normalised ${Object.keys(mergedQuestTasks).length} Chunk Picker quest tasks from ${pathSummary}`);

  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

await import('./full-quest-operational-audit.mjs');

const outputDirectory = path.join(process.cwd(), 'audit-output');
fs.writeFileSync(
  path.join(outputDirectory, 'chunk-picker-quest-tasks.json'),
  JSON.stringify({
    schemaVersion: 1,
    source: CHUNK_EXPORT_URL,
    baseQuestCount: Object.keys(sourceTaskGroups).length,
    taskCount: Object.values(sourceTaskGroups).reduce((total, tasks) => total + tasks.length, 0),
    quests: Object.fromEntries(Object.entries(sourceTaskGroups).sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2),
);
