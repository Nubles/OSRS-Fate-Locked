import React, { useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, RefreshCw, ScrollText, Sparkles, X } from 'lucide-react';
import type { ChangelogRelease, ChangelogSection } from '../data/changelog';
import type { FateCompensationChoice, FateCompensationState } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface ChangelogModalProps {
  releases: readonly ChangelogRelease[];
  compensation?: FateCompensationState;
  onResolveCompensation?: (choice: FateCompensationChoice) => void;
  onClose: () => void;
  /** Persistent control to receive focus after a manual close. */
  returnFocusTarget?: HTMLElement | null;
}

const SECTION_META: Array<{
  key: ChangelogSection;
  label: string;
  icon: typeof Sparkles;
  color: string;
}> = [
  { key: 'added', label: 'Added', icon: Sparkles, color: 'text-amber-300' },
  { key: 'changed', label: 'Changed', icon: RefreshCw, color: 'text-cyan-300' },
  { key: 'fixed', label: 'Fixed', icon: CheckCircle2, color: 'text-emerald-300' },
  { key: 'balance', label: 'Balance', icon: ScrollText, color: 'text-violet-300' },
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const formatReleaseDate = (date: string): string => {
  const [year, month, day] = date.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
};

const panelIdFor = (releaseId: string): string => `changelog-release-${releaseId}`;
const toggleIdFor = (releaseId: string): string => `changelog-release-toggle-${releaseId}`;

export const toggleExpandedRelease = (
  expandedReleaseIds: ReadonlySet<string>,
  releaseId: string,
): Set<string> => {
  const next = new Set(expandedReleaseIds);
  if (next.has(releaseId)) next.delete(releaseId);
  else next.add(releaseId);
  return next;
};

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  releases,
  onClose,
  compensation,
  onResolveCompensation,
  returnFocusTarget,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [expandedReleaseIds, setExpandedReleaseIds] = useState<Set<string>>(
    () => new Set(releases[0] ? [releases[0].id] : []),
  );

  const hasPendingCompensation = compensation?.status === 'pending';
  useFocusTrap(dialogRef, true, returnFocusTarget);
  useEscapeKey(onClose, !hasPendingCompensation);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        aria-describedby="whats-new-summary"
        tabIndex={-1}
        className="flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-[#171717] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-white/10 bg-[#1e1e1e] p-4 shrink-0">
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2 text-amber-300">
            <ScrollText size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="whats-new-title" className="text-lg font-bold text-gray-100">What&apos;s New</h2>
            <p id="whats-new-summary" className="text-xs text-gray-500">
              Release notes for Fate-Locked Ironman, newest first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={hasPendingCompensation}
            aria-label="Close What's New"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto custom-scrollbar p-3 sm:p-4">
          <div className="space-y-2">
            {compensation?.status === 'pending' && (
              <div className="rounded-lg border border-violet-400/30 bg-violet-950/20 p-3">
                <h4 className="text-sm font-bold text-violet-200">Your compensation options</h4>
                <div className="mt-2 space-y-1 text-sm text-gray-300">
                  <p>
                    {compensation.chaosKeys} missed Chaos Key{compensation.chaosKeys === 1 ? '' : 's'}
                  </p>
                  <p>
                    {compensation.pityKeys} missed Standard Pity Key{compensation.pityKeys === 1 ? '' : 's'}
                  </p>
                  <p>Resulting Fate balance: {compensation.fatePoints}</p>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  This choice is permanent and cannot be changed later.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => onResolveCompensation?.('none')}
                    className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5"
                  >
                    Continue without compensation
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveCompensation?.('chaos')}
                    className="rounded-md border border-cyan-400/30 bg-cyan-950/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/30"
                  >
                    Claim Chaos Keys only
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveCompensation?.('full')}
                    className="rounded-md bg-violet-500 px-3 py-2 text-xs font-bold text-white hover:bg-violet-400"
                  >
                    Claim full compensation
                  </button>
                </div>
              </div>
            )}

            {releases.map((release) => {
              const expanded = expandedReleaseIds.has(release.id);
              const panelId = panelIdFor(release.id);
              const toggleId = toggleIdFor(release.id);

              return (
                <section key={release.id} className="overflow-hidden rounded-lg border border-white/10 bg-[#1b1b1b]">
                  <h3>
                    <button
                      id={toggleId}
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedReleaseIds((current) => toggleExpandedRelease(current, release.id))}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-100">{release.title}</span>
                        <time dateTime={release.date} className="mt-0.5 block text-[11px] font-mono text-gray-500">
                          {formatReleaseDate(release.date)}
                        </time>
                      </span>
                      <ChevronDown
                        size={17}
                        aria-hidden="true"
                        className={`shrink-0 text-amber-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={toggleId}
                    hidden={!expanded}
                    className="border-t border-white/10 px-3 py-3"
                  >
                    {expanded && (
                      <div className="space-y-4">
                        {SECTION_META.map(({ key, label, icon: Icon, color }) => {
                          const notes = release.sections[key];
                          if (!notes?.length) return null;

                          return (
                            <div key={key}>
                              <h4 className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest ${color}`}>
                                <Icon size={14} aria-hidden="true" />
                                {label}
                              </h4>
                              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-gray-300 marker:text-amber-500/80">
                                {notes.map((note) => {
                                  const noteKey = typeof note === 'string'
                                    ? note
                                    : `${note.text}:${note.link.href}`;

                                  return (
                                    <li key={noteKey}>
                                      {typeof note === 'string' ? note : (
                                        <>
                                          {note.text}{' '}
                                          <a
                                            href={note.link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-300 underline decoration-amber-500/50 underline-offset-2 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                                          >
                                            {note.link.label}
                                          </a>
                                          .
                                        </>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="flex justify-end border-t border-white/10 bg-[#171717] p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={hasPendingCompensation}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-black hover:bg-amber-500"
          >
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ChangelogModal;
