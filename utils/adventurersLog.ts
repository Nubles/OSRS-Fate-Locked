/**
 * The public Adventurer's Log (#/log/<id>, components/AdventurersLog.tsx):
 * a run's shared progress summary, read from the relay's GET /p/<id> when
 * its player made it public. Everything here comes from the network, so each
 * field is checked before the page renders it.
 */
import { decodeChunkMap } from './chunkMapBits';

/** A run id as the tracker makes it (utils/progressShareRecord.ts). */
export const LOG_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export interface AdventurersLogData {
  mode: string;
  modeId: string;
  account?: string;
  startedAt?: number;
  areas: { unit: 'areas' | 'chunks'; unlocked: number; total: number };
  chunks: { unlocked: number; total: number };
  quests: { done: number; total: number };
  diaryTasks: { done: number; total: number };
  ca: { points: number; tier: string | null };
  recent: { text: string; at: number }[];
  /** Owned chunks as "cx,cy", or null when the summary carries no map. */
  map: Set<string> | null;
  updatedAt: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const time = (value: unknown): value is number => Number.isFinite(value) && (value as number) > 0;

const tally = <K extends string>(value: unknown, key: K): ({ [P in K]: number } & { total: number }) | null => {
  if (!isRecord(value) || !count(value[key]) || !count(value.total)) return null;
  return { [key]: Math.min(value[key] as number, value.total), total: value.total } as { [P in K]: number } & { total: number };
};

/** The log in a relay answer, or null when it isn't a public summary. */
export function parseAdventurersLog(body: unknown): AdventurersLogData | null {
  if (!isRecord(body) || !isRecord(body.snapshot)) return null;
  const s = body.snapshot;
  if (s.v !== 1 || s.public !== true || !text(s.mode, 40) || !text(s.modeId, 24)) return null;
  if (!isRecord(s.areas) || (s.areas.unit !== 'areas' && s.areas.unit !== 'chunks')) return null;
  const areas = tally(s.areas, 'unlocked');
  const chunks = tally(s.chunks, 'unlocked');
  const quests = tally(s.quests, 'done');
  const diaryTasks = tally(s.diaryTasks, 'done');
  if (!areas || !chunks || !quests || !diaryTasks || !isRecord(s.ca) || !count(s.ca.points)) return null;
  const recent = Array.isArray(s.recent)
    ? s.recent.filter((r): r is { text: string; at: number } => isRecord(r) && text(r.text, 120) && time(r.at)).slice(0, 5)
    : [];
  return {
    mode: s.mode,
    modeId: s.modeId,
    ...(text(s.account, 32) ? { account: s.account } : {}),
    ...(time(s.startedAt) ? { startedAt: s.startedAt } : {}),
    areas: { unit: s.areas.unit, ...areas },
    chunks,
    quests,
    diaryTasks,
    ca: { points: s.ca.points, tier: text(s.ca.tier, 24) ? s.ca.tier : null },
    recent: recent.map(r => ({ text: r.text, at: r.at })),
    map: typeof s.map === 'string' ? decodeChunkMap(s.map) : null,
    updatedAt: time(body.updatedAt) ? body.updatedAt : null,
  };
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago", else the date. */
export function sinceText(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return plural(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return plural(hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 30) return plural(days, 'day');
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export type LogFetch =
  | { kind: 'found'; log: AdventurersLogData }
  | { kind: 'missing' }
  | { kind: 'error' };

/** Read run `id`'s public log from the relay at `base`. */
export async function fetchAdventurersLog(base: string, id: string): Promise<LogFetch> {
  if (!LOG_ID_RE.test(id)) return { kind: 'missing' };
  try {
    const response = await fetch(`${base}/p/${id}`);
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const log = parseAdventurersLog(await response.json());
    return log ? { kind: 'found', log } : { kind: 'missing' };
  } catch {
    return { kind: 'error' };
  }
}
