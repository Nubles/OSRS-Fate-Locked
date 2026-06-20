import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, Dice5, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useGame } from '../context/GameContext';

/**
 * Auto-Roll (PROTOTYPE)
 * ─────────────────────
 * Type an OSRS username → pull the account's real skill levels from a public
 * API and "auto-roll" the run so the app's progression matches what you've
 * already earned in-game.
 *
 * Data source: Wise Old Man (https://wiseoldman.net) — its v2 API sends CORS
 * headers, so the browser can call it directly. The official Jagex hiscores do
 * NOT send CORS headers, so they can't be fetched client-side without a proxy;
 * WOM mirrors the same hiscore data and auto-tracks unknown players on update.
 *
 * This is a prototype: it syncs SKILL LEVELS only (the cleanest 1:1 mapping).
 * Bosses/diaries/collection-log syncing is sketched in the UI but not wired.
 */

const WOM_BASE = 'https://api.wiseoldman.net/v2/players/';

// App skill names in display order. WOM uses lowercase metric keys; the only
// non-trivial remaps are runecrafting→Runecraft and the already-capitalised rest.
const SKILLS = [
  'Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic',
  'Runecraft', 'Construction', 'Agility', 'Herblore', 'Thieving', 'Crafting',
  'Fletching', 'Slayer', 'Hunter', 'Mining', 'Smithing', 'Fishing', 'Cooking',
  'Firemaking', 'Woodcutting', 'Farming',
] as const;

const womMetric = (skill: string) =>
  skill === 'Runecraft' ? 'runecrafting' : skill.toLowerCase();

interface FetchedSkill { skill: string; level: number }
interface Fetched {
  displayName: string;
  totalLevel: number;
  combatLevel: number | null;
  skills: FetchedSkill[];
  updatedAt: string | null;
}

async function fetchPlayer(name: string): Promise<Fetched> {
  const url = WOM_BASE + encodeURIComponent(name.trim());
  // POST forces a fresh update and tracks players WOM hasn't seen before.
  let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  // If the update path is rate-limited or rejected, fall back to a plain read.
  if (!res.ok && res.status !== 400) res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`"${name}" isn't on the OSRS hiscores / Wise Old Man.`);
    if (res.status === 429) throw new Error('Rate-limited by the API — wait a moment and retry.');
    throw new Error(`Wise Old Man API error (${res.status}).`);
  }
  const data = await res.json();
  const snap = data?.latestSnapshot?.data?.skills;
  if (!snap) throw new Error('No skill snapshot returned for this account.');

  const skills: FetchedSkill[] = SKILLS.map(s => {
    const entry = snap[womMetric(s)];
    const level = entry && typeof entry.level === 'number' && entry.level > 0 ? entry.level : 1;
    return { skill: s, level };
  });
  return {
    displayName: data.displayName ?? name,
    totalLevel: snap.overall?.level ?? skills.reduce((a, s) => a + s.level, 0),
    combatLevel: typeof data.combatLevel === 'number' ? data.combatLevel : null,
    skills,
    updatedAt: data.updatedAt ?? null,
  };
}

export function AutoRollPanel() {
  const { unlocks, importSave, createBackup, getExportData } = useGame() as any;
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'loaded'>('idle');
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [rolledTo, setRolledTo] = useState(0); // how many skills the roll animation has revealed
  const [applied, setApplied] = useState(false);
  const rollTimer = useRef<number | null>(null);

  const currentLevels: Record<string, number> = unlocks?.levels ?? {};

  // Skills where the real account is ahead of the app run — the "needed" rolls.
  const gains = useMemo(() => {
    if (!fetched) return [];
    return fetched.skills
      .map(s => ({ ...s, current: currentLevels[s.skill] ?? 1 }))
      .filter(s => s.level > s.current);
  }, [fetched, currentLevels]);

  const onFetch = useCallback(async () => {
    if (!name.trim()) return;
    setStatus('loading'); setError(''); setFetched(null); setRolledTo(0); setApplied(false);
    try {
      const data = await fetchPlayer(name);
      setFetched(data);
      setStatus('loaded');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reach the hiscores API.');
      setStatus('error');
    }
  }, [name]);

  // "Auto-roll": reveal each needed skill in sequence (slot-machine feel), then
  // commit the synced levels to the save in one merge.
  const autoRoll = useCallback(() => {
    if (!fetched || gains.length === 0) return;
    setRolledTo(0); setApplied(false);
    if (rollTimer.current) window.clearInterval(rollTimer.current);
    rollTimer.current = window.setInterval(() => {
      setRolledTo(prev => {
        const next = prev + 1;
        if (next >= gains.length) {
          if (rollTimer.current) window.clearInterval(rollTimer.current);
          // Commit once the reveal finishes.
          window.setTimeout(() => commit(), 250);
        }
        return next;
      });
    }, 90);
  }, [fetched, gains]);

  const commit = useCallback(() => {
    if (!fetched) return;
    const raw = getExportData?.();
    if (!raw) { setError('No active save to sync into.'); setStatus('error'); return; }
    let save: any;
    try { save = JSON.parse(raw); } catch { setError('Save data is unreadable.'); setStatus('error'); return; }

    const mergedLevels: Record<string, number> = { ...(save.unlocks?.levels ?? {}) };
    for (const s of fetched.skills) {
      mergedLevels[s.skill] = Math.max(mergedLevels[s.skill] ?? 1, s.level);
    }
    save.unlocks = { ...(save.unlocks ?? {}), levels: mergedLevels };

    createBackup?.('Before Auto-Roll sync');
    importSave(save);
    setApplied(true);
  }, [fetched, getExportData, createBackup, importSave]);

  const totalGain = gains.reduce((a, s) => a + (s.level - s.current), 0);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Dice5 size={20} className="text-fuchsia-400" /> Auto-Roll
            <span className="text-[10px] uppercase tracking-wide bg-fuchsia-500/20 text-fuchsia-300 px-1.5 py-0.5 rounded">Prototype</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Pull your real account from the OSRS hiscores and auto-roll your run to match what you've already earned.
            Powered by the <span className="text-gray-400">Wise Old Man</span> API. Currently syncs skill levels.
          </p>
        </div>
      </div>

      {/* Username input */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="flex items-center gap-2 flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 focus-within:border-fuchsia-500/60">
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFetch()}
            placeholder="OSRS username…"
            className="flex-1 min-w-0 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none"
            maxLength={12}
          />
        </div>
        <button
          onClick={onFetch}
          disabled={status === 'loading' || !name.trim()}
          className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-1.5 shrink-0"
        >
          {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Fetch
        </button>
      </div>

      {status === 'error' && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 max-w-xl">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {fetched && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <div>
              <div className="text-base font-bold text-white">{fetched.displayName}</div>
              <div className="text-[11px] text-gray-500">
                Total level <span className="text-gray-300 font-mono">{fetched.totalLevel}</span>
                {fetched.combatLevel != null && <> · Combat <span className="text-gray-300 font-mono">{fetched.combatLevel}</span></>}
              </div>
            </div>
            <div className="flex-1" />
            {gains.length > 0 && !applied && (
              <button
                onClick={autoRoll}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-emerald-600 hover:from-fuchsia-500 hover:to-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg"
              >
                <Sparkles size={16} /> Auto-roll {gains.length} skill{gains.length === 1 ? '' : 's'} (+{totalGain})
              </button>
            )}
            {applied && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
                <CheckCircle2 size={18} /> Synced — backup saved
              </div>
            )}
            {gains.length === 0 && (
              <div className="text-sm text-gray-400">Your run already matches or exceeds this account.</div>
            )}
          </div>

          {/* Skill grid: current → real, gains highlighted; reveal during roll. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {fetched.skills.map((s) => {
              const current = currentLevels[s.skill] ?? 1;
              const isGain = s.level > current;
              const gainIdx = gains.findIndex(g => g.skill === s.skill);
              const revealed = !isGain || applied || (gainIdx > -1 && gainIdx < rolledTo);
              return (
                <div
                  key={s.skill}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs transition-colors ${
                    isGain && !applied
                      ? revealed ? 'border-emerald-500/50 bg-emerald-950/30' : 'border-fuchsia-500/30 bg-fuchsia-950/20'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className="text-gray-300 truncate">{s.skill}</span>
                  <span className="font-mono shrink-0 flex items-center gap-1">
                    {isGain && !applied && (
                      <>
                        <span className="text-gray-600">{current}</span>
                        <span className="text-gray-600">→</span>
                      </>
                    )}
                    <span className={isGain ? (revealed ? 'text-emerald-300 font-bold' : 'text-gray-600') : 'text-gray-400'}>
                      {revealed ? s.level : '··'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-600">
            Hiscores data via Wise Old Man · prototype syncs skill levels only · a backup is created before applying.
          </p>
        </div>
      )}

      {status === 'idle' && (
        <div className="text-xs text-gray-600 max-w-xl border border-dashed border-white/10 rounded-lg px-4 py-6 text-center">
          Enter a username above to fetch live hiscores. Try a maxed account like <span className="text-gray-400">"Lynx Titan"</span> to see a full auto-roll.
        </div>
      )}
    </div>
  );
}

export default AutoRollPanel;
