import type { ActivityReadiness } from '../utils/activityReadiness';

export function ActivityReadinessBadge({
  readiness,
}: {
  readiness: ActivityReadiness;
}) {
  const label = readiness.status === 'LOCKED' ? 'Not owned'
    : readiness.status === 'NOT_READY' ? 'Not ready'
    : readiness.status === 'NEEDS_CONFIRMATION' ? 'Check required'
    : readiness.status === 'UNKNOWN' ? 'Unknown'
    : 'Ready';

  const summary = readiness.status === 'NOT_READY'
    ? readiness.blockers.map(blocker => blocker.label).join(', ')
    : readiness.status === 'UNKNOWN' ? readiness.checks.join(', ')
    : readiness.status === 'NEEDS_CONFIRMATION'
      ? 'Confirm: ' + readiness.checks.join(', ')
      : '';

  const colorClass = readiness.status === 'LOCKED'
    ? 'border-gray-500/20 bg-gray-500/10 text-gray-400'
    : readiness.status === 'NOT_READY'
      ? 'border-red-500/20 bg-red-900/20 text-red-300'
      : readiness.status === 'NEEDS_CONFIRMATION' || readiness.status === 'UNKNOWN'
        ? 'border-cyan-500/20 bg-cyan-900/20 text-cyan-300'
        : 'border-emerald-500/20 bg-emerald-900/20 text-emerald-300';

  return (
    <div className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] leading-tight ${colorClass}`}>
      <span className="rounded border px-1 py-0.5 font-bold uppercase tracking-wide">{label}</span>
      {summary && <span>{summary}</span>}
    </div>
  );
}
