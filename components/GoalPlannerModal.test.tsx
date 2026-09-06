import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnlockState } from '../types';
import { wikiUrlFor } from '../constants';
import { PlanStep, listGoalTargets, planForTarget } from '../utils/goalPlanner';
import { GoalPlanReadiness, goalPlannerStepHasWikiLink, goalPlannerStepWikiHref, goalPlannerTargetState } from './GoalPlannerModal';

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

  it('uses the canonical region id instead of an overlap display label', () => {
    expect(goalPlannerStepWikiHref(step(
      'Mage Arena',
      'Mage Arena · Resource Area',
    ))).toBe(wikiUrlFor('Mage Arena'));
  });

  it('does not invent a wiki article for a combined route alternative', () => {
    expect(goalPlannerStepHasWikiLink(step(
      'alternative:One of: East Ardougne or Tree Gnome Stronghold',
      'One of: East Ardougne or Tree Gnome Stronghold',
    ))).toBe(false);
  });
});

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

it('gives Prying Times a distinct confirmation state', () => {
  const unlocks = pryingTimesUnlocks();
  const target = listGoalTargets().find(target => (
    target.kind === 'quest' && target.id === 'Prying Times'
  ))!;

  expect(goalPlannerTargetState(target, unlocks)).toBe('confirm');
});

it('keeps outstanding confirmations stored without rendering them or ready copy', () => {
  const plan = planForTarget('quest', 'Prying Times', pryingTimesUnlocks())!;
  const markup = renderToStaticMarkup(<GoalPlanReadiness plan={plan} />);

  expect(markup).not.toContain('Confirm:');
  expect(plan.manualSteps.length).toBeGreaterThan(0);
  expect(markup).not.toContain('Available right now');
});

it('omits both internal evidence and confirmation prose from readiness', () => {
  const plan = planForTarget('quest', 'Prying Times', pryingTimesUnlocks())!;
  plan.manualSteps = [
    { kind: 'requirement', id: 'private-route', label: 'Unverified teleport source route', done: false, internalOnly: true },
    { kind: 'manual', id: 'public-task-slot', label: 'Confirm: One open Sailing task slot', done: false },
  ];
  const markup = renderToStaticMarkup(<GoalPlanReadiness plan={plan} />);
  expect(markup).not.toContain('Confirm:');
  expect(plan.manualSteps.length).toBeGreaterThan(0);
  expect(markup).not.toContain('Unverified teleport source route');
  expect(markup).not.toContain('Available right now');
});

it('does not show internal-only requirements or ready copy when no public confirmations remain', () => {
  const plan = planForTarget('quest', 'Prying Times', pryingTimesUnlocks())!;
  plan.manualSteps = [
    { kind: 'requirement', id: 'private-route', label: 'Unverified teleport source route', done: false, internalOnly: true },
  ];
  plan.needsConfirmation = true;
  plan.alreadyReachable = false;
  const markup = renderToStaticMarkup(<GoalPlanReadiness plan={plan} />);
  expect(markup).not.toContain('Unverified teleport source route');
  expect(markup).not.toContain('Needs confirmation');
  expect(markup).not.toContain('Available right now');
});

it('does not invent a wiki article for a manual confirmation', () => {
  expect(goalPlannerStepHasWikiLink({ ...step('manual:prying', 'Confirm: One open Sailing task slot'), kind: 'manual' })).toBe(false);
});

// This suite isolates destination/skill/manual behavior with known legal supplies.
// Acquisition availability itself is covered by itemAcquisition and source tests.
import { beforeEach as beforeSupplyTest, afterEach as afterSupplyTest, vi as supplySpy } from 'vitest';
import { chunkContentService as suppliedItemsFixture } from '../services/ChunkContentService';
let restoreSupplyFixture: (() => void)[] = [];
beforeSupplyTest(() => {
  const ready = supplySpy.spyOn(suppliedItemsFixture, 'ready', 'get').mockReturnValue(true);
  const records = supplySpy.spyOn(suppliedItemsFixture, 'itemSourceRecords').mockImplementation(itemName => [{ itemName, kind: 'spawn', hostName: 'Test prepared supplies', cx: 50, cy: 50, rawRequirements: [] }]);
  restoreSupplyFixture = [() => ready.mockRestore(), () => records.mockRestore()];
});
afterSupplyTest(() => restoreSupplyFixture.forEach(restore => restore()));
