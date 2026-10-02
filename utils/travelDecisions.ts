/**
 * Each travel option's decision for a run, as the export sends it: LOCKED
 * while an unlock the method needs is locked, whatever the destination;
 * otherwise, with one destination, that chunk's entry; with several or none,
 * UNKNOWN, since the choice comes after the click. An option's own quests
 * come on top: one not done makes it NOT_READY (a locked destination stays
 * LOCKED), and one it needs only started leaves an allowed option UNKNOWN.
 */
import { DIARY_DATA, type DiaryTier } from '../data/diaryData';
import { ARCANA_LIST, MOBILITY_LIST, POH_LIST } from '../data/items';
import type { TravelMatch, TravelMethod, TravelOption } from '../data/travelMethods';
import type { UnlockState } from '../types';
import type { PermissionStatus } from './chunkPermissionSnapshot';

export interface TravelOptionDecision {
  to: string[];
  status: PermissionStatus;
  reason?: string;
}

export interface TravelMethodDecision {
  label: string;
  unlocks: string[];
  match: TravelMatch;
  options: Record<string, TravelOptionDecision>;
  advisory?: boolean;
  codes?: Record<string, TravelOptionDecision>;
}

export interface TravelContext {
  /** Quests are the run's finished ones; without them, an option that needs a quest isn't allowed. */
  unlocks: Pick<UnlockState, 'mobility' | 'arcana' | 'housing' | 'diaries'> & { quests?: readonly string[] };
  /** Each chunk's entry for the run, as rules.chunkEntries has it. */
  entries: Readonly<Record<string, PermissionStatus>>;
  /** Why a chunk's entry isn't ALLOWED, where the snapshots say. */
  reasons?: Readonly<Record<string, string>>;
}

/** Whether the run has a travel unlock, looked up in the list it belongs to. */
export function hasTravelUnlock(unlocks: Pick<UnlockState, 'mobility' | 'arcana' | 'housing'>, id: string): boolean {
  if (MOBILITY_LIST.includes(id)) return unlocks.mobility.includes(id);
  if (ARCANA_LIST.includes(id)) return unlocks.arcana.includes(id);
  if (POH_LIST.includes(id)) return unlocks.housing.includes(id);
  return false;
}

const TIERS: readonly DiaryTier['tier'][] = ['Easy', 'Medium', 'Hard', 'Elite'];
const diaryOf = (tier: DiaryTier) => tier.id.slice(0, -tier.tier.length).trim();

/**
 * Whether the run has done a diary tier, or a harder tier of the same diary:
 * claiming a tier's rewards needs every easier tier done. Counting a harder
 * tier only ever adds a destination, which makes the decision more cautious.
 */
export function hasDiaryTier(done: readonly string[], diary: string): boolean {
  const wanted = DIARY_DATA[diary];
  if (!wanted) return done.includes(diary);
  return done.some((id) => {
    const tier = DIARY_DATA[id];
    return id === diary || (!!tier && diaryOf(tier) === diaryOf(wanted)
      && TIERS.indexOf(tier.tier) > TIERS.indexOf(wanted.tier));
  });
}

const DESTINATION_REASONS: Record<Exclude<PermissionStatus, 'ALLOWED'>, string> = {
  LOCKED: 'The destination is locked',
  NOT_READY: "The destination isn't ready",
  UNKNOWN: "The destination's access needs review",
};

function decideOption(method: TravelMethod, option: TravelOption, context: TravelContext): TravelOptionDecision {
  // A diary that lets the player switch the destination adds the other one.
  const switchable = option.afterDiary && hasDiaryTier(context.unlocks.diaries, option.afterDiary.diary)
    ? option.afterDiary.to : [];
  const to = [...new Set([...option.to, ...switchable])];
  const missing = method.unlocks.filter((id) => !hasTravelUnlock(context.unlocks, id));
  if (missing.length) return { to, status: 'LOCKED', reason: `Needs ${missing.join(' and ')}` };
  const destination = decideDestination(to, context);
  const done = context.unlocks.quests ?? [];
  const unfinished = (option.quests ?? []).filter((quest) => !done.includes(quest));
  if (unfinished.length && destination.status !== 'LOCKED') {
    return { to, status: 'NOT_READY', reason: `Needs ${unfinished.join(' and ')}` };
  }
  const unstarted = (option.startedQuests ?? []).filter((quest) => !done.includes(quest));
  if (unstarted.length && destination.status === 'ALLOWED') {
    return { to, status: 'UNKNOWN', reason: `Needs ${unstarted.join(' and ')} started` };
  }
  return destination;
}

function decideDestination(to: string[], context: TravelContext): TravelOptionDecision {
  if (to.length !== 1) {
    return { to, status: 'UNKNOWN', reason: to.length ? 'Goes to one of several places' : 'Where it goes is unknown' };
  }
  const status = context.entries[to[0]] ?? 'UNKNOWN';
  if (status === 'ALLOWED') return { to, status };
  return { to, status, reason: context.reasons?.[to[0]] ?? DESTINATION_REASONS[status] };
}

const decideAll = (method: TravelMethod, options: Readonly<Record<string, TravelOption>>, context: TravelContext) =>
  Object.fromEntries(Object.entries(options).map(([text, option]) => [text, decideOption(method, option, context)]));

/** Every method's decisions for the run, keyed by method id. */
export function travelDecisions(
  methods: readonly TravelMethod[],
  context: TravelContext,
): Record<string, TravelMethodDecision> {
  return Object.fromEntries(methods.map((method) => [method.id, {
    label: method.label,
    unlocks: [...method.unlocks],
    match: method.match,
    options: decideAll(method, method.options, context),
    ...(method.advisory ? { advisory: true } : {}),
    ...(method.codes ? { codes: decideAll(method, method.codes, context) } : {}),
  }]));
}
