import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { selectQuestGeography } from '../utils/questGeographyDisplay';
import { QuestGeographyChips } from './QuestGeographyChips';

describe('QuestGeographyChips', () => {
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
        onShowChunk={() => undefined}
      />,
    );

    expect(html.match(/Draynor Village/g)).toHaveLength(1);
    expect(html.match(/South Falador Farm/g)).toHaveLength(1);
    expect(html).not.toContain('Misthalin');
    expect(html).not.toContain('Asgarnia');
    expect(html).not.toContain('Known steps');
  });

  it('labels partial region-policy evidence as Known steps', () => {
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
        onShowChunk={() => undefined}
      />,
    );

    expect(html).toContain('Known steps');
    expect(html).toContain('Civitas illa Fortis');
  });
});
