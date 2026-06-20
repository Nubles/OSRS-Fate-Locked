import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, Dice5, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, Swords, Lock } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { buildKeyFaucets, DEFAULT_ROLL_CAP, type FaucetGroup } from '../utils/autoRollSources';

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
  bosses: Record<string, any>;
  activities: Record<string, any>;
  updatedAt: string | null;
}

async function fetchPlayer(name: string): Promise<Fetched> {
  const url = WOM_BASE + encodeURIComponent(name.trim());
  // Read first (fast, works for already-tracked players).
  let res = await fetch(url);
  let data = res.ok ? await res.json() : null;

  // If the player is unknown (404) or the read didn't carry a snapshot, POST to
  // track + import them, which returns a full latestSnapshot for valid RSNs.
  if (!data?.latestSnapshot) {
    const post = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (post.ok) {
      data = await post.json();
    } else if (!data) {
      // Both the read and the update failed → report the most useful reason.
      if (post.status === 404 || res.status === 404) throw new Error(`"${name}" isn't on the OSRS hiscores.`);
      if (post.status === 429) throw new Error('Rate-limited by the API — wait a moment and retry.');
      const body = await post.json().catch(() => null);
      if (body?.code === 'HISCORES_USERNAME_NOT_FOUND') throw new Error(`"${name}" isn't on the OSRS hiscores — check the spelling.`);
      throw new Error(`Wise Old Man API error (${post.status}).`);
    }
  }

  const snap = data?.latestSnapshot?.data?.skills;
  if (!snap) throw new Error(`No hiscores snapshot available for "${name}" yet — try again in a moment.`);

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
    bosses: data.latestSnapshot?.data?.bosses ?? {},
    activities: data.latestSnapshot?.data?.activities ?? {},
    updatedAt: data.updatedAt ?? null,
  };
}

export function AutoRollPanel() {
  const { unlocks, importSave, createBackup, getExportData, rollForKey, keys } = useGame() as any;
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'loaded'>('idle');
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [rolledTo, setRolledTo] = useState(0); // how many skills the roll animation has revealed
  const [applied, setApplied] = useState(false);
  const rollTimer = useRef<number | null>(null);

  // Key-faucet auto-roll state.
  const [keyRolling, setKeyRolling] = useState(false);
  const [keyRollProgress, setKeyRollProgress] = useState(0); // 0..1
  const [keysGained, setKeysGained] = useState<number | null>(null);
  const keysBefore = useRef(0);
  const keyTimer = useRef<number | null>(null);

  const currentLevels: Record<string, number> = unlocks?.levels ?? {};
  const unlockedSkills: Record<string, number> = unlocks?.skills ?? {};
  // A skill can only be levelled once it's been unlocked in the run.
  const isUnlocked = useCallback((skill: string) => (unlockedSkills[skill] ?? 0) > 0, [unlockedSkills]);
  // Always-fresh key count, so we can diff before/after a burst of rolls.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const faucets: FaucetGroup[] = useMemo(
    () => (fetched ? buildKeyFaucets(fetched.bosses, fetched.activities) : []),
    [fetched],
  );
  const totalRolls = faucets.reduce((a, f) => a + f.rolls, 0);

  // Skills where the real account is ahead AND the skill is unlocked in the run.
  // Locked skills can't be levelled, so they're never rolled.
  const gains = useMemo(() => {
    if (!fetched) return [];
    return fetched.skills
      .map(s => ({ ...s, current: currentLevels[s.skill] ?? 1 }))
      .filter(s => s.level > s.current && isUnlocked(s.skill));
  }, [fetched, currentLevels, isUnlocked]);

  const onFetch = useCallback(async () => {
    if (!name.trim()) return;
    setStatus('loading'); setError(''); setFetched(null); setRolledTo(0); setApplied(false);
    setKeyRolling(false); setKeyRollProgress(0); setKeysGained(null);
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

    // Only sync levels for skills already unlocked in the run — locked skills
    // can't be levelled, so writing a level there wouldn't count.
    const unlockedNow: Record<string, number> = save.unlocks?.skills ?? {};
    const mergedLevels: Record<string, number> = { ...(save.unlocks?.levels ?? {}) };
    for (const s of fetched.skills) {
      if ((unlockedNow[s.skill] ?? 0) <= 0) continue;
      mergedLevels[s.skill] = Math.max(mergedLevels[s.skill] ?? 1, s.level);
    }
    save.unlocks = { ...(save.unlocks ?? {}), levels: mergedLevels };

    createBackup?.('Before Auto-Roll sync');
    importSave(save);
    setApplied(true);
  }, [fetched, getExportData, createBackup, importSave]);

  // Roll the key faucets derived from real boss/clue/minigame history. Runs the
  // real rollForKey faucet (logs to history, awards keys, can crit Omni) in
  // batches so the UI stays responsive and shows progress.
  const autoRollKeys = useCallback(() => {
    if (keyRolling || totalRolls === 0) return;
    keysBefore.current = keysRef.current;
    setKeysGained(null); setKeyRolling(true); setKeyRollProgress(0);

    const queue: { source: string; rate: number }[] = [];
    for (const f of faucets) for (let i = 0; i < f.rolls; i++) queue.push({ source: f.source, rate: f.rate });

    let i = 0;
    const BATCH = 6;
    if (keyTimer.current) window.clearInterval(keyTimer.current);
    keyTimer.current = window.setInterval(() => {
      for (let b = 0; b < BATCH && i < queue.length; b++, i++) rollForKey(queue[i].source, queue[i].rate);
      setKeyRollProgress(queue.length ? Math.min(1, i / queue.length) : 1);
      if (i >= queue.length) {
        if (keyTimer.current) window.clearInterval(keyTimer.current);
        setKeyRolling(false);
        window.setTimeout(() => setKeysGained(keysRef.current - keysBefore.current), 250);
      }
    }, 70);
  }, [keyRolling, totalRolls, faucets, rollForKey]);

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
              <div className="text-sm text-gray-400">
                {fetched.skills.some(s => !isUnlocked(s.skill) && s.level > (currentLevels[s.skill] ?? 1))
                  ? 'No unlocked skills to roll — unlock more skills in the run first.'
                  : 'Your unlocked skills already match or exceed this account.'}
              </div>
            )}
          </div>

          {/* Skill grid: current → real, gains highlighted; reveal during roll. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {fetched.skills.map((s) => {
              const current = currentLevels[s.skill] ?? 1;
              const unlocked = isUnlocked(s.skill);
              const isGain = s.level > current && unlocked;
              const gainIdx = gains.findIndex(g => g.skill === s.skill);
              const revealed = !isGain || applied || (gainIdx > -1 && gainIdx < rolledTo);
              return (
                <div
                  key={s.skill}
                  title={!unlocked ? `${s.skill} isn't unlocked yet — unlock it in the run before it can be rolled` : undefined}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs transition-colors ${
                    !unlocked
                      ? 'border-white/5 bg-black/20 opacity-50'
                      : isGain && !applied
                        ? revealed ? 'border-emerald-500/50 bg-emerald-950/30' : 'border-fuchsia-500/30 bg-fuchsia-950/20'
                        : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className="text-gray-300 truncate flex items-center gap-1">
                    {!unlocked && <Lock size={9} className="text-gray-500 shrink-0" />}
                    {s.skill}
                  </span>
                  <span className="font-mono shrink-0 flex items-center gap-1">
                    {!unlocked ? (
                      <span className="text-gray-600 text-[10px] uppercase tracking-wide">locked</span>
                    ) : (
                      <>
                        {isGain && !applied && (
                          <>
                            <span className="text-gray-600">{current}</span>
                            <span className="text-gray-600">→</span>
                          </>
                        )}
                        <span className={isGain ? (revealed ? 'text-emerald-300 font-bold' : 'text-gray-600') : 'text-gray-400'}>
                          {revealed ? s.level : '··'}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Key faucets from real PvM / clue / minigame history ─────────── */}
          {faucets.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Swords size={15} className="text-amber-400" /> Earn keys from your history
                </h3>
                <span className="text-[10px] text-gray-500">
                  bosses · clues · minigames — each source capped at {DEFAULT_ROLL_CAP} rolls
                </span>
                <div className="flex-1" />
                {keysGained == null ? (
                  <button
                    onClick={autoRollKeys}
                    disabled={keyRolling || totalRolls === 0}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-fuchsia-600 hover:from-amber-500 hover:to-fuchsia-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-lg"
                  >
                    {keyRolling ? <Loader2 size={15} className="animate-spin" /> : <Dice5 size={15} />}
                    {keyRolling ? 'Rolling…' : `Auto-roll ${totalRolls} keys`}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                    <KeyRound size={16} /> +{keysGained} key{keysGained === 1 ? '' : 's'} earned
                  </div>
                )}
              </div>

              {keyRolling && (
                <div className="h-1.5 w-full bg-white/10 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-fuchsia-400 transition-[width] duration-75" style={{ width: `${Math.round(keyRollProgress * 100)}%` }} />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {faucets.map(f => (
                  <div key={f.key} className="flex items-center justify-between px-2.5 py-1.5 rounded border border-white/10 bg-white/5 text-xs">
                    <span className="text-gray-300 truncate" title={`${f.real.toLocaleString()} real`}>{f.label}</span>
                    <span className="font-mono shrink-0 flex items-center gap-1.5">
                      <span className="text-gray-500" title="real completions">{f.real.toLocaleString()}</span>
                      <span className="text-amber-300" title={`rolling ${f.rolls} at ${f.rate}%`}>🎲{f.rolls}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-600">
            Hiscores data via Wise Old Man · skill levels sync exactly; key faucets roll a capped sample of your real
            history through the live RNG engine (logged to History, can crit Omni) · a backup is created before syncing levels.
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
