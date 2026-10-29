import React from 'react';
import { History, X } from 'lucide-react';
import { useWelcomeBack } from '../hooks/useWelcomeBack';

/** Classic layout: the welcome-back note after a break, under the header like CoachStrip. */
export const WelcomeBackStrip: React.FC = () => {
  const welcome = useWelcomeBack();
  if (!welcome) return null;
  return (
    <div className="max-w-[1600px] mx-auto px-4">
      <div role="status" className="flex items-center gap-2.5 px-3 py-2 mt-2 rounded-lg bg-sky-950/25 border border-sky-500/20 animate-in fade-in slide-in-from-top-1 duration-300">
        <History size={13} className="text-sky-300 shrink-0" />
        <p className="text-[12px] text-sky-100/90 leading-snug flex-1 min-w-0">{welcome.text}</p>
        <button onClick={welcome.dismiss} className="shrink-0 p-1 text-sky-200/50 hover:text-white rounded" aria-label="Dismiss welcome back note" title="Hide this until your next break">
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

export default WelcomeBackStrip;
