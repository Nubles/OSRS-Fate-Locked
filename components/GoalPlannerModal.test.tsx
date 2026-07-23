import { describe, expect, it } from 'vitest';
import { PlanStep } from '../utils/goalPlanner';
import { goalPlannerStepHasWikiLink } from './GoalPlannerModal';

const step = (id: string, label: string): PlanStep => ({
  kind: 'region',
  id,
  label,
  done: false,
});

describe('goalPlannerStepHasWikiLink', () => {
  it('keeps normal goal steps linked to their wiki article', () => {
    expect(goalPlannerStepHasWikiLink(step('Lumbridge', 'Lumbridge'))).toBe(true);
  });

  it('does not invent a wiki article for a combined route alternative', () => {
    expect(goalPlannerStepHasWikiLink(step(
      'alternative:One of: East Ardougne or Tree Gnome Stronghold',
      'One of: East Ardougne or Tree Gnome Stronghold',
    ))).toBe(false);
  });
});
