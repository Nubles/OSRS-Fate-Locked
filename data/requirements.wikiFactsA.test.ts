// Wiki facts for the first half of the Strategy Guide table (data/requirements.ts),
// checked against the OSRS Wiki in November 2026. Each block names the page it
// follows, so a later edit that drifts from the Wiki fails here.
import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { TableType } from '../types';
import { analyzeRequirement } from '../components/StrategyGuide';
import { createFreshState } from '../context/GameContext';
import { REGIONS_LIST, SKILLS_LIST } from './items';

const S = STRATEGY_DATABASE;
// Every region and skill held at 99: only quests and unlocks can block.
const maxed = (quests: string[] = []) => {
  const u = createFreshState().unlocks;
  u.regions = [...REGIONS_LIST];
  u.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
  u.levels = Object.fromEntries(SKILLS_LIST.map(s => [s, 99]));
  u.quests = quests;
  return u;
};

describe('Calcified Rocks (Wiki: Cam Torum mine, Calcified rocks)', () => {
  it('opens with Cam Torum, partway through Perilous Moons', () => {
    expect(S['Calcified Rocks'].quests).toEqual(['Perilous Moons']);
    expect(S['Calcified Rocks'].skills).toEqual({ Mining: 41 });
    expect(analyzeRequirement(S['Calcified Rocks'], maxed(['Children of the Sun']), 'vanilla').missingQuests).toEqual(['Perilous Moons']);
  });
  it('names the real yields', () => {
    expect(S['Calcified Rocks'].description).toMatch(/blessed bone shards/);
    expect(S['Calcified Rocks'].description).toMatch(/calcified deposits/);
    expect(S['Calcified Rocks'].description).not.toMatch(/Calcified shards/);
  });
});

describe('Dark Beasts (Wiki: Dark beast, Mourner Tunnels)', () => {
  it('live in the Mourner Tunnels and the Iorwerth Dungeon, behind Mourning\'s End Part II', () => {
    expect(S['Dark Beasts'].regions).toEqual(['Kandarin', 'Tirannwn']);
    expect(S['Dark Beasts'].quests).toEqual(["Mourning's End Part II"]);
    expect(S['Dark Beasts'].skills).toEqual({ Slayer: 90 });
    expect(analyzeRequirement(S['Dark Beasts'], maxed(), 'vanilla').isFullyPlayable).toBe(false);
  });
});

describe('Ver Sinhaza Bank (Wiki: Ver Sinhaza, List of banks)', () => {
  it('needs only Priest in Peril; A Taste of Hope only adds the medallion teleport', () => {
    expect(S['Ver Sinhaza Bank'].quests).toEqual(['Priest in Peril']);
    expect(analyzeRequirement(S['Ver Sinhaza Bank'], maxed(['Priest in Peril']), 'vanilla').missingQuests).toEqual([]);
  });
});

