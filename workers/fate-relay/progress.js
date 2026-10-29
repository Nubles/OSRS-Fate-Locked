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
/**
 * A publish of the summary the relay already holds writes nothing, unless
 * the stored one is this old: then it is stored again, so a shared run that
 * hasn't changed lasts its 90 days from the last time it was opened.
 */
export const PROGRESS_UNCHANGED_REFRESH_MS = 30 * 86400 * 1000;
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
  // The player's choice to show this summary as a public Adventurer's Log (GET /p/<id>).
  if (record.public !== undefined && record.public !== true) return null;

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
    ...(record.public === true ? { public: true } : {}),
  };
}

/**
 * What a public read of a stored summary shows: the summary itself when its
 * player made it a public Adventurer's Log, else null (answered as 404, the
 * same as no summary, so a private run can't be told from a missing one).
 */
export function publicProgress(stored) {
  let snapshot = null;
  try {
    snapshot = typeof stored === 'string' ? JSON.parse(stored) : null;
  } catch {
    snapshot = null;
  }
  return snapshot !== null && typeof snapshot === 'object' && snapshot.public === true ? snapshot : null;
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

/** At most this many publishes an hour may post a run's unlocks in #live-unlocks. */
export const FEED_POSTS_PER_HOUR = 10;
export const FEED_WINDOW_MS = 60 * 60 * 1000;
/** More areas or chunks than this gained since the last publish is not something the feed shows. */
export const MAX_FEED_AREA_JUMP = 10;
/** An unlock dated further ahead than this (clock skew) is not posted. */
const FEED_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * What a publish may post in the Discord feed, and the feed counter to keep
 * in the record's metadata (no extra KV write). The summary is self-reported,
 * so the relay posts only what looks like play: nothing dated in the future,
 * nothing when the area count leapt, and at most FEED_POSTS_PER_HOUR posts an
 * hour. The publish itself is never refused, and roles still follow it.
 */
export function feedForPublish(previousMetadata, previous, next, now) {
  const windowStart = Number(previousMetadata?.feedWindow);
  const inWindow = Number.isFinite(windowStart) && now - windowStart < FEED_WINDOW_MS && now >= windowStart;
  const posted = inWindow && Number.isInteger(previousMetadata?.feedPosts) ? previousMetadata.feedPosts : 0;
  const meta = { feedWindow: inWindow ? windowStart : now, feedPosts: posted };
  const fresh = newUnlocksSince(previous, next).filter(entry => entry.at <= now + FEED_CLOCK_SKEW_MS);
  if (fresh.length === 0) return { newUnlocks: [], meta, reason: null };
  const leapt = previous?.areas && next.areas.unit === previous.areas.unit
    && next.areas.unlocked - previous.areas.unlocked > MAX_FEED_AREA_JUMP;
  if (leapt) return { newUnlocks: [], meta, reason: 'jump' };
  if (posted >= FEED_POSTS_PER_HOUR) return { newUnlocks: [], meta, reason: 'rate' };
  return { newUnlocks: fresh, meta: { ...meta, feedPosts: posted + 1 }, reason: null };
}
