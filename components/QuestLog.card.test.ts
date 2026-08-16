import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { chunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility, type QuestEligibility } from '../utils/journalStatus';
import { QuestCard } from './QuestLog';

const unlocks: UnlockState = {
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuestCard geography integration', () => {
  it('renders Porcine exact chunks once and counts only its two geography gates', () => {
    const eligibility: QuestEligibility = {
      eligible: false,
      machineEligible: false,
      manualChecks: [],
      confirmable: false,
      status: 'LOCKED_REGION',
      evidence: [],
      blockers: [
        { kind: 'region', label: 'Draynor Village' },
        { kind: 'region', label: 'South Falador Farm' },
      ],
    };
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      status: eligibility.status,
      eligibility,
    };
    const html = renderToStaticMarkup(
      React.createElement(QuestCard, {
        quest,
        unlocks,
        currentQP: 0,
        onToggle: vi.fn(),
      }),
    );

    expect(html.match(/Draynor Village/g)).toHaveLength(1);
    expect(html.match(/South Falador Farm/g)).toHaveLength(1);
    expect(html).not.toContain('Misthalin');
    expect(html).not.toContain('Asgarnia');
    expect(html).toContain('0/2 reqs');
  });

  it('renders distinct same-label Known-step coordinates once each', () => {
    vi.spyOn(chunkContentService, 'entityLocations').mockReturnValue({
      name: 'Tale of the Righteous',
      kind: 'quest',
      locations: [
        { cx: 18, cy: 55, role: 'step' },
        { cx: 18, cy: 55, role: 'first' },
        { cx: 19, cy: 55, role: 'step' },
      ],
    });
    const eligibility = evaluateQuestEligibility(
      QUEST_DATA['Tale of the Righteous'],
      unlocks,
    );
    const quest = {
      ...QUEST_DATA['Tale of the Righteous'],
      status: eligibility.status,
      eligibility,
    };

    const html = renderToStaticMarkup(
      React.createElement(QuestCard, {
        quest,
        unlocks,
        currentQP: 0,
        onToggle: vi.fn(),
      }),
    );

    expect(html.match(/show on map/g)).toHaveLength(2);
  });
});

describe('QuestCard reward metadata', () => {
  const renderQuest = (quest: (typeof QUEST_DATA)[keyof typeof QUEST_DATA]) => {
    const eligibility = evaluateQuestEligibility(quest, unlocks);
    return renderToStaticMarkup(
      React.createElement(QuestCard, {
        quest: { ...quest, status: eligibility.status, eligibility },
        unlocks,
        currentQP: 0,
        onToggle: vi.fn(),
      }),
    );
  };

  it('shows awarded quest points and omits the chip for zero-point miniquests', () => {
    expect(renderQuest(QUEST_DATA['Sheep Shearer'])).toContain('1 Quest Point');
    expect(renderQuest(QUEST_DATA['Sheep Shearer'])).not.toContain('1 Quest Points');
    expect(renderQuest(QUEST_DATA['Fallen From Grace'])).toContain('2 Quest Points');
    expect(renderQuest(QUEST_DATA["Alfred Grimhand's Barcrawl"])).not.toContain('Quest Point');
  });
});
