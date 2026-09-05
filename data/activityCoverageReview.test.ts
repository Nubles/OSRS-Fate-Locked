import { describe, expect, it } from 'vitest';
import { ACTIVITY_REQUIREMENTS, getActivityReq } from './activityRequirements';
import { evaluateActivityReadiness } from '../utils/activityReadiness';
import { evaluatePredicate } from '../utils/requirementPredicates';
import type { UnlockState } from '../types';
const state = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {}, ...over,
});
const predicates = (name: string, confirmations: Record<string, boolean> = {}, over: Partial<UnlockState> = {}) =>
  evaluatePredicate({ kind: 'all', of: ACTIVITY_REQUIREMENTS[name].predicates ?? [] }, { unlocks: state(over), confirmations });
describe('activity use and acquisition are separate', () => {
  it('does not accept inherited object properties as reviewed activities', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) expect(getActivityReq(key)).toBeUndefined();
  });
  it.each(['Restoration Pools', 'Kitchen', 'Portal Nexus', 'Mounted Glory', 'Master STASH'])('requires an actual usable %s instead of a construction level', name => {
    expect(evaluateActivityReadiness(true, getActivityReq(name), state({ levels: { Construction: 99 } })).status).toBe('NEEDS_CONFIRMATION');
    expect(ACTIVITY_REQUIREMENTS[name].skills).toBeUndefined();
  });
  it('permits existing POH facilities at low construction when their use is confirmed', () => {
    expect(predicates('Restoration Pools', { 'house-feature:Restoration Pools': true }, { levels: { Construction: 1 } }).status).toBe('READY');
  });
  it.each(['Fish Barrel', 'Tackle Box', 'Meat Pouch', 'Flamtaer Bag', "Gricoller's Can"] )('%s needs the item, not its reward-source levels', name => {
    expect(ACTIVITY_REQUIREMENTS[name].skills).toBeUndefined();
    expect(evaluateActivityReadiness(true, getActivityReq(name), state()).status).toBe('NEEDS_CONFIRMATION');
  });
  it('uses the lowered colossal pouch level without inventing possession', () => {
    expect(ACTIVITY_REQUIREMENTS['Colossal Pouch'].skills).toEqual({ Runecraft: 25 });
    expect(evaluateActivityReadiness(true, getActivityReq('Colossal Pouch'), state({ levels: { Runecraft: 24 } })).status).toBe('NOT_READY');
    expect(evaluateActivityReadiness(true, getActivityReq('Colossal Pouch'), state({ levels: { Runecraft: 25 } })).status).toBe('NEEDS_CONFIRMATION');
    expect(predicates('Colossal Pouch', { 'item:colossal-pouch:hold': true }).status).toBe('READY');
  });
  it('keeps gardening species levels and seed/material facts distinct', () => {
    expect(ACTIVITY_REQUIREMENTS['Anima'].skills).toEqual({ Farming: 76 });
    expect(ACTIVITY_REQUIREMENTS['Vinery'].skills).toEqual({ Farming: 36 });
    expect(ACTIVITY_REQUIREMENTS['Coral Nursery'].skills).toEqual({ Farming: 28 });
  });
  it('does not require fresh general stats or a carried frozen key for an open Nex prison', () => {
    expect(ACTIVITY_REQUIREMENTS.Nex.skills).toBeUndefined();
    expect(predicates('Nex', { 'nex-frozen-door': true, 'nex-prison-route': true, 'nex-essence': true }).status).toBe('READY');
    expect(predicates('Nex', { 'nex-frozen-door': true, 'nex-prison-route': true, 'nex-essence': false, 'item:ecumenical-key:consume': false }).status).toBe('LOCKED');
  });
  it('keeps Calvarion diary and boss-task alternatives independent', () => {
    const fee = { 'wilderness-boss-fee': true };
    expect(predicates("Calvar'ion", fee, { diaries: ['Wilderness Hard'] }).status).toBe('READY');
    expect(predicates("Calvar'ion", { ...fee, 'slayerTask:vetion-boss': true }).status).toBe('READY');
    expect(predicates("Calvar'ion", { ...fee, 'slayerTask:vetion-boss': false }, { diaries: ['Wilderness Medium'] }).status).toBe('LOCKED');
  });
  it('allows partial Pyramid Plunder quest access but does not assume it', () => {
    expect(predicates('Pyramid Plunder').status).toBe('NEEDS_CONFIRMATION');
    expect(predicates('Pyramid Plunder', { 'sophanem-access': true }).status).toBe('READY');
  });
  it('keeps the unverified Aquarium mapping unknown', () => {
    expect(evaluateActivityReadiness(true, getActivityReq('Aquarium'), state({ levels: { Construction: 99 } })).status).toBe('UNKNOWN');
  });
});
