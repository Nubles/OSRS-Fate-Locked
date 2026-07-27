import React, { useRef, useState } from 'react';
import { ChevronDown, ScrollText, X } from 'lucide-react';
import type { ChangelogRelease, ChangelogSection } from '../data/changelog';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface ChangelogModalProps {
  releases: readonly ChangelogRelease[];
  onClose: () => void;
}

const SECTION_ORDER: readonly ChangelogSection[] = ['added', 'changed', 'fixed', 'balance'];

const SECTION_LABELS: Record<ChangelogSection, string> = {
  added: 'Added',
  changed: 'Changed',
  fixed: 'Fixed',
  balance: 'Balance',
};

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

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ releases, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [expandedReleaseIds, setExpandedReleaseIds] = useState<Set<string>>(
    () => new Set(releases[0] ? [releases[0].id] : []),
  );

  useFocusTrap(dialogRef);
  useEscapeKey(onClose);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      tabIndex={-1}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-[#171717] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#1e1e1e] p-4 shrink-0">
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2 text-amber-300">
            <ScrollText size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="whats-new-title" className="text-lg font-bold text-gray-100">What&apos;s New</h2>
            <p className="text-xs text-gray-500">Release notes for Fate-Locked Ironman</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close What's New"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

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
                        {SECTION_ORDER.map((section) => {
                          const notes = release.sections[section];
                          if (!notes?.length) return null;

                          return (
                            <div key={section}>
                              <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                                {SECTION_LABELS[section]}
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
      </div>
    </div>
  );
};
