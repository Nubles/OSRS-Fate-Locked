import { createHash } from 'node:crypto';

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

export function extractQuestTasks(chunkPicker, questIds, tasksMap = undefined) {
  const sourceTasks = chunkPicker?.challenges?.Quest;
  if (!isRecord(sourceTasks)) throw new Error('Chunk Picker export is missing challenges.Quest');

  if (!Array.isArray(questIds)) throw new Error('Requested quest IDs must be an array');
  const requestedQuestIds = new Set();
  for (const questId of questIds) {
    if (typeof questId !== 'string' || !questId.trim()) throw new Error('Requested quest ID must not be blank');
    if (requestedQuestIds.has(questId)) throw new Error(`Requested quest ID is duplicated: ${questId}`);
    requestedQuestIds.add(questId);
  }

  const result = Object.fromEntries(questIds.map(questId => [questId, []]));
  const selected = Object.entries(sourceTasks).filter(([, task]) => (
    isRecord(task) && requestedQuestIds.has(task.BaseQuest)
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

const validateItemRef = (value, label) => {
  assertWalkthrough(isRecord(value), `${label} must be an item reference`);
  nonBlankWalkthrough(value.key, `${label} key`);
  nonBlankWalkthrough(value.name, `${label} name`);
  assertWalkthrough(
    value.key === canonicalWalkthroughItemKey(value.name),
    `${label} key must be canonical`,
  );
  return value.key;
};

const assertOnlyFields = (value, fields, label) => {
  const unexpected = Object.keys(value).filter(field => !fields.includes(field));
  assertWalkthrough(unexpected.length === 0, `${label} has unexpected field(s): ${unexpected.join(', ')}`);
};

const validateReviewedRootRequirement = (value, label) => {
  assertWalkthrough(isRecord(value), `${label} must be an item requirement`);
  assertOnlyFields(value, ['item', 'quantity', 'supplyPolicy', 'alternatives', 'note'], label);
  const itemKey = validateWalkthroughItem(value, label);
  if (value.alternatives !== undefined) {
    assertWalkthrough(Array.isArray(value.alternatives), `${label} alternatives must be an array`);
    const alternativeKeys = new Set();
    value.alternatives.forEach((alternative, index) => {
      const alternativeKey = validateItemRef(alternative, `${label} alternative ${index + 1}`);
      assertWalkthrough(!alternativeKeys.has(alternativeKey), `${label} alternatives must not repeat`);
      alternativeKeys.add(alternativeKey);
    });
  }
  if (value.note !== undefined) nonBlankWalkthrough(value.note, `${label} note`);
  return itemKey;
};

const validateReviewedRootRequirementContexts = (review, sourceQuestIds) => {
  if (review?.rootRequirements === undefined) return null;
  assertWalkthrough(isRecord(review.rootRequirements), 'Reviewed root requirements must be an object');
  const sourceQuestIdSet = new Set(sourceQuestIds);
  const contexts = new Map();
  Object.entries(review.rootRequirements).forEach(([questId, context]) => {
    assertWalkthrough(sourceQuestIdSet.has(questId), `Reviewed root requirements include an unknown quest: ${questId}`);
    assertWalkthrough(isRecord(context), `${questId}: reviewed root requirements must be an object`);
    assertOnlyFields(context, ['questId', 'wikiRevision', 'reviewedAt', 'items'], `${questId}: reviewed root requirements`);
    assertWalkthrough(context.questId === questId, `${questId}: reviewed root requirement quest ID must match its key`);
    assertWalkthrough(typeof context.wikiRevision === 'string' && /^\d{8}$/.test(context.wikiRevision),
      `${questId}: reviewed root requirement Wiki revision must be pinned`);
    assertWalkthrough(typeof context.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(context.reviewedAt),
      `${questId}: reviewed root requirement review date is invalid`);
    assertWalkthrough(Array.isArray(context.items), `${questId}: reviewed root requirements must include items`);
    const itemKeys = new Set();
    context.items.forEach((item, index) => {
      const itemKey = validateReviewedRootRequirement(item, `${questId}: reviewed root requirement ${index + 1}`);
      assertWalkthrough(!itemKeys.has(itemKey), `${questId}: reviewed root requirements must not repeat an item`);
      itemKeys.add(itemKey);
    });
    contexts.set(questId, context.items);
  });
  return contexts;
};

const validateStaticCoachLocation = (action, label) => {
  assertWalkthrough(isRecord(action.location), label + ' location is required');
  const { location } = action;
  assertWalkthrough(
    location.kind === 'REVIEWED_ALIAS' || location.kind === 'EXPLICIT_CHUNKS',
    label + ' requires static reviewed or explicit chunks',
  );
  assertWalkthrough(Array.isArray(location.chunks) && location.chunks.length > 0, label + ' static chunks are required');
  const chunks = new Set();
  location.chunks.forEach((chunk, index) => {
    nonBlankWalkthrough(chunk, label + ' static chunk ' + (index + 1));
    const match = /^(-?\d+),(-?\d+)$/.exec(chunk);
    assertWalkthrough(match !== null && String(Number(match[1])) + ',' + String(Number(match[2])) === chunk,
      label + ' static chunk ' + (index + 1) + ' must be canonical');
    assertWalkthrough(!chunks.has(chunk), label + ' static chunks must not repeat');
    chunks.add(chunk);
  });

  if (location.kind !== 'REVIEWED_ALIAS') return;
  assertWalkthrough(action.confidence === 'REVIEWED', label + ' reviewed location must use REVIEWED confidence');
  nonBlankWalkthrough(location.alias, label + ' reviewed location alias');
  nonBlankWalkthrough(location.reviewer, label + ' reviewed location reviewer');
  nonBlankWalkthrough(location.reviewedAt, label + ' reviewed location date');
  nonBlankWalkthrough(location.evidence, label + ' reviewed location evidence');
  nonBlankWalkthrough(location.rationale, label + ' reviewed location rationale');
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
  assertWalkthrough(Array.isArray(coach.consumes), label + ' consumes are required');
  coach.consumes.forEach((item, index) => validateWalkthroughItem(
    item,
    label + ' consumes ' + (index + 1),
  ));
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
  validateStaticCoachLocation(action, label);

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

const validateCoachActions = (questId, actions, rootRequirements) => {
  const hasCoachMetadata = actions.some(action => isRecord(action) && action.coach !== undefined);
  if (!hasCoachMetadata) return;

  validateTaskGraph(actions);
  actions.forEach((action) => {
    assertWalkthrough(isRecord(action), `${questId}: reviewed action is invalid`);
    if (action.coach === undefined) return;
    validateCoachMetadata(action, questId);
  });

  if (!actions.every(action => isRecord(action) && action.coach !== undefined)) return;
  assertWalkthrough(Array.isArray(rootRequirements), `${questId}: reviewed root requirements are required`);
  let previousSourceOrder = 0;
  const actionsById = new Map();
  const itemFlow = new Map();
  rootRequirements.forEach((item) => {
    itemFlow.set(item.item.key, (itemFlow.get(item.item.key) ?? 0) + item.quantity);
  });
  const completionActions = [];
  actions.forEach((action) => {
    nonBlankWalkthrough(action.id, `${questId}: strategy action ID`);
    assertWalkthrough(Number.isInteger(action.sourceOrder) && action.sourceOrder > previousSourceOrder, `${questId}: strategy source order is unstable`);
    actionsById.set(action.id, action);
    previousSourceOrder = action.sourceOrder;

    const consumedQuantities = new Map();
    action.coach.consumes.forEach((item) => {
      consumedQuantities.set(item.item.key, (consumedQuantities.get(item.item.key) ?? 0) + item.quantity);
    });
    consumedQuantities.forEach((quantity, itemKey) => {
      assertWalkthrough(
        (itemFlow.get(itemKey) ?? 0) >= quantity,
        questId + ': strategy consumes ' + itemKey + ' before it is fulfilled',
      );
    });
    consumedQuantities.forEach((quantity, itemKey) => {
      itemFlow.set(itemKey, itemFlow.get(itemKey) - quantity);
    });
    action.coach.fulfils.forEach((item) => {
      itemFlow.set(item.item.key, (itemFlow.get(item.item.key) ?? 0) + item.quantity);
    });
    if (action.coach.completion.kind === 'QUEST_COMPLETED') completionActions.push(action);
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
  assertWalkthrough(
    completionActions.length === 1,
    questId + ': strategy must have exactly one final quest completion',
  );
  const finalAction = actions.at(-1);
  assertWalkthrough(
    completionActions[0] === finalAction,
    questId + ': strategy quest completion must be final',
  );
  assertWalkthrough(
    finalAction.coach.completion.kind === 'QUEST_COMPLETED'
      && finalAction.coach.completion.questId === questId,
    questId + ': strategy final quest completion must match its quest',
  );
};

export function compileWalkthroughCatalogue(source, review, catalogue = undefined) {
  if (source?.phase !== 'SOURCE_BOOTSTRAP' && source?.phase !== 'REVIEWED') {
    throw new Error('Walkthrough source phase must be SOURCE_BOOTSTRAP or REVIEWED');
  }
  if (catalogue !== undefined) {
    const entries = Array.isArray(catalogue?.entries) ? catalogue.entries : [];
    const byQuestId = new Map(entries.map(entry => [entry.questId, entry]));
    for (const quest of source.quests ?? []) {
      const entry = byQuestId.get(quest.questId);
      assertWalkthrough(entry !== undefined,
        `Walkthrough compiler received unknown RuneProof catalogue quest ID: ${quest.questId}`);
      assertWalkthrough(entry.slug === slug(quest.questId),
        `Walkthrough compiler catalogue slug mismatch for ${quest.questId}`);
      assertWalkthrough(entry.kind === 'quest' || entry.kind === 'miniquest',
        `Walkthrough compiler catalogue kind is invalid for ${quest.questId}`);
    }
    for (const questId of Object.keys(review?.quests ?? {})) {
      assertWalkthrough(byQuestId.has(questId),
        `Walkthrough review contains unknown RuneProof catalogue quest ID: ${questId}`);
    }
  }
  const rootRequirementsByQuest = validateReviewedRootRequirementContexts(
    review,
    (source.quests ?? []).map(quest => quest.questId),
  );
  const trustedQuests = source.phase === 'REVIEWED'
    ? (source.quests ?? []).filter(quest => (
        Object.prototype.hasOwnProperty.call(review?.quests ?? {}, quest.questId)
        && Array.isArray(review.quests[quest.questId])
        && review.quests[quest.questId].length > 0
      ))
    : (source.quests ?? []);
  const walkthroughs = trustedQuests.map((quest) => {
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
    validateCoachActions(quest.questId, reviewedActions, rootRequirementsByQuest?.get(quest.questId));
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
