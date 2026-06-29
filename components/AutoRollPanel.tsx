import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, Dice5, CheckCircle2, AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { OnlineSyncPanel } from './OnlineSyncPanel';

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
/** WiseOldMan account `type` → a friendly label. GIM isn't distinguishable from
 *  the player type (WOM reports it as ironman/hardcore), so it's not listed. */
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ultimate: 'Ultimate Ironman',
  hardcore: 'Hardcore Ironman',
  ironman: 'Ironman',
  regular: 'Regular',
  unknown: 'Unknown',
};

interface Fetched {
  displayName: string;
  accountType: string;
  totalLevel: number;
  combatLevel: number | null;
  skills: FetchedSkill[];
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
    accountType: typeof data.type === 'string' ? data.type : 'unknown',
    totalLevel: snap.overall?.level ?? skills.reduce((a, s) => a + s.level, 0),
    combatLevel: typeof data.combatLevel === 'number' ? data.combatLevel : null,
    skills,
    updatedAt: data.updatedAt ?? null,
  };
}

export function AutoRollPanel() {
  const { unlocks, createBackup, levelUpSkill, keys, specialKeys, chaosKeys, linkedAccount, setLinkedAccount } = useGame() as any;
  // Each run binds to one OSRS account: once set, the input is locked to it.
  const [name, setName] = useState(linkedAccount ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'loaded'>('idle');
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [rolledTo, setRolledTo] = useState(0); // how many skills the roll animation has revealed
  const [applied, setApplied] = useState(false);
  const [skillRolling, setSkillRolling] = useState(false);
  const [skillKeysGained, setSkillKeysGained] = useState<{ keys: number; special: number; chaos: number } | null>(null);

  const currentLevels: Record<string, number> = unlocks?.levels ?? {};
  const unlockedSkills: Record<string, number> = unlocks?.skills ?? {};
  // A skill can only be levelled once it's been unlocked in the run.
  const isUnlocked = useCallback((skill: string) => (unlockedSkills[skill] ?? 0) > 0, [unlockedSkills]);
  // Fresh refs for the level-up loop: levelUpSkill closes over state, so we read
  // it fresh each tick (between ticks the component re-renders) to keep the
  // per-level key rate ramping correctly. Counts let us tally what was earned.
  const levelUpRef = useRef(levelUpSkill);
  levelUpRef.current = levelUpSkill;
  const countsRef = useRef({ keys, specialKeys, chaosKeys });
  countsRef.current = { keys, specialKeys, chaosKeys };
  const skillTimer = useRef<number | null>(null);

  // Skills where the real account is ahead AND the skill is unlocked in the run.
  // Locked skills can't be levelled, so they're never rolled.
  const gains = useMemo(() => {
    if (!fetched) return [];
    return fetched.skills
      .map(s => ({ ...s, current: currentLevels[s.skill] ?? 1 }))
      .filter(s => s.level > s.current && isUnlocked(s.skill));
  }, [fetched, currentLevels, isUnlocked]);

  const onFetch = useCallback(async () => {
    // Once bound, only that account can be fetched for this run.
    const query = (linkedAccount ?? name).trim();
    if (!query) return;
    setStatus('loading'); setError(''); setFetched(null); setRolledTo(0); setApplied(false);
    setSkillRolling(false); setSkillKeysGained(null);
    if (skillTimer.current) window.clearInterval(skillTimer.current);
    try {
      const data = await fetchPlayer(query);
      setFetched(data);
      setStatus('loaded');
      // Bind the run to this account on the first successful fetch.
      if (!linkedAccount) { setLinkedAccount?.(data.displayName); setName(data.displayName); }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reach the hiscores API.');
      setStatus('error');
    }
  }, [name, linkedAccount, setLinkedAccount]);

  // If the run is already bound, pull that account's hiscores on open.
  useEffect(() => { if (linkedAccount) onFetch(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  // "Auto-roll": walk each unlocked skill up to its real level through the LIVE
  // level-up engine — every level fires its key roll (chance = ceil(level/5)%),
  // the 2% chaos-key chance and the omni chance — so the run earns exactly the
  // keys those levels would have. Runs in batches for a responsive slot-machine
  // feel; tallies the keys/omni/chaos earned at the end.
  const autoRoll = useCallback(() => {
    if (!fetched || gains.length === 0 || skillRolling) return;
    createBackup?.('Before Auto-Roll skill sync');
    const before = { ...countsRef.current };

    // One queue entry per level still to gain, plus per-skill reveal boundaries.
    const queue: string[] = [];
    const bounds: number[] = [];
    for (const g of gains) {
      for (let lvl = g.current; lvl < g.level; lvl++) queue.push(g.skill);
      bounds.push(queue.length);
    }
    const total = queue.length;
    if (total === 0) return;

    setRolledTo(0); setApplied(false); setSkillRolling(true); setSkillKeysGained(null);
    const BATCH = Math.min(25, Math.max(1, Math.ceil(total / 50)));
    let i = 0;
    if (skillTimer.current) window.clearInterval(skillTimer.current);
    skillTimer.current = window.setInterval(() => {
      const levelUp = levelUpRef.current;
      for (let b = 0; b < BATCH && i < total; b++, i++) levelUp(queue[i]);
      let revealed = 0;
      for (const bnd of bounds) if (bnd <= i) revealed++;
      setRolledTo(revealed);
      if (i >= total) {
        if (skillTimer.current) window.clearInterval(skillTimer.current);
        setSkillRolling(false);
        window.setTimeout(() => {
          const a = countsRef.current;
          setSkillKeysGained({ keys: a.keys - before.keys, special: a.specialKeys - before.specialKeys, chaos: a.chaosKeys - before.chaosKeys });
          setApplied(true);
        }, 250);
      }
    }, 70);
  }, [fetched, gains, skillRolling, createBackup]);

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

      {/* Username input — locked to the bound account once set */}
      <div className="flex items-center gap-2 max-w-md">
        <div className={`flex items-center gap-2 flex-1 bg-black/40 border rounded-lg px-3 py-2 ${linkedAccount ? 'border-white/10' : 'border-white/15 focus-within:border-fuchsia-500/60'}`}>
          {linkedAccount ? <Lock size={14} className="text-fuchsia-400 shrink-0" /> : <Search size={14} className="text-gray-500 shrink-0" />}
          <input
            value={linkedAccount ?? name}
            onChange={(e) => !linkedAccount && setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFetch()}
            placeholder="OSRS username…"
            readOnly={!!linkedAccount}
            title={linkedAccount ? 'This run is permanently bound to this account' : undefined}
            className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none ${linkedAccount ? 'text-gray-300 cursor-default' : 'text-gray-100 placeholder:text-gray-600'}`}
            maxLength={12}
          />
        </div>
        <button
          onClick={onFetch}
          disabled={status === 'loading' || (!linkedAccount && !name.trim())}
          className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-1.5 shrink-0"
        >
          {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {linkedAccount ? 'Refresh' : 'Fetch'}
        </button>
      </div>
      {linkedAccount && (
        <p className="text-[10px] text-gray-500 -mt-2 flex items-center gap-1">
          <Lock size={9} /> This run is bound to <span className="text-gray-300">{linkedAccount}</span> — the account can't be changed.
        </p>
      )}

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
              <div className="text-base font-bold text-white flex items-center gap-2">
                {fetched.displayName}
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                  fetched.accountType === 'ultimate' ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : fetched.accountType === 'hardcore' ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : fetched.accountType === 'ironman' ? 'bg-gray-400/15 border-gray-400/40 text-gray-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'}`}>
                  {ACCOUNT_TYPE_LABEL[fetched.accountType] ?? 'Unknown'}
                </span>
              </div>
              <div className="text-[11px] text-gray-500">
                Total level <span className="text-gray-300 font-mono">{fetched.totalLevel}</span>
                {fetched.combatLevel != null && <> · Combat <span className="text-gray-300 font-mono">{fetched.combatLevel}</span></>}
              </div>
              {fetched.accountType === 'regular' && (
                <div className="text-[10px] text-amber-400/90 mt-0.5">⚠ Not an ironman account on the hiscores.</div>
              )}
            </div>
            <div className="flex-1" />
            {!applied && !skillRolling && gains.length > 0 && (
              <button
                onClick={autoRoll}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-emerald-600 hover:from-fuchsia-500 hover:to-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg"
              >
                <Sparkles size={16} /> Auto-roll {gains.length} skill{gains.length === 1 ? '' : 's'} (+{totalGain})
              </button>
            )}
            {skillRolling && (
              <div className="flex items-center gap-2 text-fuchsia-300 text-sm font-semibold">
                <Loader2 size={16} className="animate-spin" /> Rolling levels…
              </div>
            )}
            {applied && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold flex-wrap">
                <CheckCircle2 size={18} /> Synced
                {skillKeysGained && (skillKeysGained.keys + skillKeysGained.special + skillKeysGained.chaos) > 0 && (
                  <span className="font-normal text-gray-300">
                    · earned <span className="text-amber-300 font-semibold">{skillKeysGained.keys} key{skillKeysGained.keys === 1 ? '' : 's'}</span>
                    {skillKeysGained.special > 0 && <>, <span className="text-purple-300 font-semibold">{skillKeysGained.special} omni</span></>}
                    {skillKeysGained.chaos > 0 && <>, <span className="text-red-400 font-semibold">{skillKeysGained.chaos} chaos</span></>}
                  </span>
                )}
              </div>
            )}
            {!applied && !skillRolling && gains.length === 0 && (
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

          <p className="text-[10px] text-gray-600">
            Hiscores data via Wise Old Man · each synced level runs through the live RNG engine, so it awards keys, Omni and
            Chaos exactly as levelling it would — all logged to History · a backup is created first.
          </p>
        </div>
      )}

      {status === 'idle' && !linkedAccount && (
        <div className="text-xs text-gray-600 max-w-xl border border-dashed border-white/10 rounded-lg px-4 py-6 text-center">
          Enter your OSRS username to bind this run to your account. It's saved permanently to the run and can't be changed afterward.
        </div>
      )}

      <OnlineSyncPanel />
    </div>
  );
}

export default AutoRollPanel;
