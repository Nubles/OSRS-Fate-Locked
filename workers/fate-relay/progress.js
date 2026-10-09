/**
 * Shared progress: a small, readable summary of a run that a player chooses to
 * publish so the Fate Locked Discord bot can show it. It holds counts and the
 * last few unlocks, never the save, a sync code or any write token. The relay
 * keeps only the fields below, so a client can't use it to store anything else.
 */

export const PROGRESS_TTL_SECONDS = 90 * 86400;
export const MAX_PROGRESS_BYTES = 8 * 1024;
/** One publish a minute per run: each is a KV write. */
export const PROGRESS_MIN_INTERVAL_MS = 60 * 1000;
export const LINK_CODE_TTL_SECONDS = 10 * 60;
export const LINK_CODE_LENGTH = 8;
// No I, L, O or U, so a code read aloud or retyped is hard to get wrong.
export const LINK_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const MAX_RECENT_UNLOCKS = 5;

const MAX_COUNT = 1_000_000;
// The snapshot's chunk map: 48 x 34 bits (utils/progressSnapshot.ts MAP_GRID) in base64.
const CHUNK_MAP_RE = /^[A-Za-z0-9+/]{272}$/;

const object = value => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null);

const count = value => Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;

const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const timestamp = value => Number.isInteger(value) && value > 0 && value < 8.64e15;

/** `{ done, total }` with done no more than total, or null. */
const tally = (value, doneKey = 'done') => {
  const record = object(value);
  if (!record || !count(record[doneKey]) || !count(record.total) || record[doneKey] > record.total) return null;
  return { [doneKey]: record[doneKey], total: record.total };
};

/**
 * The snapshot the relay stores for `body`, keeping only known fields, or
 * null when anything required is missing or out of range.
 */
export function validProgressSnapshot(body) {
  const record = object(body);
  if (!record || record.v !== 1) return null;
  if (!text(record.mode, 40) || !text(record.modeId, 24)) return null;

  const areas = object(record.areas);
  if (!areas || (areas.unit !== 'areas' && areas.unit !== 'chunks')) return null;
  const areaTally = tally(areas, 'unlocked');
  const chunks = tally(record.chunks, 'unlocked');
  const quests = tally(record.quests);
  const diaryTasks = tally(record.diaryTasks);
  const ca = object(record.ca);
  if (!areaTally || !chunks || !quests || !diaryTasks || !ca || !count(ca.points)) return null;
  if (ca.tier !== null && !text(ca.tier, 24)) return null;

  if (!Array.isArray(record.recent) || record.recent.length > MAX_RECENT_UNLOCKS) return null;
  const recent = [];
  for (const entry of record.recent) {
    const item = object(entry);
    if (!item || !text(item.text, 120) || !timestamp(item.at)) return null;
    recent.push({ text: item.text, at: item.at });
  }

  if (record.rulesTag !== undefined && !(typeof record.rulesTag === 'string' && /^R-[0-9A-F]{4,8}$/.test(record.rulesTag))) return null;
  if (record.account !== undefined && !text(record.account, 32)) return null;
  if (record.startedAt !== undefined && !timestamp(record.startedAt)) return null;
  if (record.map !== undefined && !(typeof record.map === 'string' && CHUNK_MAP_RE.test(record.map))) return null;

  return {
    v: 1,
    mode: record.mode,
    modeId: record.modeId,
    ...(record.rulesTag !== undefined ? { rulesTag: record.rulesTag } : {}),
    ...(record.account !== undefined ? { account: record.account } : {}),
    ...(record.startedAt !== undefined ? { startedAt: record.startedAt } : {}),
    areas: { unit: areas.unit, ...areaTally },
    chunks,
    quests,
    diaryTasks,
    ca: { points: ca.points, tier: ca.tier },
    recent,
    ...(record.map !== undefined ? { map: record.map } : {}),
  };
}

/** A new link code: LINK_CODE_LENGTH symbols, each uniform over the alphabet. */
export function newLinkCode(random = bytes => crypto.getRandomValues(bytes)) {
  // 256 is a multiple of 32, so each byte's low five bits pick a symbol uniformly.
  return [...random(new Uint8Array(LINK_CODE_LENGTH))].map(byte => LINK_CODE_ALPHABET[byte & 31]).join('');
}

/**
 * A code as a player typed it, or null when it can't be one. Like a backup code it forgives
 * case, spaces and dashes, and reads O as 0 and I or L as 1.
 */
export function normalizeLinkCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return code.length === LINK_CODE_LENGTH && [...code].every(symbol => LINK_CODE_ALPHABET.includes(symbol)) ? code : null;
}

/**
 * The unlocks in `next` that `previous` didn't have yet, oldest first, for the
 * Discord bot's unlock feed. A run with no earlier snapshot has nothing new:
 * the feed starts from the first publish it can compare against, so turning
 * sharing on never posts a run's backlog.
 */
export function newUnlocksSince(previous, next) {
  if (!previous || !Array.isArray(previous.recent)) return [];
  const seen = previous.recent.reduce((latest, entry) => Math.max(latest, entry.at), 0);
  return next.recent.filter(entry => entry.at > seen).reverse();
}

/** How long a linked run's week record lasts if the weekly recap never collects it. */
export const WEEK_TTL_SECONDS = 21 * 86400;
/** Unlock names a week record keeps, newest first. */
export const WEEK_MAX_UNLOCKS = 10;
/** Runners one weekly recap covers, so it stays inside the Worker's KV limits. */
export const RECAP_MAX_RUNNERS = 200;

const weekCounts = snapshot => ({
  areas: { unlocked: snapshot.areas.unlocked, total: snapshot.areas.total },
  quests: { done: snapshot.quests.done, total: snapshot.quests.total },
});

/**
 * A linked run's week so far, for the Discord bot's weekly recap, after a
 * publish: the counts it started the week with, how many unlocks it made,
 * the newest of their names and its counts now. Null when the publish
 * changed nothing the recap shows (no unlock and no quest), so a quiet
 * publish costs no KV write.
 */
export function nextWeekRecord(record, discordId, previous, snapshot, newUnlocks, now) {
  const questsMoved = Boolean(previous) && previous.quests?.done !== snapshot.quests.done;
  if (newUnlocks.length === 0 && !questsMoved) return null;
  return {
    discordId,
    since: record?.since ?? now,
    mode: snapshot.mode,
    base: record?.base ?? weekCounts(previous ?? snapshot),
    now: weekCounts(snapshot),
    unlocks: (record?.unlocks ?? 0) + newUnlocks.length,
    recent: [...newUnlocks.map(entry => entry.text).reverse(), ...(record?.recent ?? [])].slice(0, WEEK_MAX_UNLOCKS),
  };
}

/** What the recap sends the bot for one run's week. */
export function recapRunner(record) {
  return {
    discordId: record.discordId,
    mode: record.mode,
    unlocks: record.unlocks,
    recent: record.recent,
    base: record.base,
    now: record.now,
  };
}
