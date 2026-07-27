import React, { useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, RefreshCw, ScrollText, Sparkles, X } from 'lucide-react';
import type { ChangelogRelease, ChangelogSection } from '../data/changelog';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface ChangelogModalProps {
  releases: readonly ChangelogRelease[];
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
  returnFocusTarget,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [expandedReleaseIds, setExpandedReleaseIds] = useState<Set<string>>(
    () => new Set(releases[0] ? [releases[0].id] : []),
  );

  useFocusTrap(dialogRef, true, returnFocusTarget);
  useEscapeKey(onClose, true);

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
            aria-label="Close What's New"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto custom-scrollbar p-3 sm:p-4">
          <div className="space-y-2">
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
                                {notes.map((note) => <li key={note}>{note}</li>)}
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