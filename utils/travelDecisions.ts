/**
 * Each travel option's decision for a run, as the export sends it: LOCKED
 * while an unlock the method needs is locked, whatever the destination;
 * otherwise, with one destination, that chunk's entry; with several or none,
 * UNKNOWN, since the choice comes after the click.
 */
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
  unlocks: Pick<UnlockState, 'mobility' | 'arcana' | 'housing' | 'diaries'>;
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

const DESTINATION_REASONS: Record<Exclude<PermissionStatus, 'ALLOWED'>, string> = {
  LOCKED: 'The destination is locked',
  NOT_READY: "The destination isn't ready",
  UNKNOWN: "The destination's access needs review",
};

function decideOption(method: TravelMethod, option: TravelOption, context: TravelContext): TravelOptionDecision {
  // A diary that lets the player switch the destination adds the other one.
  const switchable = option.afterDiary && context.unlocks.diaries.includes(option.afterDiary.diary)
    ? option.afterDiary.to : [];
  const to = [...new Set([...option.to, ...switchable])];
  const missing = method.unlocks.filter((id) => !hasTravelUnlock(context.unlocks, id));
  if (missing.length) return { to, status: 'LOCKED', reason: `Needs ${missing.join(' and ')}` };
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
