import React, { useRef } from 'react';
import { CheckCircle2, RefreshCw, Sparkles, X } from 'lucide-react';
import type { ChangelogRelease, ChangelogSection } from '../data/changelog';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  release: ChangelogRelease;
  onClose: () => void;
}

const META: Array<{
  key: ChangelogSection;
  label: string;
  icon: typeof Sparkles;
  color: string;
}> = [
  { key: 'added', label: 'Added', icon: Sparkles, color: 'text-amber-300' },
  { key: 'changed', label: 'Changed', icon: RefreshCw, color: 'text-cyan-300' },
  { key: 'fixed', label: 'Fixed', icon: CheckCircle2, color: 'text-emerald-300' },
];

export const ChangelogModal: React.FC<Props> = ({ release, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useEscapeKey(onClose, true);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        aria-describedby="changelog-summary"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-[#121212] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#1a1a1a] p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
              {`What's New \u2014 ${release.date}`}
            </p>
            <h2 id="changelog-title" className="mt-1 text-xl font-black text-white">
              {release.title}
            </h2>
            <p id="changelog-summary" className="mt-1 text-sm text-gray-400">
              The latest additions, changes, and tracker corrections.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close What's New"
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="custom-scrollbar space-y-5 overflow-y-auto p-5">
          {META.map(({ key, label, icon: Icon, color }) => {
            const entries = release.sections[key];
            if (!entries?.length) return null;
            return (
              <section key={key} aria-labelledby={'changelog-' + key}>
                <h3
                  id={'changelog-' + key}
                  className={'flex items-center gap-2 text-sm font-bold ' + color}
                >
                  <Icon size={15} /> {label}
                </h3>
                <ul className="mt-2 space-y-2">
                  {entries.map(entry => (
                    <li
                      key={entry}
                      className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-gray-300"
                    >
                      {entry}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
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
