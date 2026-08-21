import { createHash } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinnedChunkSource } from './chunk-source.mjs';
import {
  compileWalkthroughCatalogue,
  extractQuestTasks,
  extractQuickGuideLines,
  sourceLineDigest,
  stableJson,
  validateTaskGraph,
} from './quest-walkthrough-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PATHS = Object.freeze({
  source: resolve(ROOT, 'data', 'sources', 'quest-walkthrough-sources.json'),
  review: resolve(ROOT, 'data', 'sources', 'quest-walkthrough-review.json'),
  candidate: resolve(ROOT, 'data', 'sources', 'quest-walkthrough-candidate.json'),
  generated: resolve(ROOT, 'data', 'questWalkthroughs.generated.json'),
  membership: resolve(ROOT, 'data', 'sources', 'f2p-quest-membership.json'),
});
const PINNED_COMMIT = 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
const TASKS_MAP_URL = `https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/${PINNED_COMMIT}/tasksMap.json`;
const USER_AGENT = 'OSRS-Fate-Locked RuneProof walkthrough refresh/1.0 (https://github.com/Nubles/OSRS-Fate-Locked)';
const PINNED_TASKS_MAP_SHA256 = 'f740b7194189f1a3ef81515ca4d4872caf91a6516a93bdf64c5d43c93d33bd8a';
// Complete allowlisted F2P-and-legacy subset of TASKS_MAP_URL at PINNED_COMMIT.
// Candidate mappings must be a subset of this immutable local provenance snapshot.
const PINNED_TASK_MAPPINGS = Object.freeze({
  "~|Elemental Workshop I|~ Crafting skill requirement": 't_1425',
  "~|The Knight's Sword|~ Mining skill requirement": 't_2763',
  "~|Elemental Workshop I|~ Mining skill requirement": 't_2768',
  "~|Elemental Workshop I|~ Smithing skill requirement": 't_3465',
  "~|Below Ice Mountain|~ 1": 't_7577',
  "~|Below Ice Mountain|~ 2a": 't_7578',
  "~|Below Ice Mountain|~ 2b": 't_7579',
  "~|Below Ice Mountain|~ 2c1": 't_7580',
  "~|Below Ice Mountain|~ 2c2": 't_7581',
  "~|Below Ice Mountain|~ 2c3": 't_7582',
  "~|Below Ice Mountain|~ 2c4": 't_7583',
  "~|Below Ice Mountain|~ 3": 't_7584',
  "~|Below Ice Mountain|~ 4": 't_7585',
  "~|Below Ice Mountain|~ Complete the quest": 't_7586',
  "~|Black Knights' Fortress|~ 1": 't_7587',
  "~|Black Knights' Fortress|~ 2": 't_7588',
  "~|Black Knights' Fortress|~ 3": 't_7589',
  "~|Black Knights' Fortress|~ Complete the quest": 't_7590',
  "~|Cook's Assistant|~ 1": 't_7591',
  "~|Cook's Assistant|~ 2a": 't_7592',
  "~|Cook's Assistant|~ 2b": 't_7593',
  "~|Cook's Assistant|~ 2c": 't_7594',
  "~|Cook's Assistant|~ 3": 't_7595',
  "~|Cook's Assistant|~ Complete the quest": 't_7596',
  "~|The Corsair Curse|~ 1": 't_7597',
  "~|The Corsair Curse|~ 2": 't_7598',
  "~|The Corsair Curse|~ 3": 't_7599',
  "~|The Corsair Curse|~ 4a1": 't_7600',
  "~|The Corsair Curse|~ 4a2": 't_7601',
  "~|The Corsair Curse|~ 4a3": 't_7602',
  "~|The Corsair Curse|~ 4b": 't_7603',
  "~|The Corsair Curse|~ 4c1": 't_7604',
  "~|The Corsair Curse|~ 4c2": 't_7605',
  "~|The Corsair Curse|~ 4c3": 't_7606',
  "~|The Corsair Curse|~ 5": 't_7607',
  "~|The Corsair Curse|~ 6": 't_7608',
  "~|The Corsair Curse|~ 7": 't_7609',
  "~|The Corsair Curse|~ 8": 't_7610',
  "~|The Corsair Curse|~ 9": 't_7611',
  "~|The Corsair Curse|~ Complete the quest": 't_7612',
  "~|Demon Slayer|~ 1": 't_7613',
  "~|Demon Slayer|~ 2": 't_7614',
  "~|Demon Slayer|~ 3a": 't_7615',
  "~|Demon Slayer|~ 3b": 't_7616',
  "~|Demon Slayer|~ 4": 't_7617',
  "~|Demon Slayer|~ 5": 't_7618',
  "~|Demon Slayer|~ Complete the quest": 't_7619',
  "~|Doric's Quest|~ 1": 't_7620',
  "~|Doric's Quest|~ 2": 't_7621',
  "~|Doric's Quest|~ Complete the quest": 't_7622',
  "~|Dragon Slayer I|~ 1": 't_7623',
  "~|Dragon Slayer I|~ 2": 't_7624',
  "~|Dragon Slayer I|~ 3": 't_7625',
  "~|Dragon Slayer I|~ 4": 't_7626',
  "~|Dragon Slayer I|~ 5a1": 't_7627',
  "~|Dragon Slayer I|~ 5a2": 't_7628',
  "~|Dragon Slayer I|~ 5b1": 't_7629',
  "~|Dragon Slayer I|~ 5b2": 't_7630',
  "~|Dragon Slayer I|~ 5c": 't_7631',
  "~|Dragon Slayer I|~ 5d1": 't_7632',
  "~|Dragon Slayer I|~ 5d2": 't_7633',
  "~|Dragon Slayer I|~ 6": 't_7634',
  "~|Dragon Slayer I|~ 7": 't_7635',
  "~|Dragon Slayer I|~ 8": 't_7636',
  "~|Dragon Slayer I|~ 9": 't_7637',
  "~|Dragon Slayer I|~ 10": 't_7638',
  "~|Dragon Slayer I|~ Complete the quest": 't_7639',
  "~|Ernest the Chicken|~ 1": 't_7640',
  "~|Ernest the Chicken|~ 2a": 't_7641',
  "~|Ernest the Chicken|~ 2b": 't_7642',
  "~|Ernest the Chicken|~ 3": 't_7643',
  "~|Ernest the Chicken|~ Complete the quest": 't_7644',
  "~|Goblin Diplomacy|~ 1": 't_7645',
  "~|Goblin Diplomacy|~ 2": 't_7646',
  "~|Goblin Diplomacy|~ 3": 't_7647',
  "~|Goblin Diplomacy|~ 4": 't_7648',
  "~|Goblin Diplomacy|~ Complete the quest": 't_7649',
  "~|Imp Catcher|~ 1": 't_7650',
  "~|Imp Catcher|~ 2": 't_7651',
  "~|Imp Catcher|~ Complete the quest": 't_7652',
  "~|The Knight's Sword|~ 1": 't_7653',
  "~|The Knight's Sword|~ 2": 't_7654',
  "~|The Knight's Sword|~ 3": 't_7655',
  "~|The Knight's Sword|~ 4": 't_7656',
  "~|The Knight's Sword|~ 5": 't_7657',
  "~|The Knight's Sword|~ 6": 't_7658',
  "~|The Knight's Sword|~ 7": 't_7659',
  "~|The Knight's Sword|~ 8": 't_7660',
  "~|The Knight's Sword|~ Complete the quest": 't_7661',
  "~|Misthalin Mystery|~ 1": 't_7662',
  "~|Misthalin Mystery|~ Complete the quest": 't_7663',
  "~|Pirate's Treasure|~ 1": 't_7664',
  "~|Pirate's Treasure|~ 2": 't_7665',
  "~|Pirate's Treasure|~ 3": 't_7666',
  "~|Pirate's Treasure|~ 4": 't_7667',
  "~|Pirate's Treasure|~ 5": 't_7668',
  "~|Pirate's Treasure|~ Complete the quest": 't_7669',
  "~|Prince Ali Rescue|~ 1": 't_7670',
  "~|Prince Ali Rescue|~ 2": 't_7671',
  "~|Prince Ali Rescue|~ 3a1": 't_7672',
  "~|Prince Ali Rescue|~ 3a2": 't_7673',
  "~|Prince Ali Rescue|~ 3b": 't_7674',
  "~|Prince Ali Rescue|~ 3c": 't_7675',
  "~|Prince Ali Rescue|~ 3d1": 't_7676',
  "~|Prince Ali Rescue|~ 3d2": 't_7677',
  "~|Prince Ali Rescue|~ 4": 't_7678',
  "~|Prince Ali Rescue|~ 5": 't_7679',
  "~|Prince Ali Rescue|~ 6": 't_7680',
  "~|Prince Ali Rescue|~ 7": 't_7681',
  "~|Prince Ali Rescue|~ Complete the quest": 't_7682',
  "~|The Restless Ghost|~ 1": 't_7683',
  "~|The Restless Ghost|~ 2": 't_7684',
  "~|The Restless Ghost|~ 3": 't_7685',
  "~|The Restless Ghost|~ 4": 't_7686',
  "~|The Restless Ghost|~ 5": 't_7687',
  "~|The Restless Ghost|~ Complete the quest": 't_7688',
  "~|Romeo & Juliet|~ 1": 't_7689',
  "~|Romeo & Juliet|~ 2": 't_7690',
  "~|Romeo & Juliet|~ 3": 't_7691',
  "~|Romeo & Juliet|~ 4": 't_7692',
  "~|Romeo & Juliet|~ 5": 't_7693',
  "~|Romeo & Juliet|~ 6": 't_7694',
  "~|Romeo & Juliet|~ 7": 't_7695',
  "~|Romeo & Juliet|~ Complete the quest": 't_7696',
  "~|Rune Mysteries|~ 1": 't_7697',
  "~|Rune Mysteries|~ 2": 't_7698',
  "~|Rune Mysteries|~ 3": 't_7699',
  "~|Rune Mysteries|~ 4": 't_7700',
  "~|Rune Mysteries|~ Complete the quest": 't_7701',
  "~|Sheep Shearer|~ 1": 't_7702',
  "~|Sheep Shearer|~ 2": 't_7703',
  "~|Sheep Shearer|~ Complete the quest": 't_7704',
  "~|Shield of Arrav|~ 1": 't_7705',
  "~|Shield of Arrav|~ 2a1": 't_7706',
  "~|Shield of Arrav|~ 2a2": 't_7707',
  "~|Shield of Arrav|~ 2a3": 't_7708',
  "~|Shield of Arrav|~ 2a4": 't_7709',
  "~|Shield of Arrav|~ 2a5": 't_7710',
  "~|Shield of Arrav|~ 2b1": 't_7711',
  "~|Shield of Arrav|~ 2b2": 't_7712',
  "~|Shield of Arrav|~ 2b3": 't_7713',
  "~|Shield of Arrav|~ 2b4": 't_7714',
  "~|Shield of Arrav|~ 2b5": 't_7715',
  "~|Shield of Arrav|~ 3": 't_7716',
  "~|Shield of Arrav|~ 4": 't_7717',
  "~|Shield of Arrav|~ Complete the quest": 't_7718',
  "~|Vampyre Slayer|~ 1": 't_7719',
  "~|Vampyre Slayer|~ 2": 't_7720',
  "~|Vampyre Slayer|~ 3": 't_7721',
  "~|Vampyre Slayer|~ Complete the quest": 't_7722',
  "~|Witch's Potion|~ 1": 't_7723',
  "~|Witch's Potion|~ 2": 't_7724',
  "~|Witch's Potion|~ Complete the quest": 't_7725',
  "~|X Marks the Spot|~ 1": 't_7726',
  "~|X Marks the Spot|~ 2": 't_7727',
  "~|X Marks the Spot|~ 3": 't_7728',
  "~|X Marks the Spot|~ 4": 't_7729',
  "~|X Marks the Spot|~ 5": 't_7730',
  "~|X Marks the Spot|~ Complete the quest": 't_7731',
  "~|Elemental Workshop I|~ 1": 't_8157',
  "~|Elemental Workshop I|~ 2": 't_8158',
  "~|Elemental Workshop I|~ 3": 't_8159',
  "~|Elemental Workshop I|~ 4": 't_8160',
  "~|Elemental Workshop I|~ 5": 't_8161',
  "~|Elemental Workshop I|~ Complete the quest": 't_8162',
  "~|Daddy's Home|~ 1": 't_9590',
  "~|Daddy's Home|~ 2": 't_9591',
  "~|Daddy's Home|~ 3a": 't_9592',
  "~|Daddy's Home|~ 3b": 't_9593',
  "~|Daddy's Home|~ 3c1": 't_9594',
  "~|Daddy's Home|~ 3c2": 't_9595',
  "~|Daddy's Home|~ 3c3": 't_9596',
  "~|Daddy's Home|~ 4": 't_9597',
  "~|Daddy's Home|~ 5": 't_9598',
  "~|Daddy's Home|~ Complete the quest": 't_9599',
});

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nonBlank = (value, label) => assert(typeof value === 'string' && value.trim(), `${label} must not be blank`);
const taskSourceQuestId = (sourceId, label) => {
  nonBlank(sourceId, label);
  const match = /^~\|(.+)\|~\s/.exec(sourceId);
  assert(match !== null, `${label} is not a Chunk Picker task source ID`);
  return match[1];
};
const LEGACY_QUEST_ID = 'Elemental Workshop I';

const validateF2PMembership = (membership) => {
  assert(membership?.schemaVersion === 1, 'F2P membership schemaVersion must be 1');
  assert(Array.isArray(membership?.quests) && membership.quests.length > 0, 'F2P membership quests are required');
  const questIds = new Set();
  const slugs = new Set();
  const priorities = new Set();
  const entries = membership.quests.map((entry, index) => {
    assert(isRecord(entry), `F2P membership quest ${index + 1} is invalid`);
    nonBlank(entry.questId, `F2P membership quest ${index + 1} ID`);
    nonBlank(entry.slug, `F2P membership quest ${index + 1} slug`);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug), `F2P membership quest ${entry.questId} slug is invalid`);
    assert(entry.kind === 'quest' || entry.kind === 'miniquest', `F2P membership quest ${entry.questId} kind is invalid`);
    assert(Number.isInteger(entry.progressionPriority) && entry.progressionPriority > 0,
      `F2P membership quest ${entry.questId} progression priority is invalid`);
    nonBlank(entry.wikiTitle, `F2P membership quest ${entry.questId} Wiki title`);
    assert(entry.wikiTitle === `${entry.questId}/Quick guide`, `F2P membership quest ${entry.questId} Wiki title is invalid`);
    assert(!questIds.has(entry.questId), `F2P membership has duplicate quest ID: ${entry.questId}`);
    assert(!slugs.has(entry.slug), `F2P membership has duplicate slug: ${entry.slug}`);
    assert(!priorities.has(entry.progressionPriority), `F2P membership has duplicate progression priority: ${entry.progressionPriority}`);
    questIds.add(entry.questId);
    slugs.add(entry.slug);
    priorities.add(entry.progressionPriority);
    return entry;
  });
  return entries;
};

const membershipByQuestId = membership => new Map(validateF2PMembership(membership)
  .map(entry => [entry.questId, entry]));

const membershipBySlug = membership => new Map(validateF2PMembership(membership)
  .map(entry => [entry.slug, entry]));

const allowedQuestIds = membership => new Set([
  ...membershipByQuestId(membership).keys(),
  LEGACY_QUEST_ID,
]);

const DEFAULT_MEMBERSHIP = JSON.parse(readFileSync(DEFAULT_PATHS.membership, 'utf8'));
const DEFAULT_MEMBERSHIP_BY_SLUG = membershipBySlug(DEFAULT_MEMBERSHIP);

const readJson = async (path, label) => {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${label} is missing or unreadable: ${error.message}`);
  }
  try {
    return { raw, value: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
};

const validatePermanentWikiSource = (quest) => {
  assert(Number.isInteger(quest.wikiRevision) && quest.wikiRevision > 0, `${quest.questId}: Wiki revision must be a positive integer`);
  assert(typeof quest.wikiRevisionTimestamp === 'string' && !Number.isNaN(Date.parse(quest.wikiRevisionTimestamp)), `${quest.questId}: Wiki revision timestamp is invalid`);
  const url = new URL(quest.wikiUrl);
  assert(url.origin === 'https://oldschool.runescape.wiki', `${quest.questId}: Wiki URL origin is invalid`);
  assert(url.searchParams.get('oldid') === String(quest.wikiRevision), `${quest.questId}: Wiki URL oldid must match the revision`);
};

export function validateWalkthroughSource(source, membership) {
  const membersByQuestId = membershipByQuestId(membership);
  const roster = allowedQuestIds(membership);
  assert(source?.schemaVersion === 1, 'Walkthrough source schemaVersion must be 1');
  assert(source.phase === 'SOURCE_BOOTSTRAP' || source.phase === 'REVIEWED', 'Walkthrough source phase is invalid');
  assert(source.chunkPicker?.repository === 'source-chunk/chunk-picker-v2', 'Chunk Picker repository is invalid');
  assert(source.chunkPicker?.branch === 'gh-pages', 'Chunk Picker branch is invalid');
  assert(source.chunkPicker?.commit === PINNED_COMMIT, 'Chunk Picker commit is not the reviewed pin');
  assert(source.chunkPicker?.exportPath === 'chunkpicker-chunkinfo-export.json', 'Chunk Picker export path is invalid');
  assert(source.chunkPicker?.tasksMapUrl === TASKS_MAP_URL, 'tasksMap URL is not pinned to the reviewed commit');
  assert(source.chunkPicker?.tasksMapSha256 === PINNED_TASKS_MAP_SHA256, 'Pinned tasksMap SHA-256 is invalid');
  assert(isRecord(source.chunkPicker?.taskMappings), 'Chunk Picker task mappings are required');
  nonBlank(source.chunkPicker?.attribution, 'Chunk Picker attribution');
  assert(source.chunkPicker?.licenceStatus === 'UNVERIFIED' || source.chunkPicker?.licenceStatus === 'PERMISSION_RECORDED', 'Chunk Picker licence status is invalid');
  if (source.chunkPicker.licenceStatus === 'PERMISSION_RECORDED') nonBlank(source.chunkPicker.permissionReference, 'Chunk Picker permission reference');
  assert(source.wiki?.apiEndpoint === 'https://oldschool.runescape.wiki/api.php', 'Wiki API endpoint is invalid');
  nonBlank(source.wiki?.attribution, 'Wiki attribution');
  assert(source.wiki?.licence === 'CC BY-NC-SA 3.0', 'Wiki licence is invalid');
  assert(source.wiki?.licenceUrl === 'https://creativecommons.org/licenses/by-nc-sa/3.0/', 'Wiki licence URL is invalid');
  assert(Array.isArray(source.quests), 'Walkthrough source quests are required');
  assert(source.quests.length > 0, 'Walkthrough source must contain at least one source quest record');
  const sourceQuestIds = new Set();
  const mappings = source.chunkPicker.taskMappings;
  for (const [sourceId, taskId] of Object.entries(mappings)) {
    const mappingQuestId = taskSourceQuestId(sourceId, 'Chunk Picker task mapping source ID');
    assert(roster.has(mappingQuestId), `Chunk Picker task mapping has unsupported quest ID: ${sourceId}`);
    nonBlank(taskId, `Chunk Picker task mapping ${sourceId}`);
    const expectedTaskId = PINNED_TASK_MAPPINGS[sourceId];
    assert(expectedTaskId !== undefined, `Chunk Picker task mapping is absent from the immutable pinned mapping: ${sourceId}`);
    assert(taskId === expectedTaskId, `Chunk Picker task mapping does not match the immutable pinned mapping for ${sourceId}`);
  }
  for (const quest of source.quests) {
    nonBlank(quest?.questId, 'Walkthrough source quest ID');
    assert(!sourceQuestIds.has(quest.questId), `Walkthrough source has duplicate quest ID: ${quest.questId}`);
    assert(roster.has(quest.questId), `Walkthrough source has unsupported F2P membership quest ID: ${quest.questId}`);
    sourceQuestIds.add(quest.questId);
    const member = membersByQuestId.get(quest.questId);
    const expectedWikiTitle = member?.wikiTitle ?? `${LEGACY_QUEST_ID}/Quick guide`;
    assert(quest.wikiTitle === expectedWikiTitle, `${quest.questId}: Wiki title is invalid`);
    validatePermanentWikiSource(quest);
    assert(Array.isArray(quest.importedLines), `${quest.questId}: imported lines are required`);
    assert(Array.isArray(quest.tasks), `${quest.questId}: tasks are required`);
    quest.tasks.forEach((task) => {
      const sourceTaskQuestId = taskSourceQuestId(task?.sourceId, `${quest.questId}: task source ID`);
      assert(sourceTaskQuestId === quest.questId, `${quest.questId}: task source ID belongs to ${sourceTaskQuestId}, not this quest`);
      const expectedTaskId = PINNED_TASK_MAPPINGS[task.sourceId];
      assert(expectedTaskId !== undefined, quest.questId + ': task source ID is not in the immutable pinned mapping: ' + task.sourceId);
      assert(mappings[task.sourceId] === expectedTaskId, quest.questId + ': task source ID does not match the immutable pinned mapping: ' + task.sourceId);
      assert(task.id === expectedTaskId, quest.questId + ': task ID does not match pinned mapping for ' + task.sourceId);
    });
    const ids = new Set();
    quest.importedLines.forEach((line, index) => {
      nonBlank(line?.id, `${quest.questId}: source line ID`);
      assert(!ids.has(line.id), `${quest.questId}: duplicate source line ID ${line.id}`);
      ids.add(line.id);
      assert(line.sourceOrder === index + 1, `${quest.questId}: source line order must be contiguous`);
      nonBlank(line.section, `${quest.questId}: source line section`);
      nonBlank(line.rawText, `${quest.questId}: source line raw text`);
    });
  }
  validateTaskGraph(Object.fromEntries(source.quests.map(quest => [quest.questId, quest.tasks])));
  return source;
}

const sameQuestIdSet = (left, right) => (
  left.length === right.length
  && left.every(questId => right.includes(questId))
);

const validateReviewShape = (review, source) => {
  assert(review?.schemaVersion === 1, 'Walkthrough review schemaVersion must be 1');
  assert(isRecord(review.quests), 'Walkthrough review quests are required');
  const sourceQuestIds = source.quests.map(quest => quest.questId);
  assert(sameQuestIdSet(Object.keys(review.quests), sourceQuestIds), 'Walkthrough review quest keys must exactly match source quest IDs');
  if (review.taskCoverageExceptions !== undefined) {
    assert(isRecord(review.taskCoverageExceptions), 'Walkthrough review task coverage exceptions must be an object');
    Object.entries(review.taskCoverageExceptions).forEach(([questId, exceptions]) => {
      assert(sourceQuestIds.includes(questId), `Walkthrough review has task coverage exceptions for an unknown quest: ${questId}`);
      assert(Array.isArray(exceptions), `${questId}: task coverage exceptions must be an array`);
    });
  }
  assert(isRecord(review.sourceLineDigests), 'Walkthrough review source line digests are required');
  assert(sameQuestIdSet(Object.keys(review.sourceLineDigests), sourceQuestIds), 'Walkthrough review source line digest keys must exactly match source quest IDs');
  sourceQuestIds.forEach(quest => assert(Array.isArray(review.quests[quest]), `${quest}: review list is required`));
  sourceQuestIds.forEach((quest) => {
    assert(isRecord(review.sourceLineDigests[quest]), `${quest}: source line digests are required`);
  });
};

export function validateReviewAgreement(source, review) {
  validateReviewShape(review, source);
  validateTaskGraph(review.quests);
  for (const quest of source.quests) {
    const expected = quest.importedLines.map(line => line.id).sort();
    const reviewed = review.quests[quest.questId].flatMap(action => action.rawWikiLineIds ?? []).sort();
    assert(new Set(reviewed).size === reviewed.length, `${quest.questId}: review uses a source line more than once`);
    assert(JSON.stringify(reviewed) === JSON.stringify(expected), `${quest.questId}: review does not agree on every source line`);
    const reviewedDigests = review.sourceLineDigests[quest.questId];
    assert(
      JSON.stringify(Object.keys(reviewedDigests).sort()) === JSON.stringify(expected),
      `${quest.questId}: review source line digest IDs do not agree on every source line`,
    );
    for (const line of quest.importedLines) {
      assert(reviewedDigests[line.id] === sourceLineDigest(line), `${quest.questId}: source line ${line.id} digest does not match reviewed wording`);
    }

    const expectedTaskIds = new Set(quest.tasks.map(task => task.id));
    const taskById = new Map(quest.tasks.map(task => [task.id, task]));
    const taskCoverageExceptions = review.taskCoverageExceptions?.[quest.questId] ?? [];
    assert(Array.isArray(taskCoverageExceptions), `${quest.questId}: task coverage exceptions must be an array`);
    const exceptionByTaskId = new Map();
    for (const exception of taskCoverageExceptions) {
      assert(isRecord(exception), `${quest.questId}: task coverage exception must be an object`);
      assert(exception.kind === 'OMITTED_PREREQUISITE', `${quest.questId}: task coverage exception kind is invalid`);
      nonBlank(exception.taskId, `${quest.questId}: omitted prerequisite task ID`);
      assert(expectedTaskIds.has(exception.taskId), `${quest.questId}: omitted prerequisite references unknown task ${exception.taskId}`);
      assert(!exceptionByTaskId.has(exception.taskId), `${quest.questId}: omitted prerequisite task ${exception.taskId} is declared more than once`);
      assert(Array.isArray(exception.successorTaskIds) && exception.successorTaskIds.length > 0,
        `${quest.questId}: omitted prerequisite ${exception.taskId} must declare successor task IDs`);
      const successorTaskIds = new Set();
      exception.successorTaskIds.forEach((successorTaskId) => {
        nonBlank(successorTaskId, `${quest.questId}: omitted prerequisite successor task ID`);
        assert(expectedTaskIds.has(successorTaskId), `${quest.questId}: omitted prerequisite ${exception.taskId} references unknown successor ${successorTaskId}`);
        assert(!successorTaskIds.has(successorTaskId), `${quest.questId}: omitted prerequisite ${exception.taskId} repeats successor ${successorTaskId}`);
        successorTaskIds.add(successorTaskId);
      });
      nonBlank(exception.evidence, `${quest.questId}: omitted prerequisite evidence`);
      nonBlank(exception.rationale, `${quest.questId}: omitted prerequisite rationale`);
      const sourceTask = taskById.get(exception.taskId);
      assert(sourceTask.dependsOn.length === 0, `${quest.questId}: omitted prerequisite ${exception.taskId} must not depend on another task`);
      const pinnedSuccessorTaskIds = quest.tasks
        .filter(task => task.dependsOn.includes(exception.taskId))
        .map(task => task.id)
        .sort();
      assert(
        JSON.stringify([...successorTaskIds].sort()) === JSON.stringify(pinnedSuccessorTaskIds),
        `${quest.questId}: omitted prerequisite ${exception.taskId} successor tasks do not match the pinned graph`,
      );
      exceptionByTaskId.set(exception.taskId, exception);
    }
    const actionByTaskId = new Map();
    for (const action of review.quests[quest.questId]) {
      if (action.chunkPickerTaskId === undefined) continue;
      assert(expectedTaskIds.has(action.chunkPickerTaskId), `${quest.questId}: review references unknown task ${action.chunkPickerTaskId}`);
      assert(!exceptionByTaskId.has(action.chunkPickerTaskId), `${quest.questId}: task ${action.chunkPickerTaskId} is covered both as an omitted prerequisite and an action`);
      assert(!actionByTaskId.has(action.chunkPickerTaskId), `${quest.questId}: review uses task ${action.chunkPickerTaskId} more than once`);
      actionByTaskId.set(action.chunkPickerTaskId, action);
    }
    assert(actionByTaskId.size + exceptionByTaskId.size === expectedTaskIds.size, `${quest.questId}: review does not cover every pinned task`);
    for (const task of quest.tasks) {
      const action = actionByTaskId.get(task.id);
      if (exceptionByTaskId.has(task.id)) continue;
      assert(action !== undefined, `${quest.questId}: review does not cover task ${task.id}`);
      for (const dependencyTaskId of task.dependsOn ?? []) {
        const dependencyAction = actionByTaskId.get(dependencyTaskId);
        const dependencyException = exceptionByTaskId.get(dependencyTaskId);
        if (dependencyException !== undefined) {
          assert(dependencyException.successorTaskIds.includes(task.id),
            `${quest.questId}: omitted prerequisite ${dependencyTaskId} does not preserve edge to ${task.id}`);
          continue;
        }
        assert(dependencyAction !== undefined, `${quest.questId}: review does not cover dependency task ${dependencyTaskId}`);
        assert(action.dependsOn.includes(dependencyAction.id), `${quest.questId}: task dependency edge ${dependencyTaskId} -> ${task.id} is missing from reviewed actions`);
      }
    }
  }
  return review;
}

const fetchResponse = async (url, fetchImpl, stage) => {
  let response;
  try {
    response = await fetchImpl(url, { headers: { 'Api-User-Agent': USER_AGENT, 'User-Agent': USER_AGENT } });
  } catch (error) {
    throw new Error(`${stage} failed fetching ${url}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${stage} failed fetching ${url}: HTTP ${response.status}`);
  return response;
};

const wikiRequest = async (endpoint, params, fetchImpl, stage) => {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const body = await (await fetchResponse(url, fetchImpl, stage)).json();
  if (body.error) throw new Error(`${stage} failed at ${url}: ${body.error.code}: ${body.error.info}`);
  return body;
};

const latestWikiRevisions = async (source, fetchImpl) => {
  const titles = source.quests.map(quest => quest.wikiTitle);
  const body = await wikiRequest(source.wiki.apiEndpoint, {
    action: 'query', prop: 'revisions', redirects: '1', rvprop: 'ids|timestamp', titles: titles.join('|'),
  }, fetchImpl, 'quick-guide revision lookup');
  const pages = new Map((body.query?.pages ?? []).map(page => [page.title, page]));
  return new Map(titles.map(title => {
    const page = pages.get(title);
    const revision = page?.revisions?.[0];
    assert(page && !page.missing && Number.isInteger(revision?.revid) && revision.timestamp, `Wiki revision lookup did not resolve ${title}`);
    return [title, { revision: revision.revid, timestamp: revision.timestamp }];
  }));
};

const pinnedWikiText = async (source, title, revision, fetchImpl) => {
  const body = await wikiRequest(source.wiki.apiEndpoint, {
    action: 'query', prop: 'revisions', titles: title, rvprop: 'content', rvslots: 'main',
    rvstartid: String(revision), rvendid: String(revision),
  }, fetchImpl, `quick-guide revision ${revision}`);
  const page = body.query?.pages?.[0];
  const slot = page?.revisions?.[0]?.slots?.main;
  const content = slot?.content ?? slot?.['*'];
  assert(typeof content === 'string', `Quick-guide revision ${revision} omitted wikitext`);
  return content;
};

const flattenTaskMap = (value, result = {}) => {
  if (Array.isArray(value)) {
    value.forEach(child => flattenTaskMap(child, result));
    return result;
  }
  if (!isRecord(value)) return result;
  for (const [key, child] of Object.entries(value)) {
    if (/^~\|.+\|~\s/.test(key) && (typeof child === 'string' || typeof child === 'number')) result[key] = String(child);
    else if (isRecord(child) && /^~\|.+\|~\s/.test(key)) {
      const id = child.id ?? child.taskId ?? child.taskID;
      if (typeof id === 'string' || typeof id === 'number') result[key] = String(id);
    }
    flattenTaskMap(child, result);
  }
  return result;
};

const retainedQuestMappings = (tasksMap, questIds) => Object.fromEntries(
  Object.entries(flattenTaskMap(tasksMap)).filter(([sourceId]) => (
    questIds.some(questId => sourceId.startsWith(`~|${questId}|~ `))
  )),
);

const selectedMembershipEntries = (membership, questIds) => {
  assert(Array.isArray(questIds), 'Requested walkthrough quest IDs must be an array');
  const bySlug = membershipBySlug(membership);
  const selectedSlugs = new Set();
  const selected = questIds.map((slug) => {
    nonBlank(slug, 'Requested walkthrough quest slug');
    assert(!selectedSlugs.has(slug), `Requested walkthrough quest slug is duplicated: ${slug}`);
    selectedSlugs.add(slug);
    const entry = bySlug.get(slug);
    assert(entry !== undefined, `Requested quest slug is not in F2P membership: ${slug}`);
    return entry;
  });
  return selected.sort((left, right) => left.progressionPriority - right.progressionPriority);
};

const refreshQuestRecords = (source, membership, questIds) => {
  if (questIds.length === 0) return source.quests;
  const sourceQuestIds = new Set(source.quests.map(quest => quest.questId));
  const additions = selectedMembershipEntries(membership, questIds)
    .filter(entry => !sourceQuestIds.has(entry.questId))
    .map(entry => ({ questId: entry.questId, wikiTitle: entry.wikiTitle }));
  return additions;
};

const permanentWikiUrl = (title, revision) => `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_')).replaceAll('%2F', '/').replaceAll("'", '%27')}?oldid=${revision}`;

const diffCandidate = (before, after) => {
  let added = 0;
  let removed = 0;
  let reordered = 0;
  let taskChanged = 0;
  let unresolved = 0;
  const oldByQuest = new Map(before.quests.map(quest => [quest.questId, quest]));
  for (const quest of after.quests) {
    const old = oldByQuest.get(quest.questId) ?? { importedLines: [], tasks: [] };
    const oldText = old.importedLines.map(line => line.rawText);
    const newText = quest.importedLines.map(line => line.rawText);
    added += newText.filter(text => !oldText.includes(text)).length;
    removed += oldText.filter(text => !newText.includes(text)).length;
    reordered += newText.filter((text, index) => oldText.includes(text) && oldText[index] !== text).length;
    taskChanged += stableJson(old.tasks) === stableJson(quest.tasks) ? 0 : 1;
    unresolved += quest.importedLines.length;
  }
  return { added, removed, reordered, taskChanged, unresolved };
};

const refreshCandidate = async ({ source, membership, questIds, paths, fetchImpl, readChunkSource, tasksMapDigest, write }) => {
  const refreshRecords = refreshQuestRecords(source, membership, questIds);
  if (questIds.length > 0 && refreshRecords.length === 0) {
    await writeFile(paths.candidate, stableJson(source));
    const diff = diffCandidate(source, source);
    write(`Candidate written: added ${diff.added}, removed ${diff.removed}, reordered ${diff.reordered}, task-changed ${diff.taskChanged}, unresolved ${diff.unresolved}.`);
    return;
  }

  const { data } = await readChunkSource();
  const taskMapResponse = await fetchResponse(source.chunkPicker.tasksMapUrl, fetchImpl, 'pinned tasksMap refresh');
  const taskMapRaw = Buffer.from(await taskMapResponse.arrayBuffer());
  const taskMapHash = tasksMapDigest(taskMapRaw);
  let tasksMap;
  try { tasksMap = JSON.parse(taskMapRaw.toString('utf8')); } catch (error) { throw new Error(`Pinned tasksMap is invalid JSON: ${error.message}`); }
  const candidateRecords = questIds.length === 0 ? refreshRecords : [...source.quests, ...refreshRecords];
  const refreshQuestIds = refreshRecords.map(quest => quest.questId);
  const candidateQuestIds = candidateRecords.map(quest => quest.questId);
  const taskMappings = retainedQuestMappings(tasksMap, candidateQuestIds);
  const taskGraphs = extractQuestTasks(data, refreshQuestIds, taskMappings);
  const refreshSource = { ...source, quests: refreshRecords };
  const revisions = await latestWikiRevisions(refreshSource, fetchImpl);
  const quests = [];
  for (const quest of refreshRecords) {
    const pin = revisions.get(quest.wikiTitle);
    const wikitext = await pinnedWikiText(source, quest.wikiTitle, pin.revision, fetchImpl);
    quests.push({
      ...quest,
      wikiRevision: pin.revision,
      wikiRevisionTimestamp: pin.timestamp,
      wikiUrl: permanentWikiUrl(quest.wikiTitle, pin.revision),
      importedLines: extractQuickGuideLines({ questId: quest.questId, wikitext }),
      tasks: taskGraphs[quest.questId],
    });
  }
  const candidate = {
    ...source,
    chunkPicker: { ...source.chunkPicker, tasksMapUrl: TASKS_MAP_URL, tasksMapSha256: taskMapHash, taskMappings },
    quests: questIds.length === 0 ? quests : [...source.quests, ...quests],
  };
  validateWalkthroughSource(candidate, membership);
  await writeFile(paths.candidate, stableJson(candidate));
  const diff = diffCandidate(source, candidate);
  write(`Candidate written: added ${diff.added}, removed ${diff.removed}, reordered ${diff.reordered}, task-changed ${diff.taskChanged}, unresolved ${diff.unresolved}.`);
};

export const atomicWritePair = async (
  leftPath,
  leftContent,
  rightPath,
  rightContent,
  fileOps = { readFile, writeFile, rename, unlink },
) => {
  const suffix = '.tmp-' + process.pid + '-' + Date.now();
  const leftTemp = leftPath + suffix;
  const rightTemp = rightPath + suffix;
  const [leftOriginal, rightOriginal] = await Promise.all([
    fileOps.readFile(leftPath),
    fileOps.readFile(rightPath),
  ]);

  try {
    const staging = await Promise.allSettled([
      fileOps.writeFile(leftTemp, leftContent),
      fileOps.writeFile(rightTemp, rightContent),
    ]);
    const stagingFailure = staging.find(result => result.status === 'rejected');
    if (stagingFailure) throw stagingFailure.reason;

    await fileOps.rename(leftTemp, leftPath);
    await fileOps.rename(rightTemp, rightPath);
  } catch (error) {
    const rollback = await Promise.allSettled([
      fileOps.writeFile(leftPath, leftOriginal),
      fileOps.writeFile(rightPath, rightOriginal),
      fileOps.unlink(leftTemp),
      fileOps.unlink(rightTemp),
    ]);
    const rollbackErrors = rollback
      .filter(result => result.status === 'rejected')
      .map(result => result.reason)
      .filter(reason => reason?.code !== 'ENOENT');
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], 'Atomic walkthrough promotion failed and rollback was incomplete');
    }
    throw error;
  }

  await Promise.allSettled([
    fileOps.unlink(leftTemp),
    fileOps.unlink(rightTemp),
  ]);
};
export async function runWalkthroughSync({
  mode = 'check',
  questIds = [],
  paths = DEFAULT_PATHS,
  fetchImpl = fetch,
  readChunkSource = readPinnedChunkSource,
  tasksMapDigest = raw => createHash('sha256').update(raw).digest('hex'),
  write = line => console.log(line),
} = {}) {
  assert(mode === 'check' || mode === 'refresh' || mode === 'promote', `Unknown walkthrough sync mode: ${mode}`);
  assert(Array.isArray(questIds), 'Requested walkthrough quest IDs must be an array');
  assert(mode === 'refresh' || questIds.length === 0, 'Quest IDs are valid only with refresh mode');
  const { value: membership } = await readJson(paths.membership, 'F2P membership');
  validateF2PMembership(membership);
  const { value: source } = await readJson(paths.source, 'walkthrough source');
  validateWalkthroughSource(source, membership);

  if (mode === 'refresh') {
    await refreshCandidate({ source, membership, questIds, paths, fetchImpl, readChunkSource, tasksMapDigest, write });
    return;
  }

  const { value: review } = await readJson(paths.review, 'walkthrough review');
  if (mode === 'promote') {
    const { value: candidate } = await readJson(paths.candidate, 'walkthrough candidate');
    validateWalkthroughSource(candidate, membership);
    validateReviewAgreement(candidate, review);
    const generated = compileWalkthroughCatalogue(candidate, review);
    await atomicWritePair(paths.source, stableJson(candidate), paths.generated, stableJson(generated));
    write(`Promoted ${candidate.quests.length} reviewed walkthrough sources; phase ${candidate.phase}.`);
    return;
  }

  validateReviewShape(review, source);
  if (source.phase === 'SOURCE_BOOTSTRAP') {
    assert(source.quests.every(quest => review.quests[quest.questId].length === 0), 'SOURCE_BOOTSTRAP review lists must remain empty');
  } else {
    validateReviewAgreement(source, review);
  }
  const { raw: generatedRaw, value: generated } = await readJson(paths.generated, 'generated walkthrough catalogue');
  const expected = stableJson(compileWalkthroughCatalogue(source, review));
  assert(
    generatedRaw.replaceAll('\r\n', '\n') === expected,
    'Generated walkthrough catalogue differs from the stable offline compilation',
  );
  assert(generated.phase === source.phase, 'Generated walkthrough phase differs from source phase');
  write(`Walkthrough sources valid offline: ${source.quests.length} source quest records; phase ${source.phase}.`);
}

export function parseWalkthroughSyncArgs(argv = process.argv.slice(2)) {
  assert(Array.isArray(argv), 'Walkthrough sync arguments must be an array');
  let mode = 'check';
  let modeSpecified = false;
  const questIds = [];
  const selectedSlugs = new Set();

  for (const argument of argv) {
    if (argument === '--check' || argument === '--refresh' || argument === '--promote') {
      assert(!modeSpecified, `Unknown command: ${argument}`);
      mode = argument.slice(2);
      modeSpecified = true;
      continue;
    }
    if (typeof argument === 'string' && argument.startsWith('--quest-id=')) {
      const slug = argument.slice('--quest-id='.length);
      nonBlank(slug, 'Requested quest slug');
      assert(!selectedSlugs.has(slug), `Requested quest slug is duplicated: ${slug}`);
      selectedSlugs.add(slug);
      questIds.push(slug);
      continue;
    }
    throw new Error(`Unknown command: ${argument}`);
  }

  assert(mode === 'refresh' || questIds.length === 0, '--quest-id is valid only with --refresh');
  questIds.forEach((slug) => {
    assert(DEFAULT_MEMBERSHIP_BY_SLUG.has(slug), `Requested quest slug is not in F2P membership: ${slug}`);
  });
  return { mode, questIds };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runWalkthroughSync(parseWalkthroughSyncArgs());
}
