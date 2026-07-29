import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import {
  selectQuestGeography,
  type QuestGeographyDisplay,
} from './questGeographyDisplay';

const place = (cx: number, cy: number, label: string) => ({
  cx, cy, label, subArea: label, region: 'Synthetic',
  unlocked: false, role: 'step' as const,
});

describe('selectQuestGeography', () => {
  it('shows only canonical locations for an exact location quest', () => {
    const result = selectQuestGeography(
      QUEST_DATA['A Porcine of Interest'],
      [
        place(48, 50, 'Draynor Village'),
        place(47, 51, 'Falador'),
        place(49, 52, 'Varrock'),
      ],
    );

    expect(result.regions).toEqual([]);
    expect(result.locations.map(location => location.label)).toEqual([
      'Draynor Village',
      'South Falador Farm',
    ]);
    expect(result.knownSteps).toEqual([]);
  });

  it('keeps partial evidence separate for a region-only quest', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      accessPolicy: 'regions' as const,
      locations: undefined,
    };
    const result = selectQuestGeography(quest, [
      place(48, 50, 'Draynor Village'),
      place(48, 50, 'South Draynor alias'),
      place(49, 52, "Champions' Guild"),
    ]);

    expect(result.regions).toEqual(['Misthalin', 'Asgarnia']);
    expect(result.locations).toEqual([]);
    expect(result.knownSteps.map(step => `${step.cx},${step.cy}`)).toEqual([
      '48,50',
      '49,52',
    ]);
  });

  it('keeps both canonical kinds and suppresses raw evidence for a combined policy', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      accessPolicy: 'regions-and-locations' as const,
    };
    const result = selectQuestGeography(quest, [
      place(49, 52, "Champions' Guild"),
    ]);

    expect(result.regions).toEqual(['Misthalin', 'Asgarnia']);
    expect(result.locations).toHaveLength(2);
    expect(result.knownSteps).toEqual([]);
  });
});
