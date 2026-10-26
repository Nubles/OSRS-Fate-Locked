import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, CheckCircle2, AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import { Sparkles, Dice5 } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { RollInbox } from './RollInbox';
import { RuneLiteOnboarding } from './RuneLiteOnboarding';
import { WikiIcon } from './WikiIcon';
import { SKILLS_LIST } from '../data/items';
import { lazyWithRetry } from '../utils/lazyRetry';
import { useIsOsrsUi } from '../utils/uiStyle';
import { planSkillSync, skillBaseline, type SyncSkillPlan } from '../utils/syncBaseline';
import { baselineFromReading, readHiscoreOverall, readHiscoreSkill, type HiscoreReading } from '../utils/hiscoreReading';
import { baselineScores, planActivitySync, readScores, type ActivitySyncItem, type ScoreReading } from '../utils/syncActivity';
import { usesActivityKeyReserves } from '../config/gameModes';
import { failureFateForSource } from '../config/economy';
import { BOSSES_LIST } from '../constants';
import { BRUTUS_BOSS_NAME } from '../config/vanillaKeyEconomy';
import { farmPlaceReachable } from '../utils/activityAccess';
import { ACTIVITY_CHUNKS } from '../data/activityChunks';
import type { DropSource } from '../types';
import {
  GROUP_IRON_TITLES,
  GROUP_TITLES,
  accountTitle,
  readGroupIronTitle,
  saveGroupIronTitle,
  type AccountTitle,
  type GroupIronTitle,
} from '../utils/accountTitle';

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
 * It syncs skill levels, boss kills and clue caskets (utils/syncActivity.ts).
 */

const WOM_BASE = 'https://api.wiseoldman.net/v2/players/';

/** Letters, numbers, spaces, hyphens and underscores, 1 to 12 long, as in game. */
const OSRS_NAME = /^[A-Za-z0-9 _-]{1,12}$/;

// App skill names in display order. WOM uses lowercase metric keys; the only
// non-trivial remaps are runecrafting→Runecraft and the already-capitalised rest.
const SKILLS = SKILLS_LIST;

const womMetric = (skill: string) =>
  skill === 'Runecraft' ? 'runecrafting' : skill.toLowerCase();

interface FetchedSkill { skill: string; level: number }

// Each title's pill, in the colours of its in-game badge.
const TITLE_TONE: Record<AccountTitle['tone'], string> = {
  ultimate: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
  hardcore: 'bg-red-500/15 border-red-500/40 text-red-300',
  ironman: 'bg-gray-400/15 border-gray-400/40 text-gray-300',
  group: 'bg-blue-500/15 border-blue-400/40 text-blue-300',
  unranked: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  regular: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
};

interface Fetched {
  displayName: string;
  accountType: string;
  totalLevel: number;
  combatLevel: number | null;
  skills: FetchedSkill[];
  /** Each skill as ranked, unranked or missing, for the Sync & Roll baseline (utils/syncBaseline.ts). */
  reading: HiscoreReading;
  /** Boss kills and clue caskets per Wise Old Man metric (utils/syncActivity.ts). */
  scores: Record<string, ScoreReading>;
  updatedAt: string | null;
}

export async function fetchPlayer(name: string): Promise<Fetched> {
  const url = WOM_BASE + encodeURIComponent(name.trim());
  // POST refreshes an existing account as well as tracking a new one. Never
  // silently present a cached GET as a successful Refresh.
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate-limited by the API — wait a moment and retry.');
    if (res.status === 404 || data?.code === 'HISCORES_USERNAME_NOT_FOUND') throw new Error(`"${name}" isn't on the OSRS hiscores — check the spelling.`);
    throw new Error(`Could not refresh Wise Old Man hiscores (${res.status}).`);
  }

  const snap = data?.latestSnapshot?.data?.skills;
  if (!snap) throw new Error(`No hiscores snapshot available for "${name}" yet — try again in a moment.`);

  const reading: HiscoreReading = {
    skills: Object.fromEntries(SKILLS.map(s => [s, readHiscoreSkill(snap[womMetric(s)])])),
    overall: readHiscoreOverall(snap.overall),
  };
  // Shown levels: an unranked or missing skill shows its minimum, and never rolls.
  const skills: FetchedSkill[] = SKILLS.map(s => {
    const level = reading.skills[s];
    return { skill: s, level: typeof level === 'number' ? level : 1 };
  });
  return {
    reading,
    scores: readScores(data.latestSnapshot.data),
    displayName: data.displayName ?? name,
    accountType: typeof data.type === 'string' ? data.type : 'unknown',
    totalLevel: snap.overall?.level ?? skills.reduce((a, s) => a + s.level, 0),
    combatLevel: typeof data.combatLevel === 'number' ? data.combatLevel : null,
    skills,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Everything Sync & Roll shows and does, shared by the classic panel and the
 * OSRS layout so both bind, fetch and roll through the same handlers.
 */
export function useAutoRoll() {
  const {
    unlocks, createBackup, levelUpSkill, keys, specialKeys, chaosKeys, linkedAccount, setLinkedAccount, renameLinkedAccount,
    syncBaseline, recordSyncBaseline, catchUpSyncLevel,
    syncScores, recordSyncScores, rollForKey, history, gameModeId,
  } = useGame() as any;
  // Each run is linked to one OSRS character: the first fetch sets it, and the
  // player can change it (a name change, a typo) with Change name.
  const [name, setName] = useState(linkedAccount ?? '');
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renamedTo, setRenamedTo] = useState<string | null>(null);
  const refetchAfterRename = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'loaded'>('idle');
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState<Fetched | null>(null);
  // Wise Old Man calls a group iron a regular account, so a group iron picks their title.
  const [groupTitle, setGroupTitle] = useState<GroupIronTitle | null>(null);
  useEffect(() => { setGroupTitle(fetched ? readGroupIronTitle(fetched.displayName) : null); }, [fetched]);
  const chooseGroupTitle = useCallback((title: GroupIronTitle | null) => {
    if (!fetched) return;
    saveGroupIronTitle(fetched.displayName, title);
    setGroupTitle(title);
  }, [fetched]);
  const title = fetched ? accountTitle(fetched.accountType, groupTitle) : null;
  const [rolledTo, setRolledTo] = useState(0); // how many skills the roll animation has revealed
  const [applied, setApplied] = useState(false);
  const [skillRolling, setSkillRolling] = useState(false);
  const skillRollingRef = useRef(false);
  const [skillKeysGained, setSkillKeysGained] = useState<{ keys: number; special: number; chaos: number } | null>(null);
  // Set when this fetch took the run's baseline (a first link or a name change), for the one-time note.
  const [baselineTaken, setBaselineTaken] = useState(false);
  const setSkillRollingState = useCallback((value: boolean) => {
    skillRollingRef.current = value;
    setSkillRolling(value);
  }, []);

  const currentLevels: Record<string, number> = unlocks?.levels ?? {};
  const unlockedSkills: Record<string, number> = unlocks?.skills ?? {};
  // A skill can only be levelled once it's been unlocked in the run.
  const isUnlocked = useCallback((skill: string) => (unlockedSkills[skill] ?? 0) > 0, [unlockedSkills]);
  // Fresh refs for the level-up loop: levelUpSkill closes over state, so we read
  // it fresh each tick (between ticks the component re-renders) to keep the
  // per-level key rate ramping correctly. Counts let us tally what was earned.
  const levelUpRef = useRef(levelUpSkill);
  levelUpRef.current = levelUpSkill;
  const rollForKeyRef = useRef(rollForKey);
  rollForKeyRef.current = rollForKey;
  const catchUpRef = useRef(catchUpSyncLevel);
  catchUpRef.current = catchUpSyncLevel;
  const countsRef = useRef({ keys, specialKeys, chaosKeys });
  countsRef.current = { keys, specialKeys, chaosKeys };
  const skillTimer = useRef<number | null>(null);
  // Leaving the tab unmounts the panel. A sync must stop with it: the queue was
  // built from the levels at its start, so a sync started after remounting
  // would otherwise run alongside it and level skills past the real account.
  // Re-syncing resumes from the current levels.
  useEffect(() => () => {
    if (skillTimer.current) window.clearInterval(skillTimer.current);
  }, []);

  // What each skill rolls (utils/syncBaseline.ts planSkillSync): only levels
  // above both the run's and the baseline's (the levels the account had when
  // linked). Locked skills never roll.
  const plans = useMemo<Record<string, SyncSkillPlan>>(() => {
    if (!fetched) return {};
    return Object.fromEntries(fetched.skills.map(s => [s.skill, planSkillSync({
      tracker: currentLevels[s.skill] ?? 1,
      tier: unlockedSkills[s.skill] ?? 0,
      hiscore: fetched.reading.skills[s.skill] ?? null,
      baseline: skillBaseline(syncBaseline, linkedAccount ?? undefined, s.skill),
    })]));
  }, [fetched, currentLevels, unlockedSkills, syncBaseline, linkedAccount]);
  const gains = useMemo(() => {
    if (!fetched) return [];
    return fetched.skills
      .filter(s => (plans[s.skill]?.count ?? 0) > 0)
      .map(s => {
        const plan = plans[s.skill];
        return { skill: s.skill, level: plan.to, current: plan.current, from: plan.from, catchUpTo: plan.catchUpTo, count: plan.count };
      });
  }, [fetched, plans]);
  // Boss kills and clue caskets since the score baseline, less what the run
  // has already rolled for them (utils/syncActivity.ts planActivitySync).
  const activity = useMemo<ActivitySyncItem[]>(() => {
    if (!fetched) return [];
    const reserves = usesActivityKeyReserves(gameModeId);
    // Farm Keys' boss list in Vanilla and Chunked: unlocked bosses, and Brutus where his arena is reachable.
    const bosses = reserves ? [
      ...(farmPlaceReachable(ACTIVITY_CHUNKS[BRUTUS_BOSS_NAME], unlocks, gameModeId) ? [BRUTUS_BOSS_NAME] : []),
      ...(unlocks?.bosses ?? []).filter((boss: string) => BOSSES_LIST.includes(boss)),
    ] : [];
    return planActivitySync({ scores: syncScores, linkedAccount: linkedAccount ?? undefined, reading: fetched.scores, history: history ?? [], gameModeId, reserves, bosses });
  }, [fetched, syncScores, linkedAccount, history, gameModeId, unlocks]);
  const activityRolls = activity.reduce((sum, a) => sum + a.count, 0);
  const holds = useMemo(() => {
    const out = { linked: 0, locked: 0 };
    for (const plan of Object.values(plans)) if (plan.hold === 'linked' || plan.hold === 'locked') out[plan.hold]++;
    return out;
  }, [plans]);

  const onFetch = useCallback(async () => {
    // Once bound, only that account can be fetched for this run.
    const query = (linkedAccount ?? name).trim();
    if (!query) return;
    setStatus('loading'); setError(''); setFetched(null); setRolledTo(0); setApplied(false);
    setSkillRollingState(false); setSkillKeysGained(null); setBaselineTaken(false);
    if (skillTimer.current) window.clearInterval(skillTimer.current);
    try {
      const data = await fetchPlayer(query);
      // Bind the run to this account on the first successful fetch. This
      // reading becomes its baseline: levels it already has never roll.
      // A failed fetch binds nothing and takes no baseline.
      const account = linkedAccount ?? data.displayName;
      const pending = !linkedAccount || (!!syncBaseline && !syncBaseline.levels);
      if (!linkedAccount) { setLinkedAccount?.(data.displayName); setName(data.displayName); }
      recordSyncBaseline?.(account, baselineFromReading(data.reading));
      // Kills and caskets this account already has never roll either.
      recordSyncScores?.(account, baselineScores(data.scores));
      setBaselineTaken(pending);
      setFetched(data);
      setStatus('loaded');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reach the hiscores API.');
      setStatus('error');
    }
  }, [name, linkedAccount, setLinkedAccount, recordSyncBaseline, recordSyncScores, syncBaseline, setSkillRollingState]);

  // If the run is already bound, pull that account's hiscores on open.
  useEffect(() => { if (linkedAccount) onFetch(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const onRename = useCallback(() => {
    if (!linkedAccount) return;
    const from = linkedAccount;
    const to = newName.trim().replace(/\s+/g, ' ');
    if (!OSRS_NAME.test(to)) {
      setRenameError('Type the name as it shows in game: up to 12 letters, numbers, spaces, hyphens or underscores.');
      return;
    }
    setRenameError('');
    setNewName('');
    setRenameOpen(false);
    if (to === from) return;
    // Keep the group title this browser remembers for the character.
    const title = readGroupIronTitle(from);
    if (title) saveGroupIronTitle(to, title);
    refetchAfterRename.current = true;
    renameLinkedAccount?.(from, to);
    setName(to);
    setRenamedTo(to);
  }, [linkedAccount, newName, renameLinkedAccount]);

  // Pull the new name's hiscores once the run has moved to it.
  useEffect(() => {
    if (!refetchAfterRename.current || !linkedAccount) return;
    refetchAfterRename.current = false;
    onFetch();
  }, [linkedAccount, onFetch]);

  const openRename = useCallback(() => { setRenameOpen(true); setRenameError(''); setRenamedTo(null); }, []);
  const cancelRename = useCallback(() => { setRenameOpen(false); setRenameError(''); setNewName(''); }, []);

  // "Auto-roll": walk each unlocked skill up to its real level through the LIVE
  // level-up engine — every level fires its exact level/5 Key roll,
  // the 2% chaos-key chance and the omni chance — so the run earns exactly the
  // keys those levels would have. Runs in batches for a responsive slot-machine
  // feel; tallies the keys/omni/chaos earned at the end.
  const autoRoll = useCallback(async () => {
    if (!fetched || (gains.length === 0 && activityRolls === 0) || skillRollingRef.current) return;
    // Lock before awaiting the protective backup. Otherwise the button stays
    // live during the async gap and a double click can start overlapping rolls.
    setSkillRollingState(true);
    try {
      await createBackup?.('Before Auto-Roll skill sync');
    } catch {
      setSkillRollingState(false);
      return;
    }
    const before = { ...countsRef.current };

    // One queue entry per level still to gain, plus per-skill reveal
    // boundaries. A skill behind its baseline first records the baseline,
    // without a roll, so only the levels above it roll.
    const queue: Array<{ skill: string; catchUpTo?: number } | { kill: ActivitySyncItem }> = [];
    const bounds: number[] = [];
    for (const g of gains) {
      if (g.catchUpTo) queue.push({ skill: g.skill, catchUpTo: g.catchUpTo });
      for (let n = 0; n < g.count; n++) queue.push({ skill: g.skill });
      bounds.push(queue.length);
    }
    // Then each new kill and casket, one Farm Keys roll apiece. A boss whose
    // stash runs dry part way rolls nothing more (rollForKey skips it).
    for (const a of activity) for (let n = 0; n < a.count; n++) queue.push({ kill: a });
    const total = queue.length;
    if (total === 0) {
      setSkillRollingState(false);
      return;
    }

    setRolledTo(0); setApplied(false); setSkillKeysGained(null);
    const BATCH = Math.min(25, Math.max(1, Math.ceil(total / 50)));
    let i = 0;
    // A skill whose baseline the run refused to record (the run changed since
    // the plan, as after a name change) rolls nothing more this sync.
    const refused = new Set<string>();
    if (skillTimer.current) window.clearInterval(skillTimer.current);
    skillTimer.current = window.setInterval(() => {
      const levelUp = levelUpRef.current;
      for (let b = 0; b < BATCH && i < total; b++, i++) {
        const step = queue[i];
        if ('kill' in step) {
          const { source, rate, context } = step.kill;
          rollForKeyRef.current?.(source, rate, failureFateForSource(source as DropSource), undefined, undefined, undefined, context);
          continue;
        }
        if (refused.has(step.skill)) continue;
        if (step.catchUpTo) {
          if (catchUpRef.current?.(step.skill, step.catchUpTo) !== true) refused.add(step.skill);
        } else levelUp(step.skill);
      }
      let revealed = 0;
      for (const bnd of bounds) if (bnd <= i) revealed++;
      setRolledTo(revealed);
      if (i >= total) {
        if (skillTimer.current) window.clearInterval(skillTimer.current);
        setSkillRollingState(false);
        window.setTimeout(() => {
          const a = countsRef.current;
          setSkillKeysGained({ keys: a.keys - before.keys, special: a.specialKeys - before.specialKeys, chaos: a.chaosKeys - before.chaosKeys });
          setApplied(true);
        }, 250);
      }
    }, 70);
  }, [fetched, gains, activity, activityRolls, createBackup, setSkillRollingState]);

  const totalGain = gains.reduce((a, s) => a + s.count, 0);

  return {
    linkedAccount: linkedAccount as string | null | undefined, name, setName, status, error, fetched, groupTitle, chooseGroupTitle, title,
    rolledTo, applied, skillRolling, skillKeysGained, currentLevels, isUnlocked, gains, onFetch, autoRoll, totalGain,
    plans, holds, baselineTaken, activity, activityRolls,
    renameOpen, newName, setNewName, renameError, renamedTo, onRename, openRename, cancelRename,
  };
}

/** One kill or casket row: "Vorkath: 12 new kills, 3 already rolled, 9 to roll". */
export function activityRowText(a: ActivitySyncItem): string {
  const noun = a.kind === 'clue' ? 'casket' : 'kill';
  const parts = [`${a.gained} new ${noun}${a.gained === 1 ? '' : 's'}`];
  if (a.rolled > 0) parts.push(`${Math.min(a.rolled, a.gained)} already rolled`);
  if (a.hold === 'locked') parts.push("not unlocked in this run, so they don't roll");
  else parts.push(a.count > 0 ? `${a.count} to roll` : 'nothing left to roll');
  return parts.join(', ');
}

/** What the roll button says: "Auto-roll 3 skills (+12), 9 kills and 2 caskets". */
export function syncButtonText(skills: number, levels: number, activity: readonly ActivitySyncItem[]): string {
  const count = (kind: ActivitySyncItem['kind']) => activity.reduce((sum, a) => sum + (a.kind === kind ? a.count : 0), 0);
  const kills = count('boss');
  const caskets = count('clue');
  const parts: string[] = [];
  if (skills > 0) parts.push(`${skills} skill${skills === 1 ? '' : 's'} (+${levels})`);
  if (kills > 0) parts.push(`${kills} kill${kills === 1 ? '' : 's'}`);
  if (caskets > 0) parts.push(`${caskets} casket${caskets === 1 ? '' : 's'}`);
  const last = parts.pop();
  return `Auto-roll ${parts.length ? `${parts.join(', ')} and ${last}` : last}`;
}

/** Why a skill's hiscores level doesn't (all) roll, for its tile's tooltip. */
export function syncHoldText(skill: string, plan: SyncSkillPlan | undefined): string | undefined {
  if (!plan) return undefined;
  if (plan.hold === 'locked') return `${skill} isn't unlocked yet. Unlock it in the run before it can be rolled.`;
  if (plan.hold === 'linked') return `${skill}: your account already had this level when the run was linked, so it doesn't roll. New levels do.`;
  if (plan.hold === 'unranked') return `${skill} isn't on the hiscores yet, so there's nothing to sync.`;
  return undefined;
}

/** What the panel says when nothing rolls now. */
export function syncIdleText(holds: { linked: number; locked: number }): string {
  if (holds.linked > 0) return "Nothing new to roll. Levels your account had when this run was linked don't roll; only new ones do.";
  if (holds.locked > 0) return 'No unlocked skills to roll. Unlock more skills in the run first.';
  return 'Your unlocked skills already match or exceed this account.';
}

/** The one-time note after a run takes its baseline (its first link, or a name change). */
export const BASELINE_NOTE = "Linked. Levels this account already has don't roll; only the levels you gain from now on do.";

const OsrsSyncRoll = lazyWithRetry(() => import('./osrs/OsrsSyncRoll'));

export function AutoRollPanel() {
  return useIsOsrsUi()
    ? <Suspense fallback={null}><OsrsSyncRoll /></Suspense>
    : <ClassicAutoRollPanel />;
}

function ClassicAutoRollPanel() {
  const {
    linkedAccount, name, setName, status, error, fetched, groupTitle, chooseGroupTitle, title,
    rolledTo, applied, skillRolling, skillKeysGained, currentLevels, isUnlocked, gains, onFetch, autoRoll, totalGain,
    plans, holds, baselineTaken, activity, activityRolls,
    renameOpen, newName, setNewName, renameError, renamedTo, onRename, openRename, cancelRename,
  } = useAutoRoll();

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Dice5 size={20} className="text-fuchsia-400" /> Sync &amp; Roll
            <span className="text-[10px] uppercase tracking-wide bg-fuchsia-500/20 text-fuchsia-300 px-1.5 py-0.5 rounded">Prototype</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Pull your account from the OSRS hiscores and roll every level you've gained since you linked it, as if you logged each one.
            Powered by the <span className="text-gray-400">Wise Old Man</span> API. Syncs skill levels, boss kills and clue caskets.
          </p>
        </div>
      </div>

      <RollInbox />

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
            title={linkedAccount ? 'This run is linked to this account' : undefined}
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
        <div className="-mt-2 space-y-2 max-w-xl">
          <p className="text-[10px] text-gray-500 flex items-center gap-1 flex-wrap">
            <Lock size={9} /> This run is linked to <span className="text-gray-300">{linkedAccount}</span>
            {!renameOpen && (
              <button
                type="button"
                onClick={openRename}
                className="text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-2"
              >
                Change name
              </button>
            )}
          </p>
          {renameOpen && (
            <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 space-y-2" data-testid="character-rename">
              <p className="text-xs text-gray-400">
                Changed your OSRS name? Type the new one as it shows in game. RuneLite records your run on this
                character, and Sync &amp; Roll pulls its hiscores. Roll any new levels first: the new name's levels count as already had.
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onRename()}
                  placeholder="New name…"
                  aria-label="New OSRS name"
                  maxLength={12}
                  className="flex-1 min-w-0 bg-black/40 border border-white/15 focus:border-fuchsia-500/60 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onRename}
                  disabled={!newName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shrink-0"
                >
                  Save name
                </button>
                <button
                  type="button"
                  onClick={cancelRename}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 shrink-0"
                >
                  Cancel
                </button>
              </div>
              {renameError && <p role="alert" className="text-xs text-red-300">{renameError}</p>}
            </div>
          )}
          {renamedTo && !renameOpen && (
            <p role="status" className="text-xs text-emerald-300 flex items-start gap-1.5">
              <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
              <span>
                This run now uses {renamedTo}. A paired RuneLite gets the new name within a minute or two;
                if it still shows the old one, log out and back in.
              </span>
            </p>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 max-w-xl">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            {error}
            {linkedAccount && !renameOpen && ' If you changed your OSRS name, use "Change name" above.'}
          </span>
        </div>
      )}

      {/* Result */}
      {fetched && (
        <div className="space-y-4">
          {baselineTaken && (
            <p role="status" data-testid="sync-baseline-note" className="text-xs text-sky-200 bg-sky-950/40 border border-sky-800/60 rounded-lg px-3 py-2 max-w-xl flex items-start gap-1.5">
              <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
              <span>{BASELINE_NOTE}</span>
            </p>
          )}
          <div className="flex items-center gap-4 flex-wrap bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                {fetched.displayName}
                {title && (
                  <span
                    data-account-title={title.label}
                    className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${TITLE_TONE[title.tone]}`}
                  >
                    {title.badge && <WikiIcon file={title.badge} alt="" size={11} />}
                    {title.label}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500">
                Total level <span className="text-gray-300 font-mono">{fetched.totalLevel}</span>
                {fetched.combatLevel != null && <> · Combat <span className="text-gray-300 font-mono">{fetched.combatLevel}</span></>}
              </div>
              {fetched.accountType === 'regular' && !groupTitle && (
                <div className="mt-1 space-y-1">
                  <div className="text-[10px] text-amber-400/90 flex items-center gap-1">
                    <AlertTriangle size={10} className="shrink-0" />
                    Not on the ironman hiscores. Wise Old Man lists group irons as regular accounts, so pick yours if you're one:
                  </div>
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Group ironman title">
                    {GROUP_IRON_TITLES.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => chooseGroupTitle(choice)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
                      >
                        <WikiIcon file={GROUP_TITLES[choice].badge!} alt="" size={11} />
                        {GROUP_TITLES[choice].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {fetched.accountType === 'regular' && groupTitle && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Your group title: Wise Old Man can't tell group irons apart.{' '}
                  <button type="button" onClick={() => chooseGroupTitle(null)} className="text-gray-400 underline hover:text-gray-200">
                    Change
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1" />
            {!applied && !skillRolling && (gains.length > 0 || activityRolls > 0) && (
              <button
                onClick={autoRoll}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-emerald-600 hover:from-fuchsia-500 hover:to-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg"
              >
                <Sparkles size={16} /> {syncButtonText(gains.length, totalGain, activity)}
              </button>
            )}
            {skillRolling && (
              <div className="flex items-center gap-2 text-fuchsia-300 text-sm font-semibold">
                <Loader2 size={16} className="animate-spin" /> Rolling…
              </div>
            )}
            {applied && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold flex-wrap">
                <CheckCircle2 size={18} /> Synced
                {skillKeysGained && (skillKeysGained.keys + skillKeysGained.special + skillKeysGained.chaos) > 0 && (
                  <span className="font-normal text-gray-300">
                    · earned <span className="text-amber-300 font-semibold">{skillKeysGained.keys} Key{skillKeysGained.keys === 1 ? '' : 's'}</span>
                    {skillKeysGained.special > 0 && <>, <span className="text-purple-300 font-semibold">{skillKeysGained.special} Omni-Key{skillKeysGained.special === 1 ? '' : 's'}</span></>}
                    {skillKeysGained.chaos > 0 && <>, <span className="text-red-400 font-semibold">{skillKeysGained.chaos} Chaos Key{skillKeysGained.chaos === 1 ? '' : 's'}</span></>}
                  </span>
                )}
              </div>
            )}
            {!applied && !skillRolling && gains.length === 0 && activityRolls === 0 && (
              <div className="text-sm text-gray-400 max-w-xs">{syncIdleText(holds)}</div>
            )}
          </div>

          {/* Skill grid: current → real, gains highlighted; reveal during roll. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {fetched.skills.map((s) => {
              const current = currentLevels[s.skill] ?? 1;
              const unlocked = isUnlocked(s.skill);
              const gainIdx = gains.findIndex(g => g.skill === s.skill);
              const isGain = gainIdx > -1;
              const revealed = !isGain || applied || gainIdx < rolledTo;
              const held = plans[s.skill]?.hold === 'linked';
              const shown = isGain ? gains[gainIdx].level : s.level;
              return (
                <div
                  key={s.skill}
                  title={syncHoldText(s.skill, plans[s.skill])}
                  data-sync-hold={plans[s.skill]?.hold ?? undefined}
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
                        <span className={isGain ? (revealed ? 'text-emerald-300 font-bold' : 'text-gray-600') : held ? 'text-gray-500' : 'text-gray-400'}>
                          {revealed ? shown : '··'}
                        </span>
                        {held && !isGain && <Lock size={9} className="text-gray-600 shrink-0" aria-label="Had when linked" />}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {activity.length > 0 && (
            <div className="space-y-1" data-testid="sync-activity">
              <h3 className="text-xs font-bold text-gray-300">Boss kills and clue caskets since you linked</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {activity.map((a) => (
                  <li key={a.label} className={`px-2.5 py-1.5 rounded border text-xs ${a.count > 0 && !applied ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-white/10 bg-white/5'}`}>
                    <span className="text-gray-200 font-semibold">{a.label}</span>
                    <span className="text-gray-500"> · {activityRowText(a)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-gray-600">
            Hiscores data via Wise Old Man · each synced level runs through the live RNG engine, so it awards keys, Omni and
            Chaos exactly as levelling it would — all logged to History · new boss kills and clue caskets roll as Farm Keys clicks would, less any you've already rolled · levels, kills and caskets the account had when linked don't roll · a backup is created first.
          </p>
        </div>
      )}

      {status === 'idle' && !linkedAccount && (
        <div className="text-xs text-gray-600 max-w-xl border border-dashed border-white/10 rounded-lg px-4 py-6 text-center">
          Enter your OSRS username to bind this run to your account. Levels it already has don't roll; only the ones you gain from now on.
        </div>
      )}

      <RuneLiteOnboarding />
    </div>
  );
}

export default AutoRollPanel;
