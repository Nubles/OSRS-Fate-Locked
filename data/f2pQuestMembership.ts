import reviewedMembership from './sources/f2p-quest-membership.json';

export interface F2PQuestMembership {
  readonly questId: string;
  readonly slug: string;
  readonly kind: 'quest' | 'miniquest';
  readonly wave: 1 | 2 | 3 | 4 | 5;
  readonly progressionPriority: number;
  readonly wikiTitle: string;
  readonly evidenceQuestId: string;
}

const EXPECTED_QUEST_IDS = [
  "Cook's Assistant", 'Sheep Shearer', 'The Restless Ghost', 'Rune Mysteries', 'Imp Catcher',
  "Daddy's Home", 'X Marks the Spot', 'Romeo & Juliet', 'Demon Slayer', 'Ernest the Chicken',
  "Doric's Quest", 'Goblin Diplomacy', "Witch's Potion", "The Knight's Sword", "Black Knights' Fortress",
  'Vampyre Slayer', 'Prince Ali Rescue', "Pirate's Treasure", 'Misthalin Mystery', 'Below Ice Mountain',
  'The Corsair Curse', 'Shield of Arrav', 'Dragon Slayer I',
] as const;

const EXPECTED_SLUGS = [
  'cooks-assistant', 'sheep-shearer', 'the-restless-ghost', 'rune-mysteries', 'imp-catcher',
  'daddys-home', 'x-marks-the-spot', 'romeo-juliet', 'demon-slayer', 'ernest-the-chicken',
  'dorics-quest', 'goblin-diplomacy', 'witchs-potion', 'the-knights-sword', 'black-knights-fortress',
  'vampyre-slayer', 'prince-ali-rescue', 'pirates-treasure', 'misthalin-mystery', 'below-ice-mountain',
  'the-corsair-curse', 'shield-of-arrav', 'dragon-slayer-i',
] as const;

const EXPECTED_KINDS = [
  'quest', 'quest', 'quest', 'quest', 'quest', 'miniquest', 'quest', 'quest', 'quest', 'quest',
  'quest', 'quest', 'quest', 'quest', 'quest', 'quest', 'quest', 'quest', 'quest', 'quest',
  'quest', 'quest', 'quest',
] as const;

const EXPECTED_WAVES = [
  1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5,
] as const;

const EVIDENCE_FILES = [
  'data/sources/quest-list.json',
  'data/sources/quest-requirement-audit.json',
] as const;

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[], label: string): void => {
  const allowed = new Set(keys);
  const unexpected = Object.keys(value).filter(key => !allowed.has(key));
  assert(unexpected.length === 0, `${label} has unexpected field(s): ${unexpected.join(', ')}`);
};

const hasDenseIndexes = (value: readonly unknown[]): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

const nonBlankString: (value: unknown, label: string) => asserts value is string = (value, label) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export function validateF2PQuestMembership(value: unknown): readonly F2PQuestMembership[] {
  assert(isRecord(value), 'F2P membership snapshot must be an object');
  hasOnlyKeys(value, ['schemaVersion', 'reviewedAt', 'evidenceFiles', 'quests'], 'F2P membership snapshot');
  assert(value.schemaVersion === 1, 'schemaVersion must be 1');
  assert(value.reviewedAt === '2026-08-21', 'reviewedAt must be 2026-08-21');
  assert(Array.isArray(value.evidenceFiles), 'evidenceFiles must be an array');
  assert(hasDenseIndexes(value.evidenceFiles), 'evidenceFiles must be a dense array');
  assert(value.evidenceFiles.length === EVIDENCE_FILES.length
    && value.evidenceFiles.every((file, index) => file === EVIDENCE_FILES[index]),
  'evidenceFiles must exactly reference the reviewed quest sources');
  assert(Array.isArray(value.quests), 'quests must be an array');
  assert(hasDenseIndexes(value.quests), 'quests must be a dense array');
  assert(value.quests.length === EXPECTED_QUEST_IDS.length, 'quests must contain exactly 23 entries');

  const entries: F2PQuestMembership[] = [];
  const questIds = new Set<string>();
  const slugs = new Set<string>();

  value.quests.forEach((rawEntry, index) => {
    const label = `quests[${index}]`;
    assert(isRecord(rawEntry), `${label} must be an object`);
    hasOnlyKeys(rawEntry, [
      'questId', 'slug', 'kind', 'wave', 'progressionPriority', 'wikiTitle', 'evidenceQuestId',
    ], label);
    nonBlankString(rawEntry.questId, `${label}.questId`);
    nonBlankString(rawEntry.slug, `${label}.slug`);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawEntry.slug), `${label}.slug must be lowercase hyphenated text`);
    assert(rawEntry.kind === 'quest' || rawEntry.kind === 'miniquest', `${label}.kind must be quest or miniquest`);
    const wave = rawEntry.wave;
    const progressionPriority = rawEntry.progressionPriority;
    assert(typeof wave === 'number' && Number.isInteger(wave) && wave >= 1 && wave <= 5,
      `${label}.wave must be one of 1, 2, 3, 4, or 5`);
    assert(typeof progressionPriority === 'number'
      && Number.isInteger(progressionPriority) && progressionPriority > 0,
      `${label}.progressionPriority must be a positive integer`);
    nonBlankString(rawEntry.wikiTitle, `${label}.wikiTitle`);
    nonBlankString(rawEntry.evidenceQuestId, `${label}.evidenceQuestId`);

    const questId = rawEntry.questId;
    const slug = rawEntry.slug;
    assert(!questIds.has(questId), `duplicate questId: ${questId}`);
    assert(!slugs.has(slug), `duplicate slug: ${slug}`);
    questIds.add(questId);
    slugs.add(slug);

    assert(progressionPriority === index + 1,
      `progressionPriority must be contiguous starting at 1 (expected ${index + 1} at ${label})`);
    assert(questId === EXPECTED_QUEST_IDS[index], `${label}.questId is not in the approved order`);
    assert(slug === EXPECTED_SLUGS[index], `${label}.slug does not match the approved quest slug`);
    assert(rawEntry.kind === EXPECTED_KINDS[index], `${label}.kind does not match the approved classification`);
    assert(wave === EXPECTED_WAVES[index], `${label}.wave does not match the approved wave`);
    assert(rawEntry.wikiTitle === `${EXPECTED_QUEST_IDS[index]}/Quick guide`,
      `${label}.wikiTitle must be the exact quest Quick guide title`);
    assert(rawEntry.evidenceQuestId === EXPECTED_QUEST_IDS[index]
      && rawEntry.evidenceQuestId === questId,
    `${label}.evidenceQuestId must match questId`);

    entries.push({
      questId,
      slug,
      kind: rawEntry.kind,
      wave: wave as F2PQuestMembership['wave'],
      progressionPriority,
      wikiTitle: rawEntry.wikiTitle,
      evidenceQuestId: rawEntry.evidenceQuestId,
    });
  });

  return entries;
}

export const f2pQuestMembership: readonly F2PQuestMembership[] = deepFreeze(
  validateF2PQuestMembership(reviewedMembership),
);

const membershipByQuestId = new Map(f2pQuestMembership.map(entry => [entry.questId, entry]));
const membershipBySlug = new Map(f2pQuestMembership.map(entry => [entry.slug, entry]));

export function f2pQuestMembershipFor(questId: string): F2PQuestMembership | undefined {
  return membershipByQuestId.get(questId);
}

export function f2pQuestMembershipBySlug(slug: string): F2PQuestMembership | undefined {
  return membershipBySlug.get(slug);
}
