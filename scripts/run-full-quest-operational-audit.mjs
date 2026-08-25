const originalFetch = globalThis.fetch;
const CHUNK_EXPORT_URL = 'https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/refs/heads/gh-pages/chunkpicker-chunkinfo-export.json';

globalThis.fetch = async (input, init) => {
  const requestedUrl = typeof input === 'string' ? input : input?.url || '';
  if (!requestedUrl.includes('tasksMap.json')) return originalFetch(input, init);

  const response = await originalFetch(CHUNK_EXPORT_URL, init);
  if (!response.ok) {
    throw new Error(`Chunk Picker export failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  const mergedQuestTasks = {};
  const contributingPaths = new Map();
  const stack = [{ value: data, path: [] }];

  while (stack.length) {
    const { value, path } = stack.pop();
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    if (typeof value.BaseQuest === 'string' && path.length) {
      const taskKey = String(path.at(-1));
      if (!Object.hasOwn(mergedQuestTasks, taskKey)) mergedQuestTasks[taskKey] = value;
      const parentPath = path.slice(0, -1).join('.') || '(root)';
      contributingPaths.set(parentPath, (contributingPaths.get(parentPath) || 0) + 1);
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') stack.push({ value: child, path: [...path, key] });
    }
  }

  data.challenges = {
    ...(data.challenges || {}),
    Quest: mergedQuestTasks,
  };

  const pathSummary = [...contributingPaths.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([path, count]) => `${path}:${count}`)
    .join(', ');
  console.log(`Normalised ${Object.keys(mergedQuestTasks).length} Chunk Picker quest tasks from ${pathSummary}`);

  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

await import('./full-quest-operational-audit.mjs');
