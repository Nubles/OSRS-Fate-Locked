/**
 * Fate Assistant — single mount point. Add <AssistantMount/> once in App.tsx;
 * remove that line + delete this `assistant/` folder to fully uninstall.
 *
 * OFF by default. When disabled, shows only a small opt-in pill so the app is
 * unchanged for everyone who doesn't want it. When enabled, lazy-loads the chat
 * widget (kept out of the main bundle). The user can toggle it on/off any time.
 */
import React, { Suspense, lazy, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAssistantEnabled, setAssistantEnabled, ASSISTANT_PROTOTYPE_LABEL } from './config';

const AssistantWidget = lazy(() =>
  import('./ui/AssistantWidget').then(m => ({ default: m.AssistantWidget })));

const OptInPill: React.FC = () => {
  const [card, setCard] = useState(false);
  if (card) {
    return (
      <div className="fixed bottom-4 right-4 z-40 w-[280px] max-w-[calc(100vw-2rem)] bg-[#161616]/97 border border-violet-500/30 rounded-xl shadow-2xl backdrop-blur-sm p-3 text-[11px] text-gray-300">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={13} className="text-violet-300" />
          <span className="font-bold text-white text-[12px]">Fate Assistant</span>
          <span className="text-[8px] px-1 rounded bg-violet-950/80 text-violet-300 tracking-wider">{ASSISTANT_PROTOTYPE_LABEL}</span>
          <button onClick={() => setCard(false)} className="ml-auto text-gray-500 hover:text-white"><X size={13} /></button>
        </div>
        <p className="leading-relaxed text-gray-400">
          An experimental natural-language helper that answers from this app's own
          data (unlocks, chunks, quests) and can navigate the UI for you. It's
          optional — the app works exactly as before without it, and you can turn
          it off again any time.
        </p>
        <button
          onClick={() => setAssistantEnabled(true)}
          className="mt-2 w-full py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white text-[11px] font-bold"
        >
          Enable prototype
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setCard(true)}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 border border-violet-500/25 text-violet-300/80 text-[10px] font-bold shadow-lg hover:text-violet-200 hover:border-violet-400/40 backdrop-blur-sm"
      title="Try the experimental assistant"
    >
      <Sparkles size={12} /> Assistant
      <span className="text-[7px] px-1 rounded bg-violet-950/70 tracking-wider">{ASSISTANT_PROTOTYPE_LABEL}</span>
    </button>
  );
};

export const AssistantMount: React.FC = () => {
  const enabled = useAssistantEnabled();
  if (!enabled) return <OptInPill />;
  return (
    <Suspense fallback={null}>
      <AssistantWidget />
    </Suspense>
  );
};
