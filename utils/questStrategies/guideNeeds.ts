import type { EquipmentSlot } from '../../data/questData';
import type { ChunkKey, RouteGate } from '../questRoutes/model';
import type { RuneProofCoachAction, RuneProofCoachModel } from './coach';
import { formatQuestChunk, nameQuestChunksInText } from './chunkLabels';

export type GuideNeedVisual =
  | { readonly type: 'EQUIPMENT'; readonly slot: EquipmentSlot }
  | { readonly type: 'SKILL'; readonly skill: string }
  | { readonly type: 'CHUNK'; readonly chunk: ChunkKey }
  | { readonly type: 'ITEM'; readonly itemKey: string }
  | { readonly type: 'QUEST' }
  | { readonly type: 'UNLOCK'; readonly category: string; readonly id: string };

export interface GuideNeed {
  readonly id: string;
  readonly kind: 'UNLOCK' | 'ITEM' | 'CHECK';
  readonly label: string;
  readonly actionIds: readonly string[];
  readonly visual?: GuideNeedVisual;
}

const normalise = (value: string): string => value.trim().replace(/[.!?]+$/, '').toLocaleLowerCase('en-GB');
const equipmentFromLabel = (label: string): { id: string; label: string; slot: EquipmentSlot } | undefined => {
  const match = /^(Head|Cape|Neck|Ammo|Weapon|Body|Shield|Legs|Gloves|Boots|Ring) T(\d+)(?=:|$)/.exec(label.trim());
  return match ? { id: `equipment:${match[1]}:${Number(match[2])}`, label: `${match[1]} T${Number(match[2])}`, slot: match[1] as EquipmentSlot } : undefined;
};
const gateVisual = (gate: RouteGate): GuideNeedVisual | undefined => {
  switch (gate.type) {
    case 'EQUIPMENT': return { type: 'EQUIPMENT', slot: gate.slot };
    case 'SKILL': return gate.skill === 'Quest Points' ? { type: 'QUEST' } : { type: 'SKILL', skill: gate.skill };
    case 'QUEST':
    case 'QUEST_PROGRESS':
    case 'RFD_SUBQUESTS': return { type: 'QUEST' };
    case 'UNLOCK': return { type: 'UNLOCK', category: gate.category, id: gate.id };
    case 'UNRESOLVED': return undefined;
  }
};
const gateId = (gate: RouteGate): string => {
  switch (gate.type) {
    case 'EQUIPMENT': return `equipment:${gate.slot}:${gate.tier}`;
    case 'QUEST': return `quest:${gate.questId}`;
    case 'QUEST_PROGRESS': return `quest-progress:${gate.questId}:${gate.completion}:${gate.raw}`;
    case 'RFD_SUBQUESTS': return `rfd-subquests:${gate.count}`;
    case 'SKILL': return `skill:${gate.skill}:${gate.level}`;
    case 'UNLOCK': return `unlock:${gate.category}:${gate.id}`;
    case 'UNRESOLVED': return `check:${normalise(gate.label)}`;
  }
};

/** Remaining needs only; the absence of entries is not a whole-quest readiness claim. */
export function guideNeeds(model: RuneProofCoachModel, showCoordinates = false): readonly GuideNeed[] {
  const remaining = model.actions.filter(action => action.state !== 'COMPLETED');
  if (!remaining.length) return [];
  const order = new Map(remaining.map((action, index) => [action.id, index]));
  const entries = new Map<string, { id: string; kind: GuideNeed['kind']; label: string; actionIds: Set<string>; visual?: GuideNeedVisual }>();
  const directEquipment = new Set<string>();
  const aggregateActions = new Set<string>();
  const aggregateLabels = new Set((model.equipmentBlockers ?? []).map(label => equipmentFromLabel(label)?.id ?? normalise(label)));
  const add = (id: string, kind: GuideNeed['kind'], label: string, actionIds: readonly string[], visual?: GuideNeedVisual) => {
    const entry = entries.get(id) ?? { id, kind, label, actionIds: new Set<string>(), ...(visual ? { visual } : {}) };
    actionIds.forEach(actionId => entry.actionIds.add(actionId));
    entries.set(id, entry);
  };
  const check = (label: string, action: RuneProofCoachAction) => add(
    `check:${normalise(label)}`, 'CHECK', nameQuestChunksInText(label, showCoordinates), [action.id],
  );
  const chunk = (key: ChunkKey, action: RuneProofCoachAction) => add(
    `chunk:${key}`, 'UNLOCK', formatQuestChunk(key, showCoordinates), [action.id], { type: 'CHUNK', chunk: key },
  );

  for (const action of remaining) {
    for (const label of action.manualChecks ?? []) check(label, action);
    for (const blocker of action.blockers ?? []) {
      switch (blocker.kind) {
        case 'CHUNK': chunk(blocker.chunk, action); break;
        case 'ITEM':
          add(`item:${normalise(blocker.itemKey)}`, 'ITEM', nameQuestChunksInText(blocker.label, showCoordinates), [action.id], { type: 'ITEM', itemKey: blocker.itemKey });
          break;
        case 'GATE': {
          const gate = blocker.gate;
          const id = gateId(gate);
          if (gate.type === 'EQUIPMENT') directEquipment.add(id);
          add(id, gate.type === 'UNRESOLVED' || gate.type === 'QUEST_PROGRESS' ? 'CHECK' : 'UNLOCK',
            gate.type === 'EQUIPMENT' ? `${gate.slot} T${gate.tier}` : nameQuestChunksInText(blocker.label, showCoordinates), [action.id], gateVisual(gate));
          break;
        }
        case 'LOCATION': check(blocker.label, action); break;
        case 'DEPENDENCY': break;
      }
    }
    for (const access of action.chunkAccess ?? []) {
      if (access.status === 'LOCKED') chunk(access.chunk, action);
      else if (access.status === 'UNKNOWN' && !action.blockers?.some(blocker => blocker.kind === 'LOCATION')) {
        add(`location:${access.chunk}`, 'CHECK', `Location needs checking: ${formatQuestChunk(access.chunk, showCoordinates)}`, [action.id]);
      }
    }
    const travel = action.travel;
    if (travel && travel.status !== 'AVAILABLE' && travel.status !== 'START') {
      travel.missingChunks.forEach(key => chunk(key, action));
      // Travel exposes display labels, not structured unlock gates: a fare or
      // unreviewed condition must not be presented as an unlock to obtain.
      travel.requirements.forEach(label => check(label, action));
      if (travel.status === 'UNRESOLVED' && !travel.requirements.length) {
        check(travel.explanation ?? 'The walking route for this step needs checking.', action);
      } else if (!travel.missingChunks.length && !travel.requirements.length) {
        check('The walking route has an unmet requirement.', action);
      }
    }
  }

  // The aggregate completion guard remains meaningful after the wear action was
  // checked. Prefer the actual remaining wear steps whenever they still exist.
  for (const label of model.equipmentBlockers ?? []) {
    const equipment = equipmentFromLabel(label);
    const matches = remaining.filter(action => action.state === 'BLOCKED' && action.blockerText?.split(';').some(part => (
      equipment ? equipmentFromLabel(part)?.id === equipment.id : normalise(part) === normalise(label)
    )));
    const fallback = matches.length ? matches : remaining.filter(action => action.confirmationLabel === 'Confirm quest complete');
    fallback.forEach(action => aggregateActions.add(action.id));
    if (equipment && directEquipment.has(equipment.id)) continue;
    add(equipment?.id ?? `check:${normalise(label)}`, equipment ? 'UNLOCK' : 'CHECK',
      equipment?.label ?? nameQuestChunksInText(label, showCoordinates), fallback.map(action => action.id),
      equipment ? { type: 'EQUIPMENT', slot: equipment.slot } : undefined);
  }

  for (const action of remaining) {
    const hasNeed = [...entries.values()].some(entry => entry.actionIds.has(action.id));
    if (!hasNeed && action.state === 'NEEDS_CONFIRMATION') check('This step needs checking before you continue.', action);
    if (action.state === 'BLOCKED' && aggregateActions.has(action.id)) {
      action.blockerText?.split(';').filter(label => !aggregateLabels.has(equipmentFromLabel(label)?.id ?? normalise(label)))
        .forEach(label => check(label.trim(), action));
    } else if (!hasNeed && action.state === 'BLOCKED') check(action.blockerText ?? 'This step has an unmet requirement.', action);
  }
  return [...entries.values()].map(entry => ({
    ...entry,
    actionIds: [...entry.actionIds].sort((left, right) => order.get(left)! - order.get(right)!),
  })).sort((left, right) => (order.get(left.actionIds[0]) ?? Infinity) - (order.get(right.actionIds[0]) ?? Infinity));
}
