import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { ACTIVITY_REQUIREMENTS, getActivityReq } from './activityRequirements';
import { evaluatePredicate } from '../utils/requirementPredicates';
import { evaluateActivityReadiness } from '../utils/activityReadiness';
const state = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {}, ...over,
});
const evidence = (boss: string, confirmations: Record<string, boolean> = {}, levels: Record<string, number> = {}) =>
  evaluatePredicate({ kind: 'all', of: ACTIVITY_REQUIREMENTS[boss].predicates ?? [] }, { unlocks: state({ levels }), confirmations });
describe('reviewed boss access alternatives', () => {
  it('does not infer Galvek replay access from quest completion alone', () => {
    expect(evaluateActivityReadiness(true, getActivityReq('Galvek'), state({ quests: ['Dragon Slayer II'] })).status).toBe('NEEDS_CONFIRMATION');
    expect(evidence('Galvek', { 'galvek-quest-stage': true }).status).toBe('READY');
  });
  it('requires current Guardians assignments as well as permanent rooftop access', () => {
    expect(evaluateActivityReadiness(true, getActivityReq('Grotesque Guardians'), state({ quests: ['Priest in Peril'], regions: ['Slayer Tower'], levels: { Slayer: 75 } })).status).toBe('NEEDS_CONFIRMATION');
    const confirmed = { 'guardians-rooftop-unlocked': true, 'guardians-finisher': true, 'slayerTask:gargoyles': false };
    expect(evidence('Grotesque Guardians', { ...confirmed, 'slayerTask:grotesque-guardians': false }).status).toBe('LOCKED');
    expect(evidence('Grotesque Guardians', { ...confirmed, 'slayerTask:grotesque-guardians': true }).status).toBe('READY');
  });
  it('allows the first diary kill exception but retains 93 Slayer', () => {
    expect(evidence('Thermonuclear Smoke Devil', { 'slayerTask:smoke-devils-or-thermy': false, 'thermy-first-diary-kill': true }).status).toBe('READY');
    expect(evaluateActivityReadiness(true, getActivityReq('Thermonuclear Smoke Devil'), state({ regions: ['Castle Wars'], levels: { Slayer: 92 } })).status).toBe('NOT_READY');
  });
  it('accepts each reviewed Araxxor task route', () => {
    for (const task of ['araxytes', 'spiders', 'araxxor']) expect(evidence('Araxxor', { [`slayerTask:${task}`]: true }).status).toBe('READY');
  });
  it('allows partial Regicide with sacrifice permission', () => {
    expect(evidence('Zulrah', { 'regicide-port-tyras': true, 'zulrah-sacrifice-permission': true }).status).toBe('READY');
    expect(evidence('Zulrah', { 'regicide-port-tyras': true }).status).toBe('NEEDS_CONFIRMATION');
  });
  it.each([['Obor', 'obor-gate-unlocked', 'giant-key'], ['Bryophyta', 'bryophyta-gate-unlocked', 'mossy-key']])('retains permanent %s access without fresh keys', (boss, gate, key) => {
    expect(evidence(boss, { [gate]: true, [`item:${key}:hold`]: false, 'bryophyta-growthlings': true }).status).toBe('READY');
    expect(evidence(boss, { [gate]: false, [`item:${key}:hold`]: true, 'bryophyta-growthlings': true }).status).toBe('READY');
  });
  it('requires a dark totem and active Mimic casket', () => {
    expect(evidence('Skotizo').status).toBe('NEEDS_CONFIRMATION');
    expect(evidence('Skotizo', { 'item:dark-totem:consume': false }).status).toBe('LOCKED');
    expect(evidence('Mimic', { 'item:mimic-casket:hold': true }).status).toBe('READY');
  });
  it('accepts ecumenical keys without bypassing unboostable Bandos Strength', () => {
    const confirmed = { 'gwd-troll-route': true, 'gwd-entrance-rope': true, 'gwd-Bandos-equipment': true, 'gwd-Bandos-essence': false, 'item:ecumenical-key:consume': true };
    expect(evidence('General Graardor', confirmed, { Strength: 70 }).status).toBe('READY');
    expect(evidence('General Graardor', confirmed, { Strength: 69 }).status).toBe('LOCKED');
    expect(evidence('General Graardor', { ...confirmed, 'item:ecumenical-key:consume': false }, { Strength: 70 }).status).toBe('LOCKED');
  });
  it.each([['The Royal Titans', 'Asgarnian Ice Dungeon'], ['TzHaar Fight Cave', 'Mor Ul Rek (TzHaar City)']])('does not invent combat levels for %s entry', (boss, area) => {
    expect(evaluateActivityReadiness(true, getActivityReq(boss), state({ regions: [area] })).status).toBe('READY');
    expect(evaluateActivityReadiness(false, getActivityReq(boss), state({ regions: [area] })).status).toBe('LOCKED');
  });
  it.each([['Fortis Colosseum', 'Civitas illa Fortis'], ['The Hueycoatl', 'Darkfrost']])('requires the access quest for %s', (boss, area) => {
    expect(evaluateActivityReadiness(true, getActivityReq(boss), state({ regions: [area] })).status).toBe('NOT_READY');
    expect(evaluateActivityReadiness(true, getActivityReq(boss), state({ regions: [area], quests: ['Children of the Sun'] })).status).toBe('READY');
  });
});
