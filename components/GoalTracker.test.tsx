import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GoalTracker } from './GoalTracker';
import { GoalRouteView } from './GoalRouteView';
vi.mock('../context/GameContext', () => ({ useGame: () => ({
  pinnedGoals: ['Ectoplasmator'], togglePin: () => {},
  unlocks: { regions: [], skills: {}, levels: { Cooking: 99 }, quests: [], diaries: [],
    bosses: [], minigames: ['Ectoplasmator'], guilds: [], mobility: [], arcana: [],
    storage: [], housing: [], merchants: [], farming: [], slayerUnlocks: [], equipment: {},
    completedTasks: [], cas: [] },
}) }));
describe('pinned goal uncertainty', () => {
  it('does not announce an unreviewed activity ready to play', () => {
    const html = renderToStaticMarkup(<GoalTracker />);
    expect(html).toContain('Ectoplasmator');
    expect(html).toContain('requirements need review');
    expect(html).not.toContain('Ready to play');
  });
});

it('shows attained levels without a locked tier label on the route', () => {
  const html = renderToStaticMarkup(<GoalRouteView goalId="Recipe for Disaster" />);
  expect(html).toContain('Skill levels');
  expect(html).toContain('99/70');
  expect(html).not.toContain('Skill tiers');
});
