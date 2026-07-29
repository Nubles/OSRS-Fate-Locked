import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { QuestCard } from './QuestLog';

describe('QuestCard geography integration', () => {
  it('renders Porcine exact chunks once and counts only its two geography gates', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      status: 'LOCKED',
      eligibility: {
        eligible: false,
        evidence: [],
        blockers: [
          { kind: 'location', label: 'Draynor Village' },
          { kind: 'location', label: 'South Falador Farm' },
        ],
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(QuestCard, {
        quest,
        unlocks: { regions: [], chunks: [], skills: {}, quests: [] },
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
});
