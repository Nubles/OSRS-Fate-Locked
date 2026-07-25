import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillRollOdds } from './SkillRollOdds';

describe('SkillRollOdds', () => {
  it('shows the exact chance for the next level', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked />,
    );

    expect(html).toContain('Next Lv 42');
    expect(html).toContain('8.4% Key');
    expect(html).toContain('separate 2% Chaos Key chance');
    expect(html).toContain('pointer-events-auto');
  });

  it('shows the maximum eligible chance at level 98', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={98} isUnlocked />,
    );

    expect(html).toContain('Next Lv 99');
    expect(html).toContain('19.8% Key');
  });

  it('shows nothing for locked or maxed skills', () => {
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked={false} />,
    )).toBe('');
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={99} isUnlocked />,
    )).toBe('');
  });
});
