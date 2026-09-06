import { describe, expect, it } from 'vitest';
import { buildQuestAccess } from './questAccess';
import { QUEST_DATA, type QuestData } from '../../data/questData';
import { evaluateQuestEligibility } from '../../utils/journalStatus';
import { sourcedQuestItemPredicates } from '../../data/questOperationalSources';
import { questOperationalRequirements } from '../../data/questOperationalRequirements';
import type { UnlockState } from '../../types';

const state = (extra: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], chunks: [], ...extra,
});
const fixture = (): QuestData => ({
  ...QUEST_DATA["Cook's Assistant"], operationalRequirements: [], regions: ['Lumbridge'], accessPolicy: 'regions',
  chunkedGeography: { locations: [{ id: 'fixed', label: 'Fixed destination', chunkOptions: [{ cx: 10, cy: 10 }, { cx: 11, cy: 10 }] }], unknowns: [], groups: [{
    id: 'branch', label: 'Choose a complete route', routes: [
      { id: 'north', label: 'North', locations: [{ id: 'north-a', label: 'North start', chunkOptions: [{ cx: 20, cy: 20 }] }, { id: 'north-b', label: 'North end', chunkOptions: [{ cx: 21, cy: 20 }] }] },
      { id: 'south', label: 'South', locations: [{ id: 'south-a', label: 'South start', chunkOptions: [{ cx: 30, cy: 30 }] }, { id: 'south-b', label: 'South end', chunkOptions: [{ cx: 31, cy: 30 }] }] },
    ],
  }] },
});

describe('RuneProof quest access model', () => {
  it('requires an unlocked necklace slot to wear the Restless Ghost amulet', () => {
    const quest = QUEST_DATA['The Restless Ghost'];
    const chunks = ['50,50', '49,49', '50,49', '48,49'];
    const locked = buildQuestAccess(quest, state({ chunks }), 'chunked');
    const neck = (model: ReturnType<typeof buildQuestAccess>) => model.operations.find(item => item.predicate.kind === 'equipment' && item.predicate.slot === 'Neck');
    expect(neck(locked)).toMatchObject({ status: 'LOCKED', label: 'Necklace slot T1: wear the ghostspeak amulet' });
    expect(locked.eligibility.eligible).toBe(false);
    const unlocked = buildQuestAccess(quest, state({ chunks, equipment: { Neck: 1 } }), 'chunked');
    expect(neck(unlocked)?.status).toBe('READY');
    expect(neck(unlocked)?.label).toContain('ghostspeak amulet');
    expect(unlocked.items.some(item => item.status !== 'READY')).toBe(true);
  });

  it('uses the same typed shortcut verdict in the canonical quest and the displayed route', () => {
    const quest = { ...QUEST_DATA['Bear Your Soul'], operationalRequirements: [] };
    const points = quest.chunkedGeography!.locations.flatMap(location => location.chunkOptions.map(point => `${point.cx},${point.cy}`));
    const before = buildQuestAccess(quest, state({ chunks: [...points, '45,53'], levels: { Agility: 69 } }), 'chunked');
    expect(before.geography.status).toBe('unknown');
    expect(before.eligibility.status).toBe('UNKNOWN');
    const after = buildQuestAccess(quest, state({ chunks: [...points, '45,53'], levels: { Agility: 70 }, skills: { Agility: 1 } }), 'chunked');
    expect(after.geography.status).toBe('met');
    expect(after.eligibility.status).not.toBe('UNKNOWN');
  });
  it('requires the Ghosts Ahoy staircase object destination north of the Port Phasmatys boundary', () => {
    const quest = QUEST_DATA['Ghosts Ahoy'];
    const otherChunks = quest.locations!.filter(location => location.id !== 'ectofuntus-stairs').flatMap(location => location.chunkOptions.map(point => `${point.cx},${point.cy}`));
    const before = buildQuestAccess(quest, state({ chunks: otherChunks }), 'chunked');
    expect(before.geography.children!.find(node => node.id === 'ectofuntus-stairs')).toMatchObject({ status: 'locked', children: [{ cx: 57, cy: 55 }] });
    const after = buildQuestAccess(quest, state({ chunks: [...otherChunks, '57,55'] }), 'chunked');
    expect(after.geography.status).toBe('met');
    const standard = buildQuestAccess(quest, state({ regions: ['Port Phasmatys'] }), 'standard');
    expect(standard.geography.children!.find(node => node.id === 'ectofuntus-stairs')).toMatchObject({ status: 'met', children: [{ kind: 'area', label: 'Port Phasmatys' }] });
  });
  it('retains the identity of satisfied equipment, method and merchant gates', () => {
    const quest = fixture();
    quest.operationalRequirements = [
      { kind: 'equipment', slot: 'Weapon', tier: 1 },
      { kind: 'method', skill: 'Crafting', tier: 2 },
      { kind: 'unlock', field: 'merchants', id: 'Food Shops' },
    ];
    const locked = buildQuestAccess(quest, state()).operations;
    const ready = buildQuestAccess(quest, state({ equipment: { Weapon: 1 }, skills: { Crafting: 2 }, merchants: ['Food Shops'] })).operations;
    expect(locked.map(clause => clause.label)).toEqual(['Weapon equipment tier 1', 'Crafting method tier 2', 'Unlock: Food Shops']);
    expect(ready.map(clause => clause.label)).toEqual(locked.map(clause => clause.label));
    expect(ready.map(clause => clause.status)).toEqual(['READY', 'READY', 'READY']);
  });
  it('shows every complete permission alternative without merging their requirements', () => {
    const quest = fixture();
    quest.operationalRequirements = [{ kind: 'any', of: [
      { kind: 'all', of: [{ kind: 'method', skill: 'Crafting', tier: 2 }, { kind: 'equipment', slot: 'Weapon', tier: 1 }] },
      { kind: 'unlock', field: 'merchants', id: 'Food Shops' },
    ] }];
    const locked = buildQuestAccess(quest, state({ skills: { Crafting: 2 } })).operations[0];
    expect(locked.status).toBe('LOCKED');
    expect(locked.label).toBe('One complete alternative: (All required: Crafting method tier 2; Weapon equipment tier 1) OR (Unlock: Food Shops)');
    const ready = buildQuestAccess(quest, state({ merchants: ['Food Shops'] })).operations[0];
    expect(ready.status).toBe('READY');
    expect(ready.label).toBe(locked.label);
  });
  it('shows every quest-specific manual condition verbatim and unverified without duplicate clauses', () => {
    for (const quest of Object.values(QUEST_DATA)) {
      const access = buildQuestAccess(quest, state());
      for (const label of quest.manualRequirements ?? []) {
        const displayed = [...access.items, ...access.operations].filter(clause => clause.label === label);
        expect(displayed, `${quest.id}: ${label}`).toHaveLength(1);
        expect(displayed[0].status).not.toBe('READY');
      }
    }
    const quest = fixture();
    quest.manualRequirements = ['Use a crafting table', 'Use a crafting table'];
    quest.operationalRequirements = [{ kind: 'manual', key: 'existing-table', label: 'Use a crafting table' }];
    expect(buildQuestAccess(quest, state()).operations).toEqual([{
      id: 'existing-table', label: 'Use a crafting table', status: 'NEEDS_CONFIRMATION', predicate: quest.operationalRequirements[0],
    }]);
  });
  it('covers all 210 quests while preserving canonical verdicts in both modes', () => {
    expect(Object.values(QUEST_DATA)).toHaveLength(210);
    for (const quest of Object.values(QUEST_DATA)) for (const mode of ['standard', 'chunked']) {
      const unlocks = state();
      expect(buildQuestAccess(quest, unlocks, mode).eligibility, `${quest.id}/${mode}`).toEqual(evaluateQuestEligibility(quest, unlocks, mode));
    }
  });
  it('displays every canonical operational predicate across all 210 quests without dropping a hard gate', () => {
    for (const quest of Object.values(QUEST_DATA)) for (const mode of ['standard', 'chunked']) {
      const model = buildQuestAccess(quest, state(), mode);
      const displayed = [...model.items, ...model.operations].map(clause => JSON.stringify(clause.predicate));
      for (const predicate of questOperationalRequirements(quest)) {
        expect(displayed, `${quest.id}/${mode}: ${JSON.stringify(predicate)}`).toContain(JSON.stringify(predicate));
      }
      expect([...model.items, ...model.operations].every(clause => clause.label.trim().length > 0)).toBe(true);
    }
  });
  it('preserves fixed AND, coordinate OR, and complete route OR without mixing branches', () => {
    const quest = fixture();
    const mixed = state({ chunks: ['11,10', '20,20', '31,30'] });
    const access = buildQuestAccess(quest, mixed, 'chunked');
    expect(access.geography.kind).toBe('all');
    expect(access.geography.children![0]).toMatchObject({ kind: 'any', status: 'met' });
    expect(access.geography.children![1]).toMatchObject({ kind: 'any', status: 'locked', children: [{ kind: 'all' }, { kind: 'all' }] });
    expect(access.eligibility.status).toBe('LOCKED_REGION');
    const complete = buildQuestAccess(quest, state({ chunks: ['11,10', '20,20', '21,20'] }), 'chunked');
    expect(complete.geography.status).toBe('met');
    expect(complete.eligibility.status).toBe('AVAILABLE');
  });
  it('shows Standard area permissions independently of exact Chunked ownership', () => {
    const quest = fixture();
    const unlocks = state({ regions: ['Lumbridge'] });
    expect(buildQuestAccess(quest, unlocks, 'standard').geography.children).toEqual([{ id: 'region:0', label: 'Lumbridge', kind: 'area', status: 'met' }]);
    expect(buildQuestAccess(quest, unlocks, 'chunked').geography.status).toBe('locked');
  });
  it('keeps route uncertainty unknown even when every destination is owned', () => {
    const quest = fixture();
    quest.chunkedGeography!.unknowns.push('An instance entrance is unverified');
    const access = buildQuestAccess(quest, state({ chunks: ['11,10', '20,20', '21,20'] }), 'chunked');
    expect(access.geography.status).toBe('unknown');
    expect(access.eligibility.status).toBe('UNKNOWN');
  });
  it('retains complete sourced item quantities and alternatives as clauses, without inferred possession', () => {
    for (const id of ['Demon Slayer', 'Priest in Peril', 'The Restless Ghost']) {
      const access = buildQuestAccess(QUEST_DATA[id], state());
      expect(access.items.map(item => item.predicate)).toEqual(sourcedQuestItemPredicates(id));
      expect(access.items.every(item => item.status !== 'READY')).toBe(true);
      expect(access.items.every(item => item.sourceText && !item.sourceText.includes('satisfy the applicable required route legally'))).toBe(true);
    }
    expect(buildQuestAccess(QUEST_DATA['Demon Slayer'], state()).items.some(item => item.label.includes('25 bones'))).toBe(true);
  });
});
