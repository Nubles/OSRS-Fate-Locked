import generatedCatalogue from './questWalkthroughs.generated.json';
import { f2pQuestMembership } from './f2pQuestMembership';
import { canonicalItemKey, chunkKey, type ChunkKey } from '../utils/questRoutes/model';
import type {
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  WalkthroughActionKind,
  WalkthroughConfidence,
  WalkthroughEntityRef,
  WalkthroughLocationDirective,
} from '../utils/questWalkthroughs/model';
import { collectWalkthroughEntityRequests } from '../utils/questWalkthroughs/entityRequests';

const LEGACY_QUEST_ID = 'Elemental Workshop I';
const F2P_QUEST_IDS = new Set(f2pQuestMembership.map(entry => entry.questId));
const ACTION_KINDS = new Set<WalkthroughActionKind>([
  'TALK_TO', 'ACQUIRE', 'USE_ITEM', 'INTERACT_OBJECT', 'KILL', 'TRAVEL', 'DIALOGUE', 'INFORMATION',
]);
const CONFIDENCES = new Set<WalkthroughConfidence>(['EXACT', 'REVIEWED', 'AMBIGUOUS', 'UNMAPPED']);

interface RawCatalogue {
  readonly phase: 'REVIEWED';
  readonly walkthroughs: readonly QuestWalkthroughDefinition[];
}

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const nonBlank: (value: unknown, label: string) => asserts value is string = (value, label) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must not be blank`);
};

const positiveInteger: (value: unknown, label: string) => asserts value is number = (value, label) => {
  assert(Number.isInteger(value) && (value as number) > 0, `${label} must be a positive integer`);
};

const validateEntity: (value: unknown, label: string) => asserts value is WalkthroughEntityRef = (value, label) => {
  assert(isRecord(value), `${label} must be an entity`);
  assert(value.kind === 'npc' || value.kind === 'object', `${label} kind is invalid`);
  nonBlank(value.name, `${label} name`);
};

const validateChunk: (value: unknown) => asserts value is ChunkKey = (value) => {
  nonBlank(value, 'chunk');
  const match = /^(-?\d+),(-?\d+)$/.exec(value);
  assert(match !== null, 'chunk must be a canonical coordinate key');
  assert(chunkKey(Number(match[1]), Number(match[2])) === value, 'chunk must be a canonical coordinate key');
};

const validateChunks: (value: unknown, label: string) => asserts value is readonly ChunkKey[] = (value, label) => {
  assert(Array.isArray(value) && value.length > 0, `${label} must contain chunks`);
  const chunks = new Set<string>();
  value.forEach((chunk) => {
    validateChunk(chunk);
    assert(!chunks.has(chunk), `duplicate ${label} chunk`);
    chunks.add(chunk);
  });
};

const positiveFinite = (value: unknown, label: string): void => {
  assert(typeof value === 'number' && Number.isFinite(value) && value > 0, `${label} must be a positive finite number`);
};

const validateItem = (value: unknown): void => {
  assert(isRecord(value), 'walkthrough item must be an object');
  assert(isRecord(value.item), 'walkthrough item reference is required');
  nonBlank(value.item.key, 'item key');
  nonBlank(value.item.name, 'item name');
  assert(value.item.key === canonicalItemKey(value.item.name), 'item key must be canonical');
  positiveFinite(value.quantity, 'item quantity');
  assert(value.supplyPolicy === 'PLAYER_OBTAINED' || value.supplyPolicy === 'QUEST_PROVIDED', 'item supply policy is invalid');
};

const validateGate = (value: unknown): void => {
  assert(isRecord(value), 'route gate must be an object');
  nonBlank(value.label, 'route gate label');
  switch (value.type) {
    case 'QUEST':
      nonBlank(value.questId, 'quest gate id');
      return;
    case 'SKILL':
      nonBlank(value.skill, 'skill gate skill');
      positiveFinite(value.level, 'skill gate level');
      return;
    case 'UNLOCK':
      assert(['guilds', 'merchants', 'minigames', 'mobility', 'slayerUnlocks'].includes(value.category as string), 'unlock gate category is invalid');
      nonBlank(value.id, 'unlock gate id');
      return;
    case 'UNRESOLVED':
      nonBlank(value.raw, 'unresolved gate raw');
      return;
    default:
      throw new Error('route gate type is invalid');
  }
};
const validateLocation: (value: unknown, confidence: WalkthroughConfidence) => asserts value is WalkthroughLocationDirective = (value, confidence) => {
  assert(isRecord(value), 'location is required');
  switch (value.kind) {
    case 'EXPLICIT_CHUNKS':
      validateChunks(value.chunks, 'explicit location');
      assert(confidence !== 'AMBIGUOUS' && confidence !== 'UNMAPPED', `${confidence.toLowerCase()} action cannot claim authoritative chunks`);
      assert(confidence !== 'REVIEWED', 'reviewed action requires reviewer evidence');
      return;
    case 'EXACT_ENTITY':
      validateEntity(value.entity, 'exact entity');
      assert(confidence !== 'REVIEWED', 'reviewed action requires reviewer evidence');
      return;
    case 'INHERITED_TARGET':
      validateEntity(value.targetEntity, 'inherited target');
      nonBlank(value.sourceActionId, 'inherited target source action id');
      assert(confidence !== 'REVIEWED', 'reviewed action requires reviewer evidence');
      return;
    case 'REVIEWED_ALIAS':
      nonBlank(value.alias, 'reviewed alias');
      validateChunks(value.chunks, 'reviewed alias');
      nonBlank(value.reviewer, 'reviewed reviewer');
      nonBlank(value.reviewedAt, 'reviewed reviewedAt');
      nonBlank(value.evidence, 'reviewed evidence');
      nonBlank(value.rationale, 'reviewed rationale');
      assert(confidence === 'REVIEWED', 'reviewed alias requires REVIEWED confidence');
      return;
    case 'NONE':
      assert(confidence !== 'REVIEWED', 'reviewed action requires reviewer evidence');
      return;
    default:
      throw new Error('invalid location directive');
  }
};

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

// A compact synchronous SHA-256 implementation keeps module-load validation browser-safe.
const sha256Hex = (input: string): string => {
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array<number>(64).fill(0);
    for (let index = 0; index < 16; index += 1) {
      words[index] = (bytes[offset + index * 4] << 24) | (bytes[offset + index * 4 + 1] << 16)
        | (bytes[offset + index * 4 + 2] << 8) | bytes[offset + index * 4 + 3];
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choose + constants[index] + words[index]) | 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map(value => (value >>> 0).toString(16).padStart(8, '0')).join('');
};

const definitionPayload = (definition: Record<string, unknown>): Record<string, unknown> => {
  const { revision: _revision, ...payload } = definition;
  return payload;
};

const validateDefinition = (value: unknown, phase: RawCatalogue['phase']): QuestWalkthroughDefinition => {
  assert(isRecord(value), 'walkthrough definition must be an object');
  nonBlank(value.questId, 'quest id');
  assert(F2P_QUEST_IDS.has(value.questId) || value.questId === LEGACY_QUEST_ID, `unsupported quest ID: ${value.questId}`);
  assert(value.releaseStatus === 'PREVIEW_ONLY' || value.releaseStatus === 'APPROVED', 'invalid release status');
  assert(isRecord(value.source), 'source is required');
  nonBlank(value.source.wikiTitle, 'wiki title');
  nonBlank(value.source.wikiRevision, 'wiki revision');
  nonBlank(value.source.wikiRevisionTimestamp, 'wiki revision timestamp');
  assert(/^\d{4}-\d{2}-\d{2}T/.test(value.source.wikiRevisionTimestamp), 'wiki revision timestamp is invalid');
  nonBlank(value.source.wikiUrl, 'wiki URL');
  let wikiUrl: URL;
  try {
    wikiUrl = new URL(value.source.wikiUrl);
  } catch {
    throw new Error('wiki URL is invalid');
  }
  assert(wikiUrl.origin === 'https://oldschool.runescape.wiki', 'wiki URL must use the Old School RuneScape Wiki origin');
  const wikiPath = `/w/${value.source.wikiTitle.split('/').map(part => encodeURIComponent(part.replace(/\s+/g, '_')).replace(/'/g, '%27')).join('/')}`;
  assert(wikiUrl.pathname === wikiPath, 'wiki URL must match the source wiki title');
  assert(wikiUrl.searchParams.get('oldid') === value.source.wikiRevision, 'wiki URL must be a permanent URL for the source revision');
  assert(value.source.wikiLicence === 'CC BY-NC-SA 3.0', 'wiki licence is invalid');
  nonBlank(value.source.wikiLicenceUrl, 'wiki licence URL');
  assert(value.source.chunkPickerRepository === 'source-chunk/chunk-picker-v2', 'chunk picker repository is invalid');
  nonBlank(value.source.chunkPickerCommit, 'chunk picker commit');
  assert(value.source.chunkPickerLicenceStatus === 'UNVERIFIED' || value.source.chunkPickerLicenceStatus === 'PERMISSION_RECORDED', 'chunk picker licence status is invalid');
  if (value.releaseStatus === 'APPROVED') {
    assert(value.source.chunkPickerLicenceStatus === 'PERMISSION_RECORDED', 'public walkthrough requires a chunk-picker permission record');
    nonBlank(value.source.permissionReference, 'chunk-picker permission reference');
  }

  assert(Array.isArray(value.sourceLines), 'source lines are required');
  assert(Array.isArray(value.actions), 'actions are required');
  assert(value.sourceLines.length > 0 && value.actions.length > 0, 'reviewed walkthrough requires source lines and actions');

  const lineIds = new Set<string>();
  value.sourceLines.forEach((line) => {
    assert(isRecord(line), 'wiki source line must be an object');
    nonBlank(line.id, 'wiki line ID');
    assert(!lineIds.has(line.id), `duplicate wiki line ID: ${line.id}`);
    lineIds.add(line.id);
    nonBlank(line.section, 'wiki line section');
    positiveInteger(line.sourceOrder, 'wiki line source order');
    nonBlank(line.rawText, 'wiki line raw text');
  });

  const actionIds = new Set<string>();
  const consumedLineIds = new Map<string, string>();
  value.actions.forEach((action) => {
    assert(isRecord(action), 'walkthrough action must be an object');
    nonBlank(action.id, 'action ID');
    assert(!actionIds.has(action.id), `duplicate action ID: ${action.id}`);
    actionIds.add(action.id);
    assert(action.section === 'PREPARE' || action.section === 'QUEST', 'invalid action section');
    positiveInteger(action.sourceOrder, 'action source order');
    assert(typeof action.kind === 'string' && ACTION_KINDS.has(action.kind as WalkthroughActionKind), 'invalid action kind');
    assert(typeof action.confidence === 'string' && CONFIDENCES.has(action.confidence as WalkthroughConfidence), 'invalid action confidence');
    nonBlank(action.displayText, 'action display text');
    assert(Array.isArray(action.rawWikiLineIds), 'action raw wiki line IDs are required');
    action.rawWikiLineIds.forEach((lineId) => {
      nonBlank(lineId, 'raw wiki line ID');
      assert(lineIds.has(lineId), `action references missing wiki line: ${lineId}`);
      assert(!consumedLineIds.has(lineId), `wiki line ${lineId} is used by more than one action`);
      consumedLineIds.set(lineId, action.id as string);
    });
    if (action.chunkPickerTaskId !== undefined) nonBlank(action.chunkPickerTaskId, 'chunk picker task ID');
    assert(Array.isArray(action.dependsOn), 'action dependencies are required');
    assert(Array.isArray(action.entities), 'action entities are required');
    action.entities.forEach((entity) => validateEntity(entity, 'action entity'));
    assert(Array.isArray(action.items), 'action items are required');
    action.items.forEach(validateItem);
    assert(Array.isArray(action.gates), 'action gates are required');
    action.gates.forEach(validateGate);
    validateLocation(action.location, action.confidence as WalkthroughConfidence);
    if (action.location.kind === 'NONE' && action.kind !== 'INFORMATION') {
      assert(
        action.confidence === 'AMBIGUOUS' || action.confidence === 'UNMAPPED',
        'spatial action without a location must remain ambiguous or unmapped',
      );
    }
  });

  lineIds.forEach((lineId) => assert(consumedLineIds.has(lineId), `wiki line ${lineId} is used by zero actions`));
  value.actions.forEach((action) => {
    (action as QuestWalkthroughActionDefinition).dependsOn.forEach((dependency) => {
      nonBlank(dependency, 'dependency ID');
      assert(actionIds.has(dependency), `missing dependency target: ${dependency}`);
    });
  });

  const actionById = new Map(value.actions.map(action => [(action as QuestWalkthroughActionDefinition).id, action as QuestWalkthroughActionDefinition]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    assert(!visiting.has(id), `dependency cycle detected at action ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    actionById.get(id)!.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  actionById.forEach((_action, id) => visit(id));

  nonBlank(value.revision, 'revision');
  const expectedRevision = sha256Hex(canonicalJson(definitionPayload(value)));
  assert(value.revision === expectedRevision && /^[a-f0-9]{64}$/.test(value.revision), 'revision must be the lowercase SHA-256 of the canonical definition payload');
  return value as unknown as QuestWalkthroughDefinition;
};

export const validateQuestWalkthroughCatalogue = (value: unknown): readonly QuestWalkthroughDefinition[] => {
  assert(isRecord(value), 'walkthrough catalogue must be an object');
  assert(value.phase === 'REVIEWED', 'walkthrough catalogue phase must be REVIEWED');
  assert(Array.isArray(value.walkthroughs), 'walkthrough catalogue walkthroughs are required');
  assert(value.walkthroughs.length > 0, 'walkthrough catalogue must contain at least one definition');
  const questIds = new Set<string>();
  const definitions = value.walkthroughs.map((definition) => {
    const parsed = validateDefinition(definition, value.phase as RawCatalogue['phase']);
    assert(!questIds.has(parsed.questId), `duplicate quest walkthrough: ${parsed.questId}`);
    questIds.add(parsed.questId);
    return parsed;
  });
  return definitions;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const questWalkthroughCatalogue: readonly QuestWalkthroughDefinition[] = deepFreeze(
  validateQuestWalkthroughCatalogue(generatedCatalogue),
);
const walkthroughByQuestId = new Map(questWalkthroughCatalogue.map(walkthrough => [walkthrough.questId, walkthrough]));

export const questWalkthroughFor = (questId: string): QuestWalkthroughDefinition | undefined => walkthroughByQuestId.get(questId);

export { collectWalkthroughEntityRequests };

export const walkthroughEntityRequestsFor = (questId: string): readonly WalkthroughEntityRef[] => {
  const definition = questWalkthroughFor(questId);
  return definition ? collectWalkthroughEntityRequests(definition) : [];
};
