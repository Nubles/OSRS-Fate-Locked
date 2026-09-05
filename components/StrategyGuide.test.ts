import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as guide from './StrategyGuide';
import { TableType } from '../types';
import { REGION_GROUPS } from '../constants';

describe('StrategyGuide requirement analysis', () => {
  it('uses actual levels for diary blockers and prophecy scoring', () => {
    const unlocks = {
      equipment: {},
      skills: { Smithing: 1 },
      levels: { Smithing: 99 },
      regions: [],
      mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
      bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
      quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    };
    const requirement = {
      id: 'Falador Easy',
      category: TableType.DIARIES,
      skills: { Smithing: 13 },
      regions: [],
      quests: [],
    };

    const analysis = (guide as any).analyzeRequirement(requirement, unlocks);
    expect(analysis.missingSkills).toEqual([]);
    expect((guide as any).calculateProphecyScore(requirement, analysis)).toBe(0);
  });

  it('keeps structured alternatives out of the missing-quest bucket', () => {
    const analysis = (guide as any).analyzeRequirement({
      id: 'Karamja Hard', category: TableType.DIARIES,
      regions: [], skills: {}, quests: [],
      alternatives: [{
        label: 'Combat level 100 or Slayer 99',
        routes: [
          {
            label: 'Combat route: Combat level 100',
            blockers: [{ kind: 'combat', label: 'Combat level 100' }],
          },
          {
            label: 'Slayer cape route: Slayer 99',
            blockers: [{ kind: 'skill', label: 'Slayer 99' }],
          },
        ],
      }],
    }, {
      skills: {}, levels: {}, regions: [], quests: [],
      bosses: [], minigames: [], guilds: [], farming: [], mobility: [], arcana: [],
      housing: [], storage: [], merchants: [],
    });

    expect(analysis.missingQuests).toEqual([]);
    expect(analysis.missingAlternatives).toHaveLength(1);

    const html = renderToStaticMarkup(React.createElement(
      (guide as any).AlternativeRequirementChip,
      { alternative: analysis.missingAlternatives[0], locked: true },
    ));
    expect(html).toContain(
      'One of: Combat route: Combat level 100 or Slayer cape route: Slayer 99',
    );
    expect(html).toContain('text-red-400');
  });

  it('requires every child area before treating a continent as reachable', () => {
    const requirement = {
      id: 'Wilderness access', category: TableType.DIARIES,
      regions: ['Wilderness'], skills: {}, quests: [],
    };
    const baseUnlocks = {
      skills: {}, levels: {}, quests: [],
      bosses: [], minigames: [], guilds: [], farming: [], mobility: [], arcana: [],
      housing: [], storage: [], merchants: [],
    };

    const partial = (guide as any).analyzeRequirement(requirement, {
      ...baseUnlocks,
      regions: REGION_GROUPS.Wilderness.slice(0, -1),
    });
    const complete = (guide as any).analyzeRequirement(requirement, {
      ...baseUnlocks,
      regions: [...REGION_GROUPS.Wilderness],
    });

    expect(partial.missingRegions).toEqual(['Wilderness']);
    expect(complete.missingRegions).toEqual([]);
  });
});
