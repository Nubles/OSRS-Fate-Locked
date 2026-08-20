import { createHash } from 'node:crypto';

export const PILOT_QUESTS = Object.freeze([
  "Cook's Assistant",
  "Daddy's Home",
  "Doric's Quest",
  'Elemental Workshop I',
]);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left === right ? 0 : left < right ? -1 : 1)
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  return value;
};

export const stableJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;

const canonicalJson = value => JSON.stringify(canonicalValue(value));

const sha256 = value => createHash('sha256').update(value).digest('hex');
export const sourceLineDigest = line => sha256(line.rawText);

const slug = value => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export function convertChunkPickerChunkId(sourceId) {
  if (typeof sourceId !== 'string' || !/^\d+(?:-\d+)?$/.test(sourceId)) {
    throw new Error(`Unknown Chunk Picker chunk ID shape: ${sourceId}`);
  }
  const regionId = Number(sourceId.split('-')[0]);
  if (!Number.isSafeInteger(regionId)) throw new Error(`Unknown Chunk Picker chunk ID shape: ${sourceId}`);
  return `${regionId >> 8},${regionId & 255}`;
}

const taskMapId = (tasksMap, sourceId) => {
  if (!isRecord(tasksMap)) return undefined;
  const direct = tasksMap[sourceId];
  if (typeof direct === 'string' || typeof direct === 'number') return String(direct);
  if (isRecord(direct)) {
    for (const field of ['id', 'taskId', 'taskID']) {
      if (typeof direct[field] === 'string' || typeof direct[field] === 'number') return String(direct[field]);
    }
  }
  for (const container of ['tasks', 'taskMap', 'tasksMap']) {
    if (isRecord(tasksMap[container])) {
      const nested = taskMapId(tasksMap[container], sourceId);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
};

export function extractPilotQuestTasks(chunkPicker, tasksMap = undefined) {
  const sourceTasks = chunkPicker?.challenges?.Quest;
  if (!isRecord(sourceTasks)) throw new Error('Chunk Picker export is missing challenges.Quest');

  const result = Object.fromEntries(PILOT_QUESTS.map(quest => [quest, []]));
  const selected = Object.entries(sourceTasks).filter(([, task]) => (
    isRecord(task) && PILOT_QUESTS.includes(task.BaseQuest)
  ));
  const resolvedIds = new Map(selected.map(([sourceId]) => [sourceId, taskMapId(tasksMap, sourceId) ?? sourceId]));

  for (const [sourceId, task] of selected) {
    const numericChunks = [];
    const namedAreas = [];
    for (const location of Array.isArray(task.Chunks) ? task.Chunks : []) {
      if (typeof location !== 'string') continue;
      if (/^\d+(?:-\d+)?$/.test(location)) {
        const [, , planeText] = location.match(/^(\d+)(?:-(\d+))?$/) ?? [];
        numericChunks.push({
          chunkId: convertChunkPickerChunkId(location),
          plane: planeText === undefined ? 0 : Number(planeText),
          sourceId: location,
        });
      } else {
        namedAreas.push(location);
      }
    }
    const dependencies = isRecord(task.Tasks) ? Object.keys(task.Tasks) : [];
    result[task.BaseQuest].push({
      id: resolvedIds.get(sourceId),
      sourceId,
      description: typeof task.Description === 'string' ? task.Description : undefined,
      dependsOn: dependencies.map(dependency => resolvedIds.get(dependency) ?? dependency),
      npcs: Array.isArray(task.NPCs) ? task.NPCs : [],
      objects: Array.isArray(task.Objects) ? task.Objects : [],
      items: Array.isArray(task.Items) ? task.Items : [],
      skills: isRecord(task.Skills) ? task.Skills : {},
      chunks: numericChunks,
      namedAreas,
      rewards: Array.isArray(task.Reward) ? task.Reward : [],
      questPoints: Number.isFinite(task.QuestPoints) ? task.QuestPoints : undefined,
      xpRewards: isRecord(task.XpReward) ? task.XpReward : {},
      completion: /(?:^|\s)Complete the quest$/i.test(sourceId),
    });
  }

  validateTaskGraph(result);
  return result;
}

const stripNonContent = value => value
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<span\b[^>]*class=["'][^"']*mw-editsection[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
  .trim();

const expandSimpleTemplates = (value) => {
  let expanded = value;
  let previous;
  do {
    previous = expanded;
    expanded = expanded.replace(/{{([^{}]+)}}/g, (_match, body) => {
      const [rawName, ...parts] = body.split('|');
      const name = rawName.trim().toLowerCase();
      const positional = parts.map(part => part.trim()).filter(part => part && !part.includes('='));
      if (name === 'gep') {
        const [item, quantity] = positional;
        return item ? (quantity ? quantity + ' ' : '') + item : '';
      }
      if (name === 'coins' || name === 'nocoins') return positional.join(' ');
      if (name === 'plink' || name === 'npc') return positional[0] ?? '';
      if (name === 'chat option') return positional.at(-1) ?? '';
      return positional.join(' ');
    });
  } while (expanded !== previous);
  return expanded;
};

const normalizeWikiText = value => expandSimpleTemplates(stripNonContent(value)
  .replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, '')
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  .replace(/\[\[([^\]]+)\]\]/g, '$1'))
  .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
  .replace(/'{2,5}/g, '')
  .replace(/[{}]+/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim();

export function extractQuickGuideLines(input) {
  if (!isRecord(input) || typeof input.questId !== 'string' || typeof input.wikitext !== 'string') {
    throw new Error('Quick-guide input requires questId and wikitext');
  }
  let section = 'Introduction';
  let includeSection = true;
  const parentByDepth = new Map();
  const result = [];

  for (const sourceLine of input.wikitext.split(/\r?\n/)) {
    const heading = /^={2,6}\s*(.*?)\s*={2,6}\s*$/.exec(sourceLine);
    if (heading) {
      section = normalizeWikiText(heading[1]) || section;
      includeSection = !/^(?:Rewards?|Required for completing|Trivia|Changes|References|External links|See also)$/i.test(section);
      parentByDepth.clear();
      continue;
    }
    if (!includeSection) continue;
    const listLine = /^([#*;:]+)\s*(.*)$/.exec(sourceLine);
    if (!listLine) continue;
    const depth = listLine[1].length;
    const rawText = stripNonContent(listLine[2]);
    const text = normalizeWikiText(rawText);
    if (!text || /^edit$/i.test(text)) continue;

    const sourceOrder = result.length + 1;
    const id = `${slug(input.questId)}-${slug(section)}-${sourceOrder}`;
    let parentLineId;
    if (depth > 1) {
      for (let parentDepth = depth - 1; parentDepth >= 1; parentDepth -= 1) {
        if (parentByDepth.has(parentDepth)) {
          parentLineId = parentByDepth.get(parentDepth);
          break;
        }
      }
    }
    const line = { id, section, sourceOrder, rawText, text };
    if (parentLineId) line.parentLineId = parentLineId;
    result.push(line);
    parentByDepth.set(depth, id);
    for (const childDepth of [...parentByDepth.keys()]) {
      if (childDepth > depth) parentByDepth.delete(childDepth);
    }
  }
  return result;
}

export function validateTaskGraph(graph) {
  const tasks = Array.isArray(graph)
    ? graph
    : Object.values(graph ?? {}).flatMap(value => Array.isArray(value) ? value : []);
  const ids = new Set();
  for (const task of tasks) {
    if (!isRecord(task) || typeof task.id !== 'string' || !task.id) throw new Error('Task graph contains an invalid task ID');
    if (ids.has(task.id)) throw new Error(`Task graph contains duplicate task ID: ${task.id}`);
    ids.add(task.id);
  }
  for (const task of tasks) {
    for (const dependency of Array.isArray(task.dependsOn) ? task.dependsOn : []) {
      if (!ids.has(dependency)) throw new Error(`Task ${task.id} has missing dependency ${dependency}`);
    }
  }
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`Task dependency cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of taskById.get(id).dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  return graph;
}

const reviewFor = (review, questId) => review?.quests?.[questId] ?? [];

const assertWalkthrough = (condition, message) => {
  if (!condition) throw new Error(message);
};

const nonBlankWalkthrough = (value, label) => {
  assertWalkthrough(typeof value === 'string' && value.trim(), `${label} must not be blank`);
};

const canonicalWalkthroughItemKey = value => value.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');

const validateWalkthroughItem = (value, label) => {
  assertWalkthrough(isRecord(value), `${label} must be an item requirement`);
  assertWalkthrough(isRecord(value.item), `${label} item is required`);
  nonBlankWalkthrough(value.item.key, `${label} item key`);
  nonBlankWalkthrough(value.item.name, `${label} item name`);
  assertWalkthrough(
    value.item.key === canonicalWalkthroughItemKey(value.item.name),
    `${label} item key must be canonical`,
  );
  assertWalkthrough(Number.isFinite(value.quantity) && value.quantity > 0, `${label} quantity must be positive`);
  assertWalkthrough(
    value.supplyPolicy === 'PLAYER_OBTAINED' || value.supplyPolicy === 'QUEST_PROVIDED',
    `${label} supply policy is invalid`,
  );
  return value.item.key;
};

const validateReviewedDirectSource = (action, method, fulfils, label) => {
  nonBlankWalkthrough(method.itemKey, `${label} direct source item key`);
  assertWalkthrough(
    method.itemKey === canonicalWalkthroughItemKey(method.itemKey),
    `${label} direct source item key must be canonical`,
  );
  nonBlankWalkthrough(method.sourceLabel, `${label} direct source label`);
  assertWalkthrough(
    fulfils.includes(method.itemKey),
    `${label} direct source item must be fulfilled by its action`,
  );
  assertWalkthrough(action.confidence === 'REVIEWED', `${label} direct source action must be reviewed`);
  assertWalkthrough(isRecord(action.location) && action.location.kind === 'REVIEWED_ALIAS', `${label} direct source requires reviewed location evidence`);
  nonBlankWalkthrough(action.location.alias, `${label} reviewed location alias`);
  assertWalkthrough(Array.isArray(action.location.chunks) && action.location.chunks.length > 0, `${label} reviewed location chunks are required`);
  action.location.chunks.forEach((chunk, index) => nonBlankWalkthrough(chunk, `${label} reviewed location chunk ${index + 1}`));
  nonBlankWalkthrough(action.location.reviewer, `${label} reviewed location reviewer`);
  nonBlankWalkthrough(action.location.reviewedAt, `${label} reviewed location date`);
  nonBlankWalkthrough(action.location.evidence, `${label} reviewed location evidence`);
  nonBlankWalkthrough(action.location.rationale, `${label} reviewed location rationale`);
};

const validateCoachMetadata = (action, questId) => {
  const label = `${questId}: coach metadata for ${action?.id ?? 'unknown action'}`;
  const coach = action.coach;
  assertWalkthrough(isRecord(coach), `${label} must be an object`);
  assertWalkthrough(Array.isArray(coach.fulfils), `${label} fulfils are required`);
  const fulfilKeys = coach.fulfils.map((item, index) => validateWalkthroughItem(item, `${label} fulfils ${index + 1}`));
  assertWalkthrough(
    coach.fallbackPolicy === 'BLOCK_THEN_ALTERNATIVES'
      || coach.fallbackPolicy === 'INTERCHANGEABLE'
      || coach.fallbackPolicy === 'NONE',
    `${label} fallback policy is invalid`,
  );
  assertWalkthrough(isRecord(coach.completion), `${label} completion is required`);
  const actionItemKeys = Array.isArray(action.items)
    ? action.items.map((item, index) => validateWalkthroughItem(item, `${label} action items ${index + 1}`))
    : (() => {
      throw new Error(`${label} action items are required`);
    })();
  const knownItemKeys = new Set([...actionItemKeys, ...fulfilKeys]);

  switch (coach.completion.kind) {
    case 'MANUAL':
      break;
    case 'ITEM_CONFIRMED':
      nonBlankWalkthrough(coach.completion.itemKey, `${label} completion item key`);
      assertWalkthrough(
        coach.completion.itemKey === canonicalWalkthroughItemKey(coach.completion.itemKey),
        `${label} completion item key must be canonical`,
      );
      assertWalkthrough(knownItemKeys.has(coach.completion.itemKey), `${label} completion item is not declared by the action`);
      break;
    case 'QUEST_COMPLETED':
      nonBlankWalkthrough(coach.completion.questId, `${label} completion quest ID`);
      break;
    default:
      throw new Error(`${label} completion kind is invalid`);
  }

  if (coach.preferredMethod === undefined) return;
  assertWalkthrough(isRecord(coach.preferredMethod), `${label} preferred method is invalid`);
  switch (coach.preferredMethod.kind) {
    case 'DIRECT_SOURCE':
      validateReviewedDirectSource(action, coach.preferredMethod, fulfilKeys, label);
      return;
    case 'TRANSFORMATION':
      nonBlankWalkthrough(coach.preferredMethod.recipeId, `${label} transformation recipe ID`);
      return;
    default:
      throw new Error(`${label} preferred method kind is invalid`);
  }
};

const validateCoachActions = (questId, actions) => {
  const hasCoachMetadata = actions.some(action => isRecord(action) && action.coach !== undefined);
  if (!hasCoachMetadata) return;

  validateTaskGraph(actions);
  actions.forEach((action) => {
    assertWalkthrough(isRecord(action), `${questId}: reviewed action is invalid`);
    if (action.coach === undefined) return;
    validateCoachMetadata(action, questId);
  });

  if (!actions.every(action => isRecord(action) && action.coach !== undefined)) return;
  let previousSourceOrder = 0;
  const actionsById = new Map();
  actions.forEach((action) => {
    nonBlankWalkthrough(action.id, `${questId}: strategy action ID`);
    assertWalkthrough(Number.isInteger(action.sourceOrder) && action.sourceOrder > previousSourceOrder, `${questId}: strategy source order is unstable`);
    actionsById.set(action.id, action);
    previousSourceOrder = action.sourceOrder;
  });
  actions.forEach((action) => {
    action.dependsOn.forEach((dependencyId) => {
      const dependency = actionsById.get(dependencyId);
      assertWalkthrough(
        dependency.sourceOrder < action.sourceOrder,
        `${questId}: strategy dependency must precede its action`,
      );
    });
  });
};

export function compileWalkthroughCatalogue(source, review) {
  if (source?.phase !== 'SOURCE_BOOTSTRAP' && source?.phase !== 'REVIEWED') {
    throw new Error('Walkthrough source phase must be SOURCE_BOOTSTRAP or REVIEWED');
  }
  const walkthroughs = (source.quests ?? []).map((quest) => {
    const sourceRecord = {
      wikiTitle: quest.wikiTitle,
      wikiRevision: String(quest.wikiRevision),
      wikiRevisionTimestamp: quest.wikiRevisionTimestamp,
      wikiUrl: quest.wikiUrl,
      wikiLicence: source.wiki.licence,
      wikiLicenceUrl: source.wiki.licenceUrl,
      chunkPickerRepository: source.chunkPicker.repository,
      chunkPickerCommit: source.chunkPicker.commit,
      chunkPickerLicenceStatus: source.chunkPicker.licenceStatus,
    };
    if (source.chunkPicker.permissionReference) {
      sourceRecord.permissionReference = source.chunkPicker.permissionReference;
    }
    const reviewedActions = source.phase === 'REVIEWED' ? reviewFor(review, quest.questId) : [];
    validateCoachActions(quest.questId, reviewedActions);
    const definition = {
      questId: quest.questId,
      releaseStatus: source.chunkPicker.licenceStatus === 'PERMISSION_RECORDED' && quest.releaseStatus === 'APPROVED'
        ? 'APPROVED'
        : 'PREVIEW_ONLY',
      source: sourceRecord,
      sourceLines: source.phase === 'REVIEWED'
        ? (quest.importedLines ?? []).map(({ id, section, sourceOrder, rawText }) => ({ id, section, sourceOrder, rawText }))
        : [],
      actions: reviewedActions,
    };
    const revision = sha256(canonicalJson(definition));
    return { questId: definition.questId, revision, ...Object.fromEntries(Object.entries(definition).slice(1)) };
  });
  return { phase: source.phase, walkthroughs };
}
