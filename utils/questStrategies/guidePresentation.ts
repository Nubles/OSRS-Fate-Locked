import type { RuneProofCoachAction, RuneProofCoachModel } from './coach';
import { formatQuestChunk, nameQuestChunksInText } from './chunkLabels';

const sentence = (text: string): string => /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
const unique = (values: readonly string[]): string[] => [...new Set(values)];
const equipmentLabel = (label: string): string => (
  /^(Head|Cape|Neck|Ammo|Weapon|Body|Shield|Legs|Gloves|Boots|Ring) T\d+(?=:|$)/.exec(label.trim())?.[0]
  ?? label.trim()
);
const requirement = (label: string, showCoordinates = false): string => sentence(`Requires ${nameQuestChunksInText(label, showCoordinates)}`);

/** Only information that prevents this step or still needs checking belongs beside it. */
export function stepWarnings(action: RuneProofCoachAction, showCoordinates = false): readonly string[] {
  if (action.state === 'COMPLETED') return [];
  const warnings: string[] = (action.manualChecks ?? []).map(label => sentence(`Check: ${label}`));
  const locked = new Set(action.chunkAccess?.filter(access => access.status === 'LOCKED').map(access => access.chunk));
  for (const blocker of action.blockers ?? []) {
    switch (blocker.kind) {
      case 'CHUNK':
        locked.add(blocker.chunk);
        break;
      case 'GATE':
        warnings.push(blocker.gate.type === 'EQUIPMENT'
          ? requirement(`${blocker.gate.slot} T${blocker.gate.tier}`, showCoordinates)
          : blocker.gate.type === 'UNRESOLVED'
            ? sentence(`Check requirement: ${nameQuestChunksInText(blocker.label, showCoordinates)}`)
            : requirement(blocker.label, showCoordinates));
        break;
      case 'ITEM':
        warnings.push(sentence(`Get ${nameQuestChunksInText(blocker.label, showCoordinates)} before this step`));
        break;
      case 'LOCATION':
        warnings.push(sentence(nameQuestChunksInText(blocker.label, showCoordinates)));
        break;
      case 'DEPENDENCY':
        break;
    }
  }
  for (const chunk of locked) warnings.push(sentence(`Unlock ${formatQuestChunk(chunk, showCoordinates)} before this step`));
  if (action.chunkAccess?.some(access => access.status === 'UNKNOWN')
    && !action.blockers?.some(blocker => blocker.kind === 'LOCATION')) {
    warnings.push('The location for this step needs checking.');
  }
  // The completion guard may carry the quest's aggregate equipment requirement
  // without repeating a structured action gate. Normalize it to the same warning.
  if (action.state === 'BLOCKED' && action.blockerText) {
    const hasStructuredWarnings = warnings.length > 0;
    for (const label of action.blockerText.split(';').map(text => text.trim()).filter(Boolean)) {
      const equipment = equipmentLabel(label);
      if (equipment !== label || /^(Head|Cape|Neck|Ammo|Weapon|Body|Shield|Legs|Gloves|Boots|Ring) T\d+$/.test(label)) {
        warnings.push(requirement(equipment, showCoordinates));
      } else if (!hasStructuredWarnings) warnings.push(sentence(nameQuestChunksInText(label, showCoordinates)));
    }
  }
  const travel = action.travel;
  if (travel && travel.status !== 'AVAILABLE' && travel.status !== 'START') {
    const missing = travel.missingChunks.filter(chunk => !locked.has(chunk));
    if (missing.length) warnings.push(sentence(`The walking route needs ${unique(missing.map(chunk => formatQuestChunk(chunk, showCoordinates))).join(', ')} unlocked`));
    warnings.push(...travel.requirements.map(label => sentence(`${travel.status === 'UNRESOLVED' ? 'Check travel requirement' : 'Travel requires'}: ${nameQuestChunksInText(label, showCoordinates)}`)));
    if (travel.status === 'UNRESOLVED') warnings.push(sentence(nameQuestChunksInText(travel.explanation ?? 'The walking route for this step needs checking', showCoordinates)));
    else if (!travel.missingChunks.length && !travel.requirements.length) warnings.push('The walking route has an unmet requirement.');
  }
  if (!warnings.length && action.state === 'NEEDS_CONFIRMATION') warnings.push('This step needs checking before you continue.');
  if (!warnings.length && action.state === 'BLOCKED') warnings.push('This step has an unmet requirement.');
  return unique(warnings);
}

/** Summarize the next action without upgrading its availability into whole-quest readiness. */
export function guideReadiness(model: RuneProofCoachModel, showCoordinates = false): string {
  if (!model.actions.length) return 'No walkthrough is available for this quest yet.';
  const remaining = model.actions.filter(action => action.state !== 'COMPLETED');
  if (!remaining.length) return 'All guide steps are checked off.';
  const next = model.nextAction?.state !== 'COMPLETED' && model.nextAction
    ? model.nextAction : remaining[0];
  const nextWarnings = stepWarnings(next, showCoordinates);
  if (next.state === 'BLOCKED' || nextWarnings.length) {
    const uncertain = next.state !== 'BLOCKED'
      && (next.state === 'NEEDS_CONFIRMATION'
        || next.chunkAccess?.some(access => access.status === 'UNKNOWN')
        || next.blockers?.some(blocker => blocker.kind === 'LOCATION' || blocker.kind === 'GATE' && blocker.gate.type === 'UNRESOLVED')
        || next.travel?.status === 'UNRESOLVED');
    return `${uncertain ? 'The next step needs checking.' : 'Before the next step:'} ${nextWarnings[0] ?? 'Check its requirements below.'}`;
  }
  const introduction = model.progress.completed > 0 ? 'You can continue this quest.' : 'You can start this quest.';
  const equipment = unique([
    ...(model.equipmentBlockers ?? []).map(equipmentLabel),
    ...remaining.flatMap(action => action.blockers?.flatMap(blocker => (
      blocker.kind === 'GATE' && blocker.gate.type === 'EQUIPMENT'
        ? [`${blocker.gate.slot} T${blocker.gate.tier}`] : []
    )) ?? []),
  ]);
  const equipmentWarnings = new Set(equipment.map(label => requirement(label, showCoordinates)));
  const otherWarnings = remaining.flatMap(action => stepWarnings(action, showCoordinates)).filter(warning => !equipmentWarnings.has(warning));
  const needsChecking = remaining.some(action => action.state === 'NEEDS_CONFIRMATION'
    || action.chunkAccess?.some(access => access.status === 'UNKNOWN')
    || action.blockers?.some(blocker => blocker.kind === 'LOCATION' || blocker.kind === 'GATE' && blocker.gate.type === 'UNRESOLVED')
    || action.travel?.status === 'UNRESOLVED');
  const finish = equipment.length ? sentence(`Finishing requires ${equipment.join(' and ')}`) : '';
  const later = needsChecking ? 'Some later steps still need checking.'
    : otherWarnings.length ? 'Other requirements are shown beside their steps.' : '';
  return [introduction, finish, later].filter(Boolean).join(' ');
}
