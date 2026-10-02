import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { getItemDescription, VoidReveal } from './VoidReveal';

describe('VoidReveal', () => {
  it('says which training methods a skill tier opens, not that you may train to 99', () => {
    expect(getItemDescription(TableType.SKILLS, 'Slayer', 3))
      .toBe('Slayer is now tier 3: you can use its training methods up to level 30.');
    expect(getItemDescription(TableType.SKILLS, 'Slayer', 10))
      .toBe('Slayer is now tier 10: you can use its training methods up to level 99.');
    expect(getItemDescription(TableType.SKILLS, 'Slayer')).toContain('goes up one tier');
    expect(getItemDescription(TableType.SKILLS, 'Slayer', 1)).not.toContain('train to 99');
  });

  it('describes a Combat Powers unlock without calling every one a spell or prayer', () => {
    expect(getItemDescription(TableType.ARCANA, 'Dwarf Cannon')).toBe('You can now use this combat power.');
  });

  it('closes with a plain Continue button', () => {
    const html = renderToStaticMarkup(
      <VoidReveal itemName="Slayer" itemType={TableType.SKILLS} tier={2} onComplete={() => undefined} animationsEnabled={false} />,
    );
    expect(html).toContain('Slayer is now tier 2: you can use its training methods up to level 20.');
    expect(html).toContain('Continue');
    expect(html).not.toContain('Accept Destiny');
  });
});
