/**
 * Compact wording for a diary task's manual checks, as the OSRS Journal's
 * "Needs:" line shows them. The checks themselves (data/diaryTasks.ts and the
 * eligibility rules) are unchanged; this only rewords them for display:
 *
 *   "Have Desert shirt and confirm that the specific item is permitted by your
 *    equipment tier", "Have Desert robe and confirm …"
 *     -> "Wear: Desert shirt, Desert robe (tier-checked)"
 *        ("Have:" when the task does not say the item is worn)
 *   "Reached the required progress in Icthlarin's Little Helper for: <task>"
 *     -> "Progress in Icthlarin's Little Helper"
 *
 * Any other check passes through as "confirm <check>".
 */
const EQUIPMENT_CHECK = /^Have (.+?) and confirm that the specific item is permitted by your equipment tier\.?$/i;
const QUEST_PROGRESS = /^Reached the required progress in (.+?) for: /i;
const WORN = /\b(equip|equipped|equipping|wear|wearing|worn|wield|wielding)\b/i;

export const formatDiaryChecks = (checks: readonly string[], taskDescription = ''): string[] => {
  const items: string[] = [];
  const out: string[] = [];
  let itemsAt = -1;
  const seen = new Set<string>();
  for (const check of checks) {
    const equipment = EQUIPMENT_CHECK.exec(check);
    if (equipment) {
      const item = equipment[1].trim();
      if (!items.includes(item)) items.push(item);
      if (itemsAt < 0) { itemsAt = out.length; out.push(''); }
      continue;
    }
    const progress = QUEST_PROGRESS.exec(check);
    const line = progress ? `Progress in ${progress[1].trim()}` : `confirm ${check}`;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  if (itemsAt >= 0) {
    out[itemsAt] = `${WORN.test(taskDescription) ? 'Wear' : 'Have'}: ${items.join(', ')} (tier-checked)`;
  }
  return out;
};
