import { describe, expect, it } from 'vitest';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import type { GoalPlan } from '../goalPlanner';
import { buildQuestRequirementChecklist } from './requirementChecklist';

const plan: GoalPlan = {
  targetKind: 'quest',
  targetId: "Daddy's Home",
  targetLabel: "Daddy's Home",
  alreadyReachable: false,
  alreadyDone: false,
  needsConfirmation: true,
  skillSteps: [{ kind: 'skill', id: 'Construction', label: 'Construction', detail: 'Level 5', done: true }],
  questSteps: [
    { kind: 'quest', id: "Daddy's Home", label: "Daddy's Home", done: false },
    { kind: 'quest', id: "Cook's Assistant", label: "Cook's Assistant", done: true },
  ],
  regionSteps: [{ kind: 'region', id: 'Varrock', label: 'Varrock', done: false }],
  alternativeSteps: [{
    kind: 'alternative',
    id: 'alternative:access',
    label: 'One valid access route',
    done: false,
    routes: [],
  }],
  qpStep: { kind: 'qp', id: 'Quest Points', label: 'Quest Points', detail: '5 needed', done: false },
  manualSteps: [{ kind: 'manual', id: 'manual:space', label: 'Confirm: inventory space', done: false }],
  steps: [],
  remaining: 5,
};

describe('buildQuestRequirementChecklist', () => {
  it('orders automatic rows before reviewed items and excludes the target quest itself', () => {
    const rows = buildQuestRequirementChecklist(
      plan,
      reviewedQuestRequirements("Daddy's Home")!,
      new Set(['plank']),
    );

    expect(rows.map(row => row.id)).toEqual([
      'skill:Construction',
      'qp:Quest Points',
      "quest:Cook's Assistant",
      'region:Varrock',
      'alternative:alternative:access',
      'manual:manual:space',
      'item:plank',
      'item:bolt of cloth',
      'item:nails',
      'item:hammer',
      'item:saw',
      'item:waxwood logs',
    ]);
    expect(rows.find(row => row.id === 'skill:Construction')).toMatchObject({
      checked: true,
      statusText: 'Updates automatically',
    });
    expect(rows.find(row => row.id === 'region:Varrock')).toMatchObject({
      checked: false,
      statusText: 'Updates automatically',
    });
    expect(rows.find(row => row.id === 'item:plank')).toMatchObject({
      label: '10 Plank',
      mode: 'MANUAL_ITEM',
      checked: true,
      disabled: false,
    });
    expect(rows.find(row => row.id === 'item:hammer')).toMatchObject({
      mode: 'QUEST_PROVIDED',
      checked: true,
      disabled: true,
      statusText: 'Provided during quest',
    });
  });
});
