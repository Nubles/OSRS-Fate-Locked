const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!url.includes('tasksMap.json')) return response;

  const text = await response.text();
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  const mergedQuestTasks = {};
  const contributingCategories = [];

  for (const [category, bucket] of Object.entries(data?.challenges || {})) {
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
    let matched = 0;
    for (const [taskKey, task] of Object.entries(bucket)) {
      if (!task || typeof task !== 'object' || !task.BaseQuest) continue;
      if (!Object.hasOwn(mergedQuestTasks, taskKey)) mergedQuestTasks[taskKey] = task;
      matched++;
    }
    if (matched) contributingCategories.push(`${category}:${matched}`);
  }

  data.challenges = {
    ...(data.challenges || {}),
    Quest: mergedQuestTasks,
  };

  console.log(
    `Normalised ${Object.keys(mergedQuestTasks).length} Chunk Picker quest tasks from ${contributingCategories.join(', ')}`,
  );

  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

await import('./full-quest-operational-audit.mjs');
