import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ unlocks: { levels: { Ranged: 99 }, bosses: ['Test boss'] }, loadout: { Weapon: 999999 } }) }));
vi.mock('../services/GearService', () => ({ gearService: { ready: true, byId: () => undefined } }));
vi.mock('../services/MonsterService', () => ({ monsterService: { ready: true, byName: () => ({ hp: 100, maxHit: 1, defLevel: 1, magicLevel: 1, def: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } }) } }));
import { BossKillPlanner } from './BossKillPlanner';
it('shows missing capabilities rather than a fabricated DPS/readiness result', () => {
  const html = renderToStaticMarkup(<BossKillPlanner onClose={() => {}} />);
  expect(html).toContain('No verified damage estimate');
  expect(html).toContain('Weapon attack styles are not modelled');
  expect(html).not.toContain('best as');
  expect(html).not.toContain('Geared');
});
