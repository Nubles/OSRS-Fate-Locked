import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { selectQuestGeography } from '../utils/questGeographyDisplay';
import { QuestGeographyChips } from './QuestGeographyChips';
import { QuestCard } from './QuestLog';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import type { UnlockState } from '../types';

describe('QuestGeographyChips', () => {
  it('keeps internal geography uncertainty off the complete quest card, including its Almost hint', () => {
    const state: UnlockState = {
      equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [],
      housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [],
      slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    };
    const quest = {
      ...QUEST_DATA["Cook's Assistant"], skills: {}, prereqs: [], operationalRequirements: [],
      chunkedGeography: { locations: [{ id: 'start', label: 'Start', chunkOptions: [{ cx: 50, cy: 50 }] }],
        groups: [], unknowns: ['Private geography source uncertainty'] },
    };
    const eligibility = evaluateQuestEligibility(quest, state, 'chunked');
    expect(eligibility.blockers).toContainEqual({ kind: 'requirement', label: 'Private geography source uncertainty', internalOnly: true });
    const html = renderToStaticMarkup(<QuestCard quest={{ ...quest, status: eligibility.status, eligibility }}
      unlocks={state} gameModeId="chunked" currentQP={0} onToggle={() => {}} />);
    expect(html).not.toContain('Private geography source uncertainty');
  });

  it('renders complete Chunked alternatives separately and keeps uncertainty metadata private', () => {
    const point = (id: string, cx: number) => ({ id, label: id, chunkOptions: [{ cx, cy: 50 }] });
    const quest = {
      ...QUEST_DATA["Cook's Assistant"],
      chunkedGeography: {
        locations: [point('Shared destination', 50)],
        groups: [{ id: 'routes', label: 'Choose transport', routes: [
          { id: 'north', label: 'Northern route', locations: [point('North dock', 40), point('North arrival', 41)] },
          { id: 'south', label: 'Southern route', locations: [point('South dock', 42), point('South arrival', 43)] },
          { id: 'teleport', label: 'Teleport route', locations: [], unknowns: ['Internal teleport source gap'] },
        ] }], unknowns: ['Internal geography source gap'],
      },
    };
    const display = selectQuestGeography(quest, [], 'chunked');
    expect(display.locations.map(location => location.label)).toEqual(['Shared destination']);
    expect(display.routeGroups?.[0].routes.map(route => route.locations.map(location => location.label))).toEqual([
      ['North dock', 'North arrival'], ['South dock', 'South arrival'], [],
    ]);
    const html = renderToStaticMarkup(<QuestGeographyChips display={display} completed={false} evidence={[]} />);
    expect(html).toContain('One complete route');
    const routeRows = html.match(/<div class="py-1">.*?<\/div>/g)!;
    expect(routeRows[0]).toContain('North dock');
    expect(routeRows[0]).toContain('North arrival');
    expect(routeRows[0]).not.toContain('South dock');
    expect(routeRows[1]).toContain('South dock');
    expect(routeRows[1]).toContain('South arrival');
    expect(html).not.toContain('Internal teleport source gap');
    expect(html).not.toContain('Internal geography source gap');
    expect(selectQuestGeography(quest, [], 'standard')).toEqual(selectQuestGeography(QUEST_DATA["Cook's Assistant"], [], 'standard'));
  });

  it('renders exact Porcine requirements once without broad regions or known steps', () => {
    const display = selectQuestGeography(
      QUEST_DATA['A Porcine of Interest'],
      [],
    );
    const html = renderToStaticMarkup(
      <QuestGeographyChips
        display={display}
        completed={false}
        evidence={[]}
      />,
    );

    expect(html.match(/Draynor Village/g)).toHaveLength(1);
    expect(html.match(/South Falador Farm/g)).toHaveLength(1);
    expect(html).not.toContain('Misthalin');
    expect(html).not.toContain('Asgarnia');
    expect(html).toContain('Show chunk (48, 50) on map');
    expect(html).not.toContain('Known steps');
  });

  it('retains partial evidence in the model without rendering it', () => {
    const display = selectQuestGeography(
      { ...QUEST_DATA['Getting Ahead'], accessPolicy: 'regions' },
      [{
        cx: 26, cy: 48, label: 'Civitas illa Fortis',
        subArea: 'Civitas illa Fortis', region: 'Varlamore',
        unlocked: false, role: 'step',
      }],
    );
    const html = renderToStaticMarkup(
      <QuestGeographyChips
        display={display}
        completed={false}
        evidence={[]}
      />,
    );

    expect(display.knownSteps).toHaveLength(1);
    expect(display.knownSteps[0].label).toBe('Civitas illa Fortis');
    expect(html).not.toContain('Known steps');
    expect(html).not.toContain('Civitas illa Fortis');
  });
});
