import type { EvaluatedStep, GuideEvaluation } from './model';

/** Add established travel to action eligibility without treating a missing route
 * as proof that travel is impossible. Reachable keys are numeric region IDs,
 * not the saved ownership keys ("cx,cy"). Completed actions remain historical.
 */
export function applyGuideTravel(
  evaluation: GuideEvaluation,
  mode: string | undefined,
  reachable: ReadonlySet<string> | null,
): GuideEvaluation {
  if (mode !== 'chunked') return evaluation;
  const steps = evaluation.steps.map((entry): EvaluatedStep => {
    const location = entry.step.location;
    if (entry.state !== 'available' || !location) return entry;
    if (reachable === null) {
      return { ...entry, state: 'unsupported', reasons: ['Checking the route to this destination.'] };
    }
    if (!reachable.has(String(location.cx * 256 + location.cy))) {
      return { ...entry, state: 'unsupported', reasons: [`A route to ${location.label} has not been established with your current unlocks.`] };
    }
    return entry;
  });
  const next = steps.find(entry => entry.state === 'available')
    ?? steps.find(entry => entry.state === 'question')
    ?? steps.find(entry => entry.state !== 'done' && entry.state !== 'skipped');
  return { ...evaluation, steps, next };
}
