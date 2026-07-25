import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillRollOdds } from './SkillRollOdds';

describe('SkillRollOdds', () => {
  it('shows the exact chance for the next level', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked descriptionId="attack-key-roll-description" />,
    );

    expect(html).toContain('Next Lv 42');
    expect(html).toContain('8.4% Key');
    expect(html).toContain('separate 2% Chaos Key chance');
    expect(html).toContain('pointer-events-auto');
  });

  it('shows the maximum eligible chance at level 98', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={98} isUnlocked descriptionId="attack-key-roll-description" />,
    );

    expect(html).toContain('Next Lv 99');
    expect(html).toContain('19.8% Key');
  });

  it('shows nothing for locked or maxed skills', () => {
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked={false} descriptionId="attack-key-roll-description" />,
    )).toBe('');
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={99} isUnlocked descriptionId="attack-key-roll-description" />,
    )).toBe('');
  });
  it('exposes the Chaos explanation through the card description relationship', () => {
    const descriptionId = 'attack-key-roll-description';
    const html = renderToStaticMarkup(
      <div role="button" tabIndex={0} aria-describedby={descriptionId}>
        <SkillRollOdds
          currentLevel={41}
          isUnlocked
          descriptionId={descriptionId}
        />
      </div>,
    );

    expect(html).toContain(`aria-describedby="${descriptionId}"`);
    expect(html).toContain(`id="${descriptionId}"`);
    expect(html).toContain('Every level also has a separate 2% Chaos Key chance.');
  });
});
