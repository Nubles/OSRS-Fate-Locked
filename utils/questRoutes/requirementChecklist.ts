import type { ReviewedQuestRequirements } from '../../data/questItemRequirements';
import type { GoalPlan, PlanStep } from '../goalPlanner';

export type QuestRequirementRowMode =
  | 'ACCOUNT'
  | 'MANUAL_GATE'
  | 'MANUAL_ITEM'
  | 'QUEST_PROVIDED';

export interface QuestRequirementChecklistRow {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly statusText: string;
  readonly mode: QuestRequirementRowMode;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly itemKey?: string;
}

const accountRow = (step: PlanStep): QuestRequirementChecklistRow => ({
  id: `${step.kind}:${step.id}`,
  label: step.label,
  detail: step.detail,
  statusText: 'Updates automatically',
  mode: 'ACCOUNT',
  checked: step.done,
  disabled: true,
});

export const buildQuestRequirementChecklist = (
  plan: GoalPlan,
  reviewed: ReviewedQuestRequirements,
  confirmedItemKeys: ReadonlySet<string>,
): QuestRequirementChecklistRow[] => {
  const automatic = [
    ...plan.skillSteps,
    ...(plan.qpStep ? [plan.qpStep] : []),
    ...plan.questSteps.filter(step => step.id !== plan.targetId),
    ...plan.regionSteps,
  ];
  const rows = automatic.filter((step, index) => (
    automatic.findIndex(entry => `${entry.kind}:${entry.id}` === `${step.kind}:${step.id}`) === index
  )).map(accountRow);
  const alternatives = plan.alternativeSteps.filter((step, index) => (
    plan.alternativeSteps.findIndex(entry => `${entry.kind}:${entry.id}` === `${step.kind}:${step.id}`) === index
  )).map(step => ({
    id: `${step.kind}:${step.id}`,
    label: step.label,
    statusText: 'Complete one valid route',
    mode: 'ACCOUNT' as const,
    checked: step.done,
    disabled: true,
  }));
  const manual = plan.manualSteps.filter((step, index) => (
    plan.manualSteps.findIndex(entry => `${entry.kind}:${entry.id}` === `${step.kind}:${step.id}`) === index
  )).map(step => ({
    id: `${step.kind}:${step.id}`,
    label: step.label,
    detail: step.detail,
    statusText: 'Needs confirmation elsewhere',
    mode: 'MANUAL_GATE' as const,
    checked: false,
    disabled: true,
  }));
  const items = reviewed.items.map(requirement => ({
    id: `item:${requirement.item.key}`,
    label: `${requirement.quantity} ${requirement.item.name}`,
    detail: requirement.note,
    statusText: requirement.supplyPolicy === 'PLAYER_OBTAINED'
      ? 'Confirm possession'
      : 'Provided during quest',
    mode: requirement.supplyPolicy === 'PLAYER_OBTAINED'
      ? 'MANUAL_ITEM' as const
      : 'QUEST_PROVIDED' as const,
    checked: requirement.supplyPolicy === 'QUEST_PROVIDED'
      || confirmedItemKeys.has(requirement.item.key),
    disabled: requirement.supplyPolicy !== 'PLAYER_OBTAINED',
    itemKey: requirement.item.key,
  }));

  return [...rows, ...alternatives, ...manual, ...items];
};
