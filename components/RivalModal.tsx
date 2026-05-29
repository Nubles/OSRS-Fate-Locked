import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Swords, Crown, Skull, Flag, Clock, Trash2, Sparkles, ClipboardPaste,
  Loader2, AlertTriangle, ChevronRight, Zap,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { completionPercent } from '../utils/completion';
import { decodeSyncCode } from '../utils/syncCode';
import { UnlockState } from '../types';
import {
  RIVAL_PERSONAS, makeSimRival, makeFriendRival, rivalCompletion, rivalDaysTo,
  rivalHeadlines, standing, getPersona,
} from '../utils/rival';

interface Props {
  onClose: () => void;
}

const fmtDays = (d: number): string => {
  if (d <= 0) return 'now';
  if (d < 1) return '<1 day';
  if (d < 14) return `${Math.round(d)} days`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  return `${Math.round(d / 30)} months`;
};

const KIND_EMOJI: Record<string, string> = { boss: '☠️', region: '🗺️', minigame: '🎲', guild: '🏛️' };

export const RivalModal: React.FC<Props> = ({ onClose }) => {
  const { unlocks, rival, setRival, clearRival, ackRival } = useGame();
  useEscapeKey(onClose, true);

  const playerPct = useMemo(() => completionPercent(unlocks), [unlocks]);

  // Tick so a simulated rival's bar creeps while the modal is open.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!rival) {
    return <Setup onClose={onClose} onStart={setRival} />;
  }

  const rivalPct = rivalCompletion(rival, now);
  const st = standing(playerPct, rivalPct);
  const headlines = rival.mode === 'sim' ? rivalHeadlines(rival, rivalPct) : [];
  const recent = headlines.slice(-3).reverse();
  const reach100 = rivalDaysTo(rival, now, 100);
  const catchUp = rival.mode === 'sim' && st.lead > 0 ? rivalDaysTo(rival, now, playerPct) : null;

  // One-time taunt if the lead flipped since last view.
  const flipped = rival.lastSeenLead != null && Math.sign(rival.lastSeenLead) !== Math.sign(st.lead) && st.lead !== 0;
  const ack = () => ackRival(st.lead);

  return (
    <Shell onClose={onClose} title={`${rival.emoji} ${rival.name}`} subtitle={rival.mode === 'friend' ? "A friend's snapshot" : `Pace: ~${rival.keysPerDay} keys/day`}>
      <div className="p-4 space-y-4">
        {flipped && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${st.lead > 0 ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300' : 'border-red-500/30 bg-red-950/30 text-red-300'}`}>
            {st.lead > 0 ? <Crown size={15} /> : <Skull size={15} />}
            <p className="text-[12px] font-bold">{st.lead > 0 ? `You retook the lead!` : `${rival.name} overtook you!`}</p>
            <button onClick={ack} className="ml-auto text-[10px] underline opacity-70 hover:opacity-100">dismiss</button>
          </div>
        )}

        {/* The race */}
        <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4 space-y-3">
          <RaceBar label="You" emoji="🧑‍🚀" pct={playerPct} color="bg-cyan-500" accent="text-cyan-300" leading={st.leader === 'you'} />
          <RaceBar label={rival.name} emoji={rival.emoji} pct={rivalPct} color="bg-fuchsia-500" accent="text-fuchsia-300" leading={st.leader === 'rival'} />
          <div className="pt-1 text-center">
            {st.leader === 'tie' ? (
              <span className="text-[13px] font-bold text-gray-300">Neck and neck — {playerPct}% all square.</span>
            ) : st.leader === 'you' ? (
              <span className="text-[13px] font-bold text-emerald-300 flex items-center justify-center gap-1.5"><Crown size={14} /> You lead by {st.lead}%</span>
            ) : (
              <span className="text-[13px] font-bold text-red-300 flex items-center justify-center gap-1.5"><Flag size={14} /> {rival.name} leads by {-st.lead}%</span>
            )}
          </div>
        </div>

        {/* Projections (sim only) */}
        {rival.mode === 'sim' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-3">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gray-500 mb-1"><Zap size={11} className="text-fuchsia-400" /> Catches your {playerPct}%</div>
              <div className="text-[15px] font-bold text-gray-100">{st.lead <= 0 ? 'already has' : catchUp != null ? `in ~${fmtDays(catchUp)}` : '—'}</div>
            </div>
            <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-3">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gray-500 mb-1"><Clock size={11} className="text-emerald-400" /> Reaches 100%</div>
              <div className="text-[15px] font-bold text-gray-100">{reach100 != null ? `~${fmtDays(reach100)}` : '—'}</div>
            </div>
          </div>
        )}

        {/* Rival's notable unlocks */}
        {recent.length > 0 && (
          <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
            <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-2">{rival.name} recently grabbed</div>
            <div className="space-y-1.5">
              {recent.map((h) => (
                <div key={h.name} className="flex items-center gap-2 text-[12px]">
                  <span>{KIND_EMOJI[h.kind] ?? '✨'}</span>
                  <span className="text-gray-200 truncate">{h.name}</span>
                  <span className="text-[9px] text-gray-600 uppercase ml-auto">{h.kind}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manage */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => { clearRival(); }} className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-red-300 transition-colors">
            <Trash2 size={12} /> Remove rival
          </button>
          <button onClick={ack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold transition-colors">
            <Swords size={12} /> Keep racing
          </button>
        </div>
      </div>
    </Shell>
  );
};

// ── Race bar row ─────────────────────────────────────────────────────────────
const RaceBar: React.FC<{ label: string; emoji: string; pct: number; color: string; accent: string; leading: boolean }> = ({ label, emoji, pct, color, accent, leading }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5 truncate">
        <span>{emoji}</span>{label}{leading && <Crown size={11} className="text-amber-400" />}
      </span>
      <span className={`text-[13px] font-black ${accent}`}>{pct}%</span>
    </div>
    <div className="h-3 rounded-full bg-black/50 border border-white/5 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  </div>
);

// ── Modal shell ──────────────────────────────────────────────────────────────
const Shell: React.FC<{ onClose: () => void; title: string; subtitle: string; children: React.ReactNode }> = ({ onClose, title, subtitle, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose} role="dialog" aria-modal="true" aria-label="Rival Ghost">
    <div className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
        <div className="p-2 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/30 text-fuchsia-300"><Swords size={18} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white leading-none truncate">{title}</h2>
          <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">{children}</div>
    </div>
  </div>
);

// ── Setup (no rival yet) ─────────────────────────────────────────────────────
const Setup: React.FC<{ onClose: () => void; onStart: (r: ReturnType<typeof makeSimRival>) => void }> = ({ onClose, onStart }) => {
  const [picked, setPicked] = useState<string>('steady');
  const [friendCode, setFriendCode] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSim = () => onStart(makeSimRival(picked));

  const startFriend = async () => {
    setDecoding(true); setError(null);
    const res = await decodeSyncCode(friendCode);
    setDecoding(false);
    if (!res.ok || !res.state) { setError(res.error ?? 'Could not read that code.'); return; }
    const u = (res.state as { unlocks?: UnlockState }).unlocks;
    if (!u) { setError('That code has no run data.'); return; }
    onStart(makeFriendRival("Friend's run", completionPercent(u)));
  };

  return (
    <Shell onClose={onClose} title="🏁 Choose a Rival" subtitle="Race a simulated nemesis — or a friend's run.">
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          {RIVAL_PERSONAS.map((p) => {
            const active = picked === p.id;
            return (
              <button key={p.id} onClick={() => setPicked(p.id)} className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${active ? 'border-fuchsia-500/50 bg-fuchsia-950/30' : 'border-white/10 bg-[#1a1a1a] hover:bg-white/5'}`}>
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-bold ${active ? 'text-fuchsia-200' : 'text-gray-200'}`}>{p.name}</div>
                  <div className="text-[10px] text-gray-500">{p.blurb}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-bold text-amber-300">~{p.keysPerDay}</div>
                  <div className="text-[8px] text-gray-600 uppercase">keys/day</div>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={startSim} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[12px] font-bold transition-colors">
          <Swords size={14} /> Start the race
        </button>

        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-gray-600">
          <div className="flex-1 h-px bg-white/10" /> or race a friend <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-gray-500">Paste a friend's <span className="text-fuchsia-300">sync code</span> to race their run as a snapshot.</p>
          <textarea
            value={friendCode}
            onChange={(e) => { setFriendCode(e.target.value); setError(null); }}
            placeholder="FLSYNC.g1.…"
            className="w-full h-16 resize-none rounded-lg bg-black/40 border border-white/10 p-2.5 font-mono text-[11px] text-gray-200 focus:outline-none focus:border-fuchsia-500/40 placeholder:text-gray-700"
          />
          {error && <p className="text-[10px] text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> {error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={async () => { try { setFriendCode(await navigator.clipboard.readText()); } catch { /* blocked */ } }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252525] border border-white/10 hover:bg-[#2d2d2d] text-gray-300 text-[11px] font-medium"><ClipboardPaste size={13} /> Paste</button>
            <button onClick={startFriend} disabled={!friendCode.trim() || decoding} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#252525] border border-fuchsia-500/30 hover:bg-fuchsia-950/40 disabled:opacity-40 disabled:cursor-not-allowed text-fuchsia-300 text-[11px] font-bold">
              {decoding ? <><Loader2 size={13} className="animate-spin" /> Reading…</> : <><Flag size={13} /> Race this run</>}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
};
