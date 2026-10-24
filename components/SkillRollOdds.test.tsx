import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillRollOdds } from './SkillRollOdds';
import { SkillOddsDetails } from './SkillInfoBox';
import { SKILL_CHAOS_MILESTONES } from '../config/economy';
import { skillLevelKeyChance } from '../utils/keyRoll';

describe('SkillRollOdds', () => {
  it('shows the exact chance for the next level', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} chance={skillLevelKeyChance(41 + 1)} isUnlocked descriptionId="attack-key-roll-description" />,
    );

    expect(html).toContain('Next Lv 42');
    expect(html).toContain('8.4% Key');
    expect(html).toContain('Each level-up also has a separate 2% chance of a Chaos Key.');
    expect(html).toContain('pointer-events-auto');
  });

  it('names the guaranteed Chaos Key when the next level is a milestone', () => {
    for (const level of SKILL_CHAOS_MILESTONES) {
      const html = renderToStaticMarkup(
        <SkillRollOdds currentLevel={level - 1} chance={skillLevelKeyChance(level - 1 + 1)} isUnlocked descriptionId="attack-key-roll-description" />,
      );
      expect(html, `level ${level}`).toContain(`Level ${level} also gives a guaranteed Chaos Key, and a separate 2% chance of another.`);
    }
  });

  it('shows the chance it is given, with what the run\'s boosts add', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked descriptionId="attack-key-roll-description" chance={10.4} />,
    );

    expect(html).toContain('10.4% Key');
    expect(html).toContain('8.4% base, +2% from your boosts.');
  });

  it('shows the maximum eligible chance at level 98', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={98} chance={skillLevelKeyChance(98 + 1)} isUnlocked descriptionId="attack-key-roll-description" />,
    );

    expect(html).toContain('Next Lv 99');
    expect(html).toContain('19.8% Key');
  });

  it('shows nothing for locked or maxed skills', () => {
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} chance={skillLevelKeyChance(41 + 1)} isUnlocked={false} descriptionId="attack-key-roll-description" />,
    )).toBe('');
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={99} chance={skillLevelKeyChance(99 + 1)} isUnlocked descriptionId="attack-key-roll-description" />,
    )).toBe('');
  });
  it('keeps the Chaos explanation for screen readers only by default', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked descriptionId="attack-key-roll-description" />,
    );

    expect(html).toContain('id="attack-key-roll-description"');
    expect(html).toContain('sr-only');
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain('Each level-up also has a separate 2% chance of a Chaos Key.');
  });

  it('with the hover box turned on, shows it from parent hover or keyboard focus but not after a click', () => {
    const descriptionId = 'attack-key-roll-description';
    const html = renderToStaticMarkup(
      <div className="group" role="button" tabIndex={0} aria-describedby={descriptionId}>
        <SkillRollOdds
          currentLevel={41} chance={skillLevelKeyChance(41 + 1)}
          isUnlocked
          descriptionId={descriptionId}
          hoverBox
        />
      </div>,
    );

    expect(html).toContain(`aria-describedby="${descriptionId}"`);
    expect(html).toContain(`id="${descriptionId}"`);
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('group-hover:opacity-100');
    expect(html).toContain('group-focus-visible:opacity-100');
    // focus-within would keep it up after a mouse click focuses the card.
    expect(html).not.toContain('group-focus-within');
    // It fills the card, so its first line isn't cut off.
    expect(html).toContain('inset-1');
    expect(html).not.toContain('sr-only');
    expect(html).not.toContain('title=');
    expect(html).toContain('Each level-up also has a separate 2% chance of a Chaos Key.');
  });
  it('says a Chunked level past the tier cap rolls nothing', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={10} chance={null} isUnlocked descriptionId="wc" pastCap={10} />,
    );
    expect(html).toContain('Next Lv 11 · no roll');
    expect(html).toContain('levels past the cap roll no Keys');
    expect(html).not.toContain('% Key');
  });
});

describe('SkillOddsDetails', () => {
  it('lists the Key chance with the achievement share, the Chaos Key odds and the tier reach', () => {
    const html = renderToStaticMarkup(
      <SkillOddsDetails skill="Hitpoints" level={53} tier={6} boost={1.3} variant="classic" />,
    );
    expect(html).toContain('Hitpoints');
    expect(html).toContain('Next Lv 54');
    expect(html).toContain('12.1%');
    expect(html).toContain('+1.3%');
    expect(html).toContain('2% chance');
    expect(html).toContain('level 60');
    expect(html).toContain('up to level 60');
  });

  it('names a guaranteed Chaos Key on a milestone level and leaves out the next one', () => {
    const html = renderToStaticMarkup(
      <SkillOddsDetails skill="Attack" level={49} tier={5} variant="osrs" />,
    );
    expect(html).toContain('Attack: next level 50');
    expect(html).toContain('Chaos Key: guaranteed, plus 2% for another');
    expect(html).not.toContain('Next free Chaos');
    expect(html).not.toContain('From achievements');
  });

  it('says a Chunked level past the tier cap rolls nothing', () => {
    const html = renderToStaticMarkup(
      <SkillOddsDetails skill="Woodcutting" level={10} tier={1} pastCap={10} variant="osrs" />,
    );
    expect(html).toContain('Key chance: no roll');
    expect(html).toContain("past this tier&#x27;s cap of level 10");
    expect(html).not.toContain('Chaos Key');
  });
});

