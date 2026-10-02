import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillRollOdds } from './SkillRollOdds';
import { SKILL_CHAOS_MILESTONES } from '../config/economy';

describe('SkillRollOdds', () => {
  it('shows the exact chance for the next level', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked descriptionId="attack-key-roll-description" />,
    );

    expect(html).toContain('Next Lv 42');
    expect(html).toContain('8.4% Key');
    expect(html).toContain('Each level-up also has a separate 2% chance of a Chaos Key.');
    expect(html).toContain('pointer-events-auto');
  });

  it('names the guaranteed Chaos Key when the next level is a milestone', () => {
    for (const level of SKILL_CHAOS_MILESTONES) {
      const html = renderToStaticMarkup(
        <SkillRollOdds currentLevel={level - 1} isUnlocked descriptionId="attack-key-roll-description" />,
      );
      expect(html, `level ${level}`).toContain(`Level ${level} also gives a guaranteed Chaos Key, and a separate 2% chance of another.`);
    }
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
  it('reveals one visible Chaos explanation from parent hover or keyboard focus', () => {
    const descriptionId = 'attack-key-roll-description';
    const html = renderToStaticMarkup(
      <div className="group" role="button" tabIndex={0} aria-describedby={descriptionId}>
        <SkillRollOdds
          currentLevel={41}
          isUnlocked
          descriptionId={descriptionId}
        />
      </div>,
    );

    expect(html).toContain(`aria-describedby="${descriptionId}"`);
    expect(html).toContain(`id="${descriptionId}"`);
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('group-hover:opacity-100');
    expect(html).toContain('group-focus-visible:opacity-100');
    expect(html).toContain('group-focus-within:opacity-100');
    expect(html).not.toContain('sr-only');
    expect(html).not.toContain('title=');
    expect(html).toContain('Each level-up also has a separate 2% chance of a Chaos Key.');
  });
});
