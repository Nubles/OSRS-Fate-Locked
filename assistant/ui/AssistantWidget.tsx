import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Send, Power, ChevronDown } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { chunkContentService } from '../../services/ChunkContentService';
import { runTurn, AssistantReply } from '../engine/dispatcher';
import { LocalBackend } from '../engine/localBackend';
import { WebGpuBackend } from '../engine/webgpuBackend';
import { runAction } from '../tools';
import { setAssistantEnabled, ASSISTANT_PROTOTYPE_LABEL } from '../config';
import type { InferenceBackend, AssistantAction } from '../types';

interface Msg { role: 'user' | 'bot'; text: string; actions?: AssistantAction[] }

const BACKENDS: InferenceBackend[] = [new LocalBackend(), new WebGpuBackend()];

const GREETING: Msg = {
  role: 'bot',
  text: [
    "Hi! I'm the Fate Assistant (a prototype). I answer from this app's own data, so I won't make up OSRS facts.",
    'Try: “where can I find coal?”, “why is Dragon Slayer II locked?”, “what can I do in Falador?”, “go to Varrock”.',
  ].join('\n'),
};

export const AssistantWidget: React.FC = () => {
  const { unlocks } = useGame();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [backendId, setBackendId] = useState('local');
  const [status, setStatus] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const backend = useMemo(() => BACKENDS.find(b => b.id === backendId) ?? BACKENDS[0], [backendId]);

  useEffect(() => { if (open) chunkContentService.init(); }, [open]);
  useEffect(() => { backend.status().then(setStatus); }, [backend]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const reply: AssistantReply = await runTurn(text, backend, { unlocks });
      setMsgs(m => [...m, { role: 'bot', text: reply.text, actions: reply.actions }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'bot', text: 'Something went wrong handling that.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-violet-900/80 border border-violet-500/40 text-violet-100 text-xs font-bold shadow-xl hover:bg-violet-800 backdrop-blur-sm"
        title="Open the Fate Assistant (prototype)"
      >
        <Sparkles size={14} /> Assistant
        <span className="text-[8px] px-1 rounded bg-violet-950/80 text-violet-300 tracking-wider">{ASSISTANT_PROTOTYPE_LABEL}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] h-[460px] max-h-[calc(100vh-6rem)] flex flex-col bg-[#161616]/97 border border-violet-500/30 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-2.5 border-b border-white/10 flex items-center gap-2">
        <Sparkles size={14} className="text-violet-300 shrink-0" />
        <span className="text-[13px] font-bold text-white">Fate Assistant</span>
        <span className="text-[8px] px-1 rounded bg-violet-950/80 text-violet-300 tracking-wider">{ASSISTANT_PROTOTYPE_LABEL}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => { if (window.confirm('Turn off the assistant prototype? You can re-enable it any time.')) setAssistantEnabled(false); }}
            className="p-1 text-gray-500 hover:text-red-400" title="Turn off the assistant"
          >
            <Power size={13} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 text-gray-500 hover:text-white" title="Minimise">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Backend selector + status */}
      <div className="shrink-0 px-2.5 py-1.5 border-b border-white/5 flex items-center gap-2 text-[10px]">
        <div className="relative">
          <select
            value={backendId}
            onChange={e => setBackendId(e.target.value)}
            className="appearance-none bg-black/40 border border-white/10 rounded pl-1.5 pr-5 py-0.5 text-gray-300 focus:outline-none focus:border-violet-400/40"
            aria-label="Assistant engine"
          >
            {BACKENDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-gray-500 truncate" title={status}>{status}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block text-left text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-violet-900/40 text-violet-100' : 'bg-white/5 text-gray-200'}`}>
              {m.text}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.actions.map((a, j) => (
                  <button
                    key={j}
                    onClick={() => runAction(a)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/40"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-[11px] text-gray-500 animate-pulse">thinking…</div>}
      </div>

      {/* Input */}
      <div className="shrink-0 p-2 border-t border-white/10 flex items-center gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Ask about unlocks, locations, quests…"
          className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-400/40"
        />
        <button onClick={send} disabled={busy} className="p-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-40" title="Send">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};
