import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { openOsrsProgressionTab, openOsrsScreen, useOsrsNav } from '../../utils/osrsNav';
import { QUEST_DATA, type QuestData } from '../../data/questData';
import { DIARY_DATA } from '../../data/diaryData';
import { ALL_DIARY_TASKS, type DiaryTask } from '../../data/diaryTasks';
import { CA_DATA } from '../../data/caData';
import { ALL_CA_TASKS, type CATask } from '../../data/caTasks';
import { DROP_RATES } from '../../config/rules';
import { caTaskLockedBoss } from '../../utils/caProgress';
import { evaluateDiaryTaskEligibility, type EligibilityBlocker } from '../../utils/journalStatus';
import { isAlmostThere } from '../../utils/journalProgress';
import { computeUnlockImpact } from '../../utils/unlockImpact';
import { showChunkOnMap } from '../../utils/chunkLocations';
import { questLocations } from '../../utils/questLocations';
import { useQuestJournal, type QuestCardQuest } from '../QuestLog';
import { useDiaryJournal } from '../DiaryLog';
import { useCAJournal } from '../CALog';
import { useJournalSummaryModel, doableDiaryTasks, doableCATasks, caPointsLabel } from '../JournalSummaryCard';
import { useQuestDoabilityRows, QUEST_DOABILITY_BUCKET_LABEL } from '../QuestDoabilityPanel';
import { planJournalAction } from '../JournalNextBest';
import { JournalFilterBar } from '../JournalFilterBar';
import { QuestInsights, DiaryInsights, CAInsights } from '../JournalInsights';
import { QuestAdvisorPanel } from '../QuestAdvisorPanel';
import { SkillTrainingPopover } from '../SkillTrainingPopover';
import { JournalIcon, type JournalKind, osrsAsset } from './OsrsJournalParts';
import { useOsrsJournalNav, setOsrsJournalTab, type OsrsJournalTab } from './OsrsJournalNav';
import {
  QuestDetail, DiaryTaskDetail, DiaryTierDetail, CATaskDetail, CATierDetail,
  questMapTarget, taskMapTarget, tierMapTarget, caTaskMapTarget, tasksOfTier,
  type JournalSel, type MapTarget, selKey,
} from './OsrsJournalDetail';
import {
  compileJournalQuery, matchJournalFields, hitRanges, splitHighlight, questSearchFields, diaryTaskSearchFields, caTaskSearchFields,
  type Range,
} from './OsrsJournalSearch';
import './osrs-dashboard.css';
import './osrs-journal.css';

/**
 * The full Journal window of the OSRS layout (screen 'journal'; board:
 * Journal.dc.html). A summary bar, then the Journal window: tabs Ready now,
 * Almost there, Quest list, Diaries and Combat; the list on the left with
 * section headings and each entry's Key chance; the selected entry's journal
 * scroll, Details and buttons on the right; a footer line. Right-clicking an
 * entry opens a Choose Option menu.
 *
 * It holds no rules of its own: the lists, filters and handlers come from
 * the hooks the classic Quest, Diary and Combat Achievement logs use
 * (useQuestJournal, useDiaryJournal, useCAJournal), the counts from the
 * home Journal card's model, and the route check from the Doable panel.
 */

const TABS: Array<[OsrsJournalTab, string]> = [
  ['ready', 'Ready now'], ['almost', 'Almost there'], ['quests', 'Quest list'], ['diaries', 'Diaries'], ['combat', 'Combat'],
];

const YELLOW = '#ffff00';
const ORANGE = '#ff981f';
const RED_KEY = '#ff3030';
const TONE = { done: '#0dc10d', ready: '#ffff00', locked: '#ff0000' };

/** Highlighted text: the search's matched characters in yellow. */
interface Hit { text: string; hits: Range[] }

type Item =
  | { t: 'head'; key: string; title: string; icon?: JournalKind; count: string; found?: boolean }
  | {
      t: 'row'; key: string; title: string; sel: JournalSel; name: string;
      keyText?: string; keyColor?: string; color: string; pad: number; bold?: boolean; strike?: boolean; tip?: string;
      /** Search hits in the title and the key text; `via` names the field that matched when the title did not. */
      hits?: Range[]; keyHits?: Range[]; via?: Hit;
    }
  | { t: 'empty'; key: string; text: string };

const SEARCH_KEY = 'fl.osrsJournal.search';
const readSearch = (): string => { try { return sessionStorage.getItem(SEARCH_KEY) ?? ''; } catch { return ''; } };
const writeSearch = (v: string) => { try { if (v) sessionStorage.setItem(SEARCH_KEY, v); else sessionStorage.removeItem(SEARCH_KEY); } catch { /* private window */ } };
const isTypingTarget = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

/** The first field after the title that matched, when the title itself did not: why a row is in the results. */
const viaOf = (m: Range[][], texts: string[], skip: number[] = []): Hit | undefined => {
  if (m[0]?.length) return undefined;
  for (let i = 1; i < m.length; i++) if (!skip.includes(i) && m[i].length && texts[i]) return { text: texts[i], hits: m[i] };
  return undefined;
};

const rowDomId = (key: string) => 'ojs-r-' + key.replace(/[^\w-]/g, '_');

const Hl: React.FC<{ text: string; hits?: Range[] }> = ({ text, hits }) => (
  <>{splitHighlight(text, hits).map((s, i) => (s.hit ? <mark key={i} className="ojs-hit">{s.text}</mark> : <React.Fragment key={i}>{s.text}</React.Fragment>))}</>
);

/** "Needs Crafting", "Needs a quest": the one thing an almost-ready entry lacks, in a few words. */
export const needsShort = (b: EligibilityBlocker | { kind: 'manual'; label: string }): string => {
  switch (b.kind) {
    case 'skill': return b.requirement?.type === 'single' ? `Needs ${b.requirement.skill}` : 'Needs a level';
    case 'combat': return 'Needs combat level';
    case 'quest': return b.label.startsWith('Quest Points') ? 'Needs Quest Points' : 'Needs a quest';
    case 'region': return 'Needs an area';
    case 'equipment': return 'Needs gear';
    case 'merchant': return 'Needs a shop';
    case 'mobility': return 'Needs travel';
    case 'arcana': return 'Needs a spellbook';
    case 'minigame': return 'Needs a minigame';
    case 'boss': return 'Needs a boss';
    case 'guild': return 'Needs a guild';
    case 'farming': return 'Needs a patch';
    case 'housing': return 'Needs a room';
    case 'slayer': return 'Needs a Slayer unlock';
    case 'alternative': return b.travel ? 'Needs a route' : 'Needs one of';
    default: return 'Needs a check';
  }
};

const pct = (n: number | undefined) => (n === undefined ? '' : `${n}%`);
const byChanceThenName = <T,>(rate: (x: T) => number, name: (x: T) => string) =>
  (a: T, b: T) => rate(b) - rate(a) || name(a).localeCompare(name(b));

export const OsrsJournalScreen: React.FC = () => {
  const { keys } = useGame();
  const { tab } = useOsrsJournalNav();
  const { progressionTabs } = useOsrsNav();
  const quest = useQuestJournal();
  const diary = useDiaryJournal();
  const ca = useCAJournal();
  const { stats } = useJournalSummaryModel();
  const doability = useQuestDoabilityRows();
  const { unlocks, gameModeId } = quest;
  const areaRoutes = diary.areaRoutes;

  const [sel, setSelState] = useState<Partial<Record<OsrsJournalTab, JournalSel>>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState<{ sel: JournalSel; name: string; top: number; left: number } | null>(null);
  const [menuNote, setMenuNote] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // One search for every tab: it stays when the tab changes, and for the rest of the visit.
  const [term, setTermState] = useState(readSearch);
  const setTerm = useCallback((v: string) => { setTermState(v); writeSearch(v); }, []);
  const query = useMemo(() => compileJournalQuery(term), [term]);
  const searching = query !== null;
  const [cursor, setCursor] = useState(-1);

  const select = useCallback((t: OsrsJournalTab, s: JournalSel) => setSelState(cur => ({ ...cur, [t]: s })), []);

  /* ── Lists ─────────────────────────────────────────────────────────────── */

  const questRate = (q: QuestData) => DROP_RATES[q.difficulty] ?? 0;
  const taskRate = (t: DiaryTask) => DROP_RATES[DIARY_DATA[t.tierId]?.difficulty] ?? 0;
  const caRate = (t: CATask) => DROP_RATES[CA_DATA[t.tierId]?.difficulty] ?? 0;

  const readyQuests = useMemo(() => quest.allQuests
    .filter(q => q.status !== 'COMPLETED' && q.eligibility.eligible)
    .sort(byChanceThenName(questRate, q => q.name)), [quest.allQuests]);
  const readyTasks = useMemo(() => doableDiaryTasks(ALL_DIARY_TASKS, unlocks, gameModeId, areaRoutes)
    .sort(byChanceThenName(taskRate, t => t.description)), [unlocks, gameModeId, areaRoutes]);
  const readyCA = useMemo(() => doableCATasks(ALL_CA_TASKS, unlocks, gameModeId, areaRoutes)
    .sort(byChanceThenName(caRate, t => t.name ?? t.description)), [unlocks, gameModeId, areaRoutes]);

  // Almost there: blocked by exactly one requirement (the classic "Almost" badge).
  const almostQuests = useMemo(() => quest.allQuests.flatMap(q => {
    if (q.status === 'COMPLETED' || q.eligibility.eligible) return [];
    const unmet = [...q.eligibility.blockers, ...q.eligibility.manualChecks.map(label => ({ kind: 'manual' as const, label }))];
    return isAlmostThere(unmet) ? [{ q, unmet: unmet[0] }] : [];
  }).sort((a, b) => questRate(a.q) - questRate(b.q) || a.q.name.localeCompare(b.q.name)), [quest.allQuests]);
  const almostTasks = useMemo(() => ALL_DIARY_TASKS.flatMap(task => {
    if (unlocks.diaries.includes(task.tierId) || unlocks.completedTasks.includes(task.id)) return [];
    const e = evaluateDiaryTaskEligibility(task, unlocks, gameModeId, areaRoutes);
    if (e.eligible) return [];
    const unmet = [...e.blockers, ...e.manualChecks.map(label => ({ kind: 'manual' as const, label }))];
    return isAlmostThere(unmet) ? [{ task, unmet: unmet[0] }] : [];
  }).sort((a, b) => taskRate(a.task) - taskRate(b.task) || a.task.description.localeCompare(b.task.description)), [unlocks, gameModeId, areaRoutes]);

  const caTasksOf = useMemo(() => {
    const map = new Map<string, CATask[]>();
    for (const t of ALL_CA_TASKS) { if (!map.has(t.tierId)) map.set(t.tierId, []); map.get(t.tierId)!.push(t); }
    return map;
  }, []);

  const questTone = (q: QuestCardQuest) => q.status === 'COMPLETED' ? TONE.done : q.eligibility.eligible ? TONE.ready : TONE.locked;
  // Orange: the boss is unlocked but the run can't get to it yet.
  const caTaskTone = (t: CATask) => unlocks.completedTasks.includes(t.id) ? TONE.done
    : caTaskLockedBoss(t, unlocks.bosses) ? TONE.locked
    : doableCATasks([t], unlocks, gameModeId, areaRoutes).length > 0 ? TONE.ready : ORANGE;

  // The Combat tab's open tier: the selected entry's tier, else the classic log's expanded one.
  const combatSel = sel.combat;
  const openCATier = (combatSel?.kind === 'caTier' ? combatSel.id
    : combatSel?.kind === 'caTask' ? ALL_CA_TASKS.find(t => t.id === combatSel.id)?.tierId : undefined)
    ?? ca.expandedId ?? ca.filteredCAs.find(t => !unlocks.cas.includes(t.id))?.id ?? ca.filteredCAs[0]?.id;

  // A quest's start point, searched with its name and series (only worked out while searching).
  const questStart = useMemo(() => {
    const map = new Map<string, string>();
    if (!searching) return map;
    for (const q of quest.allQuests) {
      const label = questLocations(q.name, unlocks, gameModeId).startPlaces[0]?.label ?? q.locations?.[0]?.label;
      if (label) map.set(q.id, label);
    }
    return map;
  }, [searching, quest.allQuests, unlocks, gameModeId]);

  const items: Item[] = useMemo(() => {
    const row = (sel: JournalSel, title: string, extra: Partial<Extract<Item, { t: 'row' }>> = {}): Item => ({
      t: 'row', key: selKey(sel), sel, title, name: title, color: ORANGE, pad: 34, keyColor: YELLOW, ...extra,
    });
    const empty = (key: string, text: string): Item => ({ t: 'empty', key, text });

    // Search: each entry's fields, and the hits to draw on its row.
    const questHit = (q: QuestData) => {
      const texts = questSearchFields(q, questStart.get(q.id));
      const m = matchJournalFields(query, texts);
      return m && { hits: m[0], via: viaOf(m, texts) };
    };
    const taskHit = (t: DiaryTask) => {
      const m = matchJournalFields(query, diaryTaskSearchFields(t));
      return m && { hits: m[0], via: m[0].length ? undefined : { text: t.tierId, hits: hitRanges(query, t.tierId) } };
    };
    const caHit = (t: CATask, monsterShown: boolean) => {
      const texts = caTaskSearchFields(t);
      const m = matchJournalFields(query, texts);
      return m && { hits: m[0], keyHits: monsterShown ? m[2] : undefined, via: viaOf(m, texts, monsterShown ? [2, 3] : []) };
    };
    const pick = <T, H>(list: T[], hit: (x: T) => H | null): Array<[T, H | Record<string, never>]> =>
      list.flatMap(x => { const h = searching ? hit(x) : {}; return h ? [[x, h] as [T, H | Record<string, never>]] : []; });

    // A section: its heading (with "found / total" while searching), its rows, or a line when it has none.
    const out: Item[] = [];
    const section = (head: Omit<Extract<Item, { t: 'head' }>, 't' | 'count'> & { count: string }, total: number, rows: Item[], emptyText?: string) => {
      if (searching && rows.length === 0) return;
      out.push({ t: 'head', ...head, count: searching ? `${rows.length} / ${total}` : head.count, found: searching });
      out.push(...rows);
      if (rows.length === 0 && emptyText) out.push(empty('e-' + head.key, emptyText));
    };

    if (tab === 'ready') {
      const qs = pick(readyQuests, q => questHit(q)).map(([q, h]) => row({ kind: 'quest', id: q.id }, q.name, { keyText: pct(DROP_RATES[q.difficulty]), ...h }));
      const ds = pick(readyTasks, taskHit).map(([t, h]) => row({ kind: 'task', id: t.id }, t.description, { keyText: pct(taskRate(t)), tip: t.tierId, ...h }));
      const cs = pick(readyCA, t => caHit(t, false)).map(([t, h]) => row({ kind: 'caTask', id: t.id }, t.name ?? t.description, { keyText: pct(caRate(t)), tip: `${t.tierId} · ${t.monster}`, ...h }));
      section({ key: 'h-q', title: 'Quests', icon: 'quest', count: String(readyQuests.length) }, readyQuests.length, qs, 'No quest is ready yet.');
      section({ key: 'h-d', title: 'Diary tasks', icon: 'diary', count: String(readyTasks.length) }, readyTasks.length, ds, 'No diary task is doable yet.');
      section({ key: 'h-c', title: 'Combat Achievements', icon: 'ca', count: String(readyCA.length) }, readyCA.length, cs, 'No task at a boss you can reach.');
      return out;
    }
    if (tab === 'almost') {
      const qs = pick(almostQuests, ({ q }) => questHit(q)).map(([{ q, unmet }, h]) => row({ kind: 'quest', id: q.id }, q.name, { keyText: needsShort(unmet), keyColor: RED_KEY, tip: unmet.label, ...h }));
      const ds = pick(almostTasks, ({ task }) => taskHit(task)).map(([{ task, unmet }, h]) => row({ kind: 'task', id: task.id }, task.description, { keyText: needsShort(unmet), keyColor: RED_KEY, tip: unmet.label, ...h }));
      section({ key: 'h-q', title: 'Quests', icon: 'quest', count: '1 thing missing' }, almostQuests.length, qs, 'No quest is one step away.');
      section({ key: 'h-d', title: 'Diary tasks', icon: 'diary', count: '1 thing missing' }, almostTasks.length, ds, 'No diary task is one step away.');
      return out;
    }
    if (tab === 'quests') {
      const sections = quest.groupBySeries
        ? quest.seriesGroups.map(([title, entries]) => ({ key: title, title, entries }))
        : [{ key: 'quests', title: 'Quests', entries: quest.mainQuests }, { key: 'miniquests', title: 'Miniquests', entries: quest.miniquests }];
      for (const s of sections) {
        if (s.entries.length === 0) continue;
        const rows = pick(s.entries, q => questHit(q)).map(([q, h]) => row({ kind: 'quest', id: q.id }, q.name, { color: questTone(q), pad: 10, ...h }));
        section({ key: 'h-' + s.key, title: s.title, count: `${s.entries.filter(q => q.status === 'COMPLETED').length}/${s.entries.length}` }, s.entries.length, rows);
      }
      if (out.length === 0 && !searching) out.push(empty('e', 'No quests found matching filter.'));
      return out;
    }
    if (tab === 'diaries') {
      // The area grid has nowhere to show task text, so a search lists each tier and its matching tasks.
      if (!searching) return out;
      for (const d of diary.sortedDiaries) {
        const all = tasksOfTier(d.id);
        const rows = pick(all, taskHit).map(([t, h]) => {
          const done = d.status === 'COMPLETED' || unlocks.completedTasks.includes(t.id);
          const tone = done ? TONE.done : evaluateDiaryTaskEligibility(t, unlocks, gameModeId, areaRoutes).eligible ? TONE.ready : TONE.locked;
          return row({ kind: 'task', id: t.id }, t.description, { pad: 22, color: tone, hits: h.hits });
        });
        if (rows.length === 0) continue;
        const done = d.status === 'COMPLETED' ? all.length : all.filter(t => unlocks.completedTasks.includes(t.id)).length;
        out.push(row({ kind: 'tier', id: d.id }, d.id, {
          bold: true, pad: 10, keyText: `${rows.length} / ${all.length}`, keyColor: YELLOW, hits: hitRanges(query, d.id),
          color: done === all.length && all.length > 0 ? TONE.done : done > 0 ? TONE.ready : TONE.locked,
          tip: `${rows.length} of ${all.length} tasks match; ${done} done`,
        }));
        out.push(...rows);
      }
      return out;
    }
    if (tab === 'combat') {
      for (const tier of ca.filteredCAs) {
        const all = caTasksOf.get(tier.id) ?? [];
        const shown = searching || tier.id === openCATier ? pick(all, t => caHit(t, true)) : [];
        if (searching && shown.length === 0) continue;
        const done = all.filter(t => unlocks.completedTasks.includes(t.id)).length;
        const recorded = unlocks.cas.includes(tier.id);
        out.push(row({ kind: 'caTier', id: tier.id }, `${tier.id} tier`, {
          bold: true, pad: 10,
          keyText: searching ? `${shown.length} / ${all.length}` : `${done}/${all.length}`, keyColor: searching ? YELLOW : '#c8b897',
          hits: hitRanges(query, tier.id),
          tip: searching ? `${shown.length} of ${all.length} tasks match; ${done} done` : undefined,
          color: recorded ? TONE.done : ca.totalPoints >= tier.pointsRequired ? TONE.ready : '#ffffff',
        }));
        for (const [t, h] of shown) {
          out.push(row({ kind: 'caTask', id: t.id }, t.name ?? t.description, { pad: 22, color: caTaskTone(t), keyText: t.monster, keyColor: '#c8b897', ...h }));
        }
      }
      if (out.length === 0 && !searching) out.push(empty('e', 'No tiers found matching filter.'));
      return out;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query, questStart, readyQuests, readyTasks, readyCA, almostQuests, almostTasks, quest.groupBySeries, quest.seriesGroups,
    quest.mainQuests, quest.miniquests, diary.sortedDiaries, ca.filteredCAs, ca.totalPoints, openCATier, unlocks, gameModeId, areaRoutes, caTasksOf]);

  const navRows = useMemo(() => items.filter((i): i is Extract<Item, { t: 'row' }> => i.t === 'row'), [items]);
  const noMatches = searching && navRows.length === 0;

  const firstRow = navRows[0];

  // Diaries tab: the classic log's expanded tier is the selection, so jumps land on it.
  const diaryDefault: JournalSel | undefined = diary.expandedId
    ? { kind: 'tier', id: diary.expandedId }
    : (() => {
        const firstDoable = diary.sortedDiaries.find(d => d.status !== 'COMPLETED'
          && tasksOfTier(d.id).some(t => !unlocks.completedTasks.includes(t.id) && evaluateDiaryTaskEligibility(t, unlocks, gameModeId, areaRoutes).eligible));
        const d = firstDoable ?? diary.sortedDiaries[0];
        return d ? { kind: 'tier', id: d.id } : undefined;
      })();

  const current: JournalSel | undefined = (() => {
    const s = sel[tab];
    // While searching, the pane follows the results: a selection the search hides gives way to the first match.
    if (searching && navRows.length > 0) return s && navRows.some(r => r.key === selKey(s)) ? s : firstRow.sel;
    if (tab === 'diaries') return s ?? diaryDefault;
    if (tab === 'quests' && s?.kind === 'quest' && !items.some(i => i.t === 'row' && i.key === selKey(s))) return firstRow?.sel;
    return s ?? firstRow?.sel;
  })();
  const currentKey = current ? selKey(current) : '';

  /* ── Jumps from elsewhere (prerequisites, the feed, Next best actions) ───── */

  useEffect(() => {
    if (!quest.highlightedId) return;
    setOsrsJournalTab('quests');
    select('quests', { kind: 'quest', id: quest.highlightedId });
  }, [quest.highlightedId, select]);
  useEffect(() => {
    if (!diary.highlightedId) return;
    setOsrsJournalTab('diaries');
    select('diaries', { kind: 'tier', id: diary.highlightedId });
  }, [diary.highlightedId, select]);

  // Keep the selected entry in view.
  useLayoutEffect(() => {
    if (!currentKey) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-sel-key="${CSS.escape(currentKey)}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [currentKey, tab]);

  // Close the menu on tab change, Escape, a press elsewhere or scrolling the list.
  useEffect(() => { setMenu(null); setFiltersOpen(false); }, [tab]);

  /* ── Search keys: "/" to search, Up/Down through the results, Enter to open, Escape to clear ── */

  useEffect(() => { setCursor(-1); }, [tab, term]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      const input = searchRef.current;
      if (!input || input.getClientRects().length === 0) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const cursorKey = cursor >= 0 ? navRows[cursor]?.key ?? '' : '';
  useLayoutEffect(() => {
    if (!cursorKey) return;
    scrollRef.current?.querySelector<HTMLElement>(`[data-sel-key="${CSS.escape(cursorKey)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [cursorKey]);

  const openRow = (r: Extract<Item, { t: 'row' }>) => {
    select(tab, r.sel);
    if (r.sel.kind === 'caTier') ca.setExpandedId(r.sel.id);
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (navRows.length === 0) return;
      e.preventDefault();
      const from = cursor >= 0 ? cursor : Math.max(-1, navRows.findIndex(r => r.key === currentKey));
      setCursor(e.key === 'ArrowDown' ? Math.min(navRows.length - 1, from + 1) : Math.max(0, from - 1));
    } else if (e.key === 'Enter') {
      const r = navRows[cursor >= 0 ? cursor : 0];
      if (r) { e.preventDefault(); openRow(r); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (term) setTerm(''); else e.currentTarget.blur();
    }
  };
  useEffect(() => {
    if (!menu && !filtersOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); setFiltersOpen(false); } };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (menu && !t?.closest('.ojs-menu')) setMenu(null);
      if (filtersOpen && !t?.closest('.ojs-filters') && !t?.closest('.ojs-filter-btn')) setFiltersOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [menu, filtersOpen]);

  /* ── What each entry does: complete, map, wiki ─────────────────────────── */

  const questById = (id: string) => quest.allQuests.find(q => q.id === id);
  const taskById = (id: string) => ALL_DIARY_TASKS.find(t => t.id === id);
  const caTaskById = (id: string) => ALL_CA_TASKS.find(t => t.id === id);
  const diaryById = (id: string) => diary.diaries.find(d => d.id === id);

  const actionsFor = (s: JournalSel): { complete?: (e: React.MouseEvent) => void; verb: string; map: MapTarget | null; wiki: string } => {
    if (s.kind === 'quest') {
      const q = questById(s.id);
      if (!q) return { verb: 'Complete', map: null, wiki: '' };
      return {
        verb: 'Complete',
        complete: q.status === 'COMPLETED' ? undefined : (e) => quest.handleQuestToggle(e, q),
        map: questMapTarget(q, unlocks, gameModeId),
        wiki: quest.wikiUrl(q.name),
      };
    }
    if (s.kind === 'task') {
      const t = taskById(s.id);
      if (!t) return { verb: 'Complete', map: null, wiki: '' };
      const done = unlocks.diaries.includes(t.tierId) || unlocks.completedTasks.includes(t.id);
      return { verb: 'Complete', complete: done ? undefined : (e) => diary.handleTaskToggle(t, e), map: taskMapTarget(t, unlocks, gameModeId), wiki: diary.getDiaryWikiLink(t.tierId) };
    }
    if (s.kind === 'tier') {
      const d = diaryById(s.id);
      return {
        verb: 'Complete',
        complete: d && d.status !== 'COMPLETED' ? (e) => diary.handleToggle(e, d) : undefined,
        map: tierMapTarget(s.id, unlocks),
        wiki: diary.getDiaryWikiLink(s.id),
      };
    }
    if (s.kind === 'caTask') {
      const t = caTaskById(s.id);
      if (!t) return { verb: 'Complete', map: null, wiki: '' };
      return {
        verb: 'Complete',
        complete: unlocks.completedTasks.includes(t.id) ? undefined : (e) => ca.handleTaskComplete(t, e),
        map: caTaskMapTarget(t, unlocks, gameModeId),
        wiki: t.name ? `https://oldschool.runescape.wiki/w/${encodeURIComponent(t.name.replace(/ /g, '_'))}` : ca.getWikiUrl(t.monster),
      };
    }
    const tier = CA_DATA[s.id];
    return {
      verb: 'Record',
      complete: tier && !unlocks.cas.includes(tier.id) ? (e) => ca.handleTierComplete(e, tier) : undefined,
      map: null,
      wiki: 'https://oldschool.runescape.wiki/w/Combat_Achievements',
    };
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, s: JournalSel, name: string) => {
    e.preventDefault();
    const list = listRef.current;
    if (!list) return;
    const lr = list.getBoundingClientRect();
    const rr = e.currentTarget.getBoundingClientRect();
    const menuH = 140;
    let top = rr.top - lr.top + 14;
    if (top + menuH > lr.height) top = Math.max(0, rr.top - lr.top - menuH + 4);
    setMenuNote(null);
    setMenu({ sel: s, name, top, left: Math.min(150, Math.max(0, lr.width - 250)) });
  };

  const showInList = (s: JournalSel) => {
    if (s.kind === 'quest') { quest.focusCard(s.id); return; }
    const tierId = s.kind === 'task' ? taskById(s.id)?.tierId : s.kind === 'tier' ? s.id : undefined;
    if (tierId) { diary.setExpandedId(tierId); setOsrsJournalTab('diaries'); select('diaries', { kind: 'tier', id: tierId }); return; }
    const caTier = s.kind === 'caTask' ? caTaskById(s.id)?.tierId : s.id;
    if (caTier) { ca.setExpandedId(caTier); setOsrsJournalTab('combat'); select('combat', s); }
  };

  const unlocksNote = (id: string): string => {
    const imp = computeUnlockImpact(unlocks, { ...unlocks, quests: [...unlocks.quests, id] }, gameModeId);
    const parts: string[] = [];
    if (imp.directQuestNames.length) parts.push(`Quests: ${imp.directQuestNames.slice(0, 5).join(', ')}${imp.directQuestNames.length > 5 ? '…' : ''}`);
    if (imp.directDiaryIds.length) parts.push(`Diary tiers: ${imp.directDiaryIds.slice(0, 4).join(', ')}${imp.directDiaryIds.length > 4 ? '…' : ''}`);
    return parts.join('. ') || 'Nothing new opens straight away.';
  };

  /* ── Footer numbers ────────────────────────────────────────────────────── */

  const readyCount = readyQuests.length + readyTasks.length + readyCA.length;
  const keysWaiting = (readyQuests.reduce((s, q) => s + questRate(q), 0)
    + readyTasks.reduce((s, t) => s + taskRate(t), 0)
    + readyCA.reduce((s, t) => s + caRate(t), 0)) / 100;
  const keysWaitingText = readyCount === 0 ? 'none yet' : keysWaiting < 1 ? 'under 1 at base chance' : `about ${Math.round(keysWaiting)} at base chance`;

  const routeCheckFor = (id: string): string | null => {
    if (!doability.isChunked) return null;
    const r = doability.rows.find(row => row.id === id);
    if (!r) return null;
    const label = QUEST_DOABILITY_BUCKET_LABEL(r.bucket, true);
    return r.strandedChunk ? `${label}: ${r.strandedChunk.label}` : label;
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  const onSkillClick = quest.openSkillPopover;
  const detail = (() => {
    if (!current) return <div className="ojs-detail" />;
    const onSelect = (s: JournalSel) => select(tab, s);
    if (current.kind === 'quest') {
      const q = questById(current.id);
      return q ? <QuestDetail key={currentKey} quest={q} unlocks={unlocks} gameModeId={gameModeId} currentQP={quest.currentQP}
        wikiUrl={quest.wikiUrl} difficultyLabel={quest.difficultyLabel} routeCheck={routeCheckFor(q.id)}
        onComplete={quest.handleQuestToggle} onPrereqClick={quest.focusCard} onSkillClick={onSkillClick} /> : null;
    }
    if (current.kind === 'task') {
      const t = taskById(current.id);
      return t ? <DiaryTaskDetail key={currentKey} task={t} unlocks={unlocks} gameModeId={gameModeId} areaRoutes={areaRoutes}
        wikiUrl={diary.getDiaryWikiLink} onTaskComplete={diary.handleTaskToggle} onSkillClick={onSkillClick} onSelect={onSelect} /> : null;
    }
    if (current.kind === 'tier') {
      const d = diaryById(current.id);
      return d ? <DiaryTierDetail key={currentKey} diary={d} unlocks={unlocks} gameModeId={gameModeId} areaRoutes={areaRoutes}
        searchTerm={tab === 'diaries' && !noMatches ? term : ''} wikiUrl={diary.getDiaryWikiLink}
        onTierComplete={diary.handleToggle} onTaskComplete={diary.handleTaskToggle} onSkillClick={onSkillClick} onSelect={onSelect} /> : null;
    }
    if (current.kind === 'caTask') {
      const t = caTaskById(current.id);
      return t ? <CATaskDetail key={currentKey} task={t} unlocks={unlocks} gameModeId={gameModeId} areaRoutes={areaRoutes} monsterWikiUrl={ca.getWikiUrl}
        onTaskComplete={ca.handleTaskComplete} onSelect={onSelect} /> : null;
    }
    const tier = CA_DATA[current.id];
    return tier ? <CATierDetail key={currentKey} tier={tier} tasks={caTasksOf.get(tier.id) ?? []} unlocks={unlocks}
      totalPoints={ca.totalPoints} nextTier={ca.nextTier} onTierComplete={ca.handleTierComplete} /> : null;
  })();

  const topLine = tab === 'quests' ? ['Quest Points:', `${quest.currentQP}/${quest.maxQP}`]
    : tab === 'diaries' ? ['Achievement Diaries', `${stats.diaries.done}/${stats.diaries.total} tasks`]
    : tab === 'combat' ? ['Combat Achievements', `${ca.totalPoints.toLocaleString()} pts`]
    : null;
  const legend = tab === 'quests' || (tab === 'diaries' && searching) ? [['Done', TONE.done], ['Can do now', TONE.ready], ['Not yet', TONE.locked]]
    : tab === 'diaries' ? [['Done', TONE.done], ['Started', TONE.ready], ['Not started', TONE.locked]]
    : tab === 'combat' ? [['Done', TONE.done], ['Can do now', TONE.ready], ["Can't reach", ORANGE], ['Boss locked', TONE.locked]]
    : null;

  const activeFilters = tab === 'quests'
    ? [quest.filter !== 'ALL', quest.activeRegion !== 'ALL', quest.diffFilter !== 'ALL', quest.sortMode !== 'SMART', quest.groupBySeries, quest.advisorMode].filter(Boolean).length
    : tab === 'diaries'
      ? [diary.filterStatus !== 'ALL', diary.filterRegion !== 'ALL', diary.filterTier !== 'ALL', diary.sortMode !== 'AREA'].filter(Boolean).length
      : tab === 'combat' ? [ca.filterStatus !== 'ALL', ca.filterTier !== 'ALL'].filter(Boolean).length : 0;
  // Filters that narrow the list (not sort or grouping), for the no-matches line.
  const narrowing = tab === 'quests' ? quest.filter !== 'ALL' || quest.activeRegion !== 'ALL' || quest.diffFilter !== 'ALL'
    : tab === 'diaries' ? diary.filterStatus !== 'ALL' || diary.filterRegion !== 'ALL' || diary.filterTier !== 'ALL'
    : tab === 'combat' ? ca.filterStatus !== 'ALL' || ca.filterTier !== 'ALL' : false;

  const menuActions = menu ? actionsFor(menu.sel) : null;

  return (
    <div className="ojs-root">
      {/* The Progression tab row, so every other tab is one click away. */}
      {progressionTabs.length > 0 && (
        <div role="tablist" aria-label="Dashboard sections" className="osrs-dash-tablist ojs-navtabs no-scrollbar">
          {progressionTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === 'JOURNAL'}
              className="osrs-tab"
              onClick={() => (t.id === 'JOURNAL' ? undefined : openOsrsProgressionTab(t.id))}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {/* Summary bar */}
      <div className="osrs-win ojs-bar">
        <span className="ojs-bar-title"><JournalIcon kind="quest" />Journal</span>
        <span className="ojs-stat" data-examine={`${stats.quests.done} of ${stats.quests.total} quests and miniquests done, ${stats.quests.available} ready to complete.`} data-examine-name="Quests">
          <span style={{ color: ORANGE }}>Quests</span> <span className="w">{stats.quests.done}/{stats.quests.total}</span> · <span className="y">{stats.quests.available} ready</span>
        </span>
        <span className="ojs-stat" data-examine={`${stats.diaries.done} of ${stats.diaries.total} Achievement Diary tasks done, ${stats.diaries.doable} doable now.`} data-examine-name="Diary tasks">
          <span style={{ color: ORANGE }}>Diary tasks</span> <span className="w">{stats.diaries.done}/{stats.diaries.total}</span> · <span className="y">{stats.diaries.doable} doable</span>
        </span>
        <span className="ojs-stat" data-examine={`${stats.ca.points} of ${stats.ca.pointsTotal} Combat Achievement points, ${stats.ca.tasksDone} of ${stats.ca.tasksTotal} tasks, ${stats.ca.done} of ${stats.ca.total} reward tiers. ${stats.ca.doable} tasks at a boss you can reach.`} data-examine-name="Combat">
          <span style={{ color: ORANGE }}>Combat</span> <span className="w">{caPointsLabel(stats)}</span> · <span className="y">{stats.ca.doable} doable</span>
        </span>
        <div className="ojs-bar-keys">
          <span className="ojs-small" style={{ color: '#c8b897' }}>Keys</span>
          <div className="osrs-slot" style={{ width: 44, height: 40 }} title="Keys: spend one on a table in Spend Keys for a random unlock">
            <img className="osrs-px" src={osrsAsset('items/key.png')} alt="Keys" width={36} height={32} />
            <span className="osrs-stack">{keys}</span>
          </div>
        </div>
      </div>

      <section aria-label="Journal" className="osrs-win ojs-win">
        <div className="ojs-titlebar">
          <h2>Journal</h2>
          <button type="button" className="ojs-close" aria-label="Close" title="Close" onClick={() => openOsrsScreen('home')}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="#ff981f" strokeWidth="2.5" /></svg>
          </button>
        </div>

        <div role="tablist" className="ojs-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="ojs-tab" onClick={() => setOsrsJournalTab(id)}>{label}</button>
          ))}
          <label className="ojs-search" title={'Search quests, series and start points, diary tasks and areas, combat tasks, bosses and tiers.\nPress / to search, Up and Down to move, Enter to open, Escape to clear.\nRight-click an entry for options.'}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="2" /></svg>
            <input
              ref={searchRef}
              type="search"
              aria-label="Search the journal"
              aria-controls="ojs-results"
              aria-activedescendant={cursorKey ? rowDomId(cursorKey) : undefined}
              placeholder="Search the journal ( / )"
              spellCheck={false}
              autoComplete="off"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={onSearchKey}
            />
            {term && (
              <button type="button" className="ojs-search-x" aria-label="Clear search" title="Clear search" onClick={() => { setTerm(''); searchRef.current?.focus(); }}>
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
            )}
          </label>
          {(tab === 'quests' || tab === 'diaries' || tab === 'combat') && (
            <button type="button" className="osrs-btn ojs-filter-btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(o => !o)}
              title="Filters, sort and insights">
              Filters{activeFilters > 0 && <span style={{ color: YELLOW, fontFamily: 'RSSmall, sans-serif' }}>{activeFilters}</span>}
            </button>
          )}
          {filtersOpen && (
            <div className="osrs-win ojs-filters" role="dialog" aria-label="Filters">
              {tab === 'quests' && <QuestFilters q={quest} onPick={(id) => { quest.focusCard(id); setFiltersOpen(false); }} />}
              {tab === 'diaries' && <DiaryFilters d={diary} />}
              {tab === 'combat' && <CAFilters c={ca} />}
            </div>
          )}
        </div>

        <div className="ojs-body">
          <div className="osrs-inner ojs-list" ref={listRef}>
            {topLine && <div className="ojs-topline">{topLine[0]}<span>{topLine[1]}</span></div>}
            <div className="ojs-list-scroll" id="ojs-results" ref={scrollRef} onScroll={() => menu && setMenu(null)}>
              {noMatches && (
                <div className="ojs-nomatch" role="status">
                  No matches for <span className="w">{query.raw}</span>{narrowing ? ' with these filters' : ''}.{' '}
                  <button type="button" className="ojs-link" onClick={() => { setTerm(''); searchRef.current?.focus(); }}>Clear</button>
                </div>
              )}
              {tab === 'diaries' && !searching
                ? <DiaryGrid d={diary} unlocks={unlocks} currentKey={currentKey}
                    onPick={(id) => { diary.setExpandedId(id); select('diaries', { kind: 'tier', id }); }}
                    onMenu={(e, id) => openMenu(e, { kind: 'tier', id }, id)} />
                : items.map(item => {
                  if (item.t === 'head') {
                    return (
                      <div key={item.key} className="ojs-head">
                        {item.icon && <JournalIcon kind={item.icon} />}{item.title}
                        <span className={`ojs-count${item.found ? ' is-found' : ''}`} title={item.found ? `${item.count.replace(' / ', ' of ')} match` : undefined}>{item.count}</span>
                      </div>
                    );
                  }
                  if (item.t === 'empty') return <div key={item.key} className="ojs-empty" style={{ paddingLeft: tab === 'quests' || tab === 'combat' ? 10 : 34 }}>{item.text}</div>;
                  const isSel = item.key === currentKey;
                  return (
                    <button
                      key={item.key}
                      id={rowDomId(item.key)}
                      type="button"
                      data-sel-key={item.key}
                      className={`ojs-row${isSel ? ' is-sel' : ''}${item.bold ? ' is-bold' : ''}${item.key === cursorKey ? ' is-cursor' : ''}`}
                      style={{ paddingLeft: item.pad, color: isSel && item.color === ORANGE ? '#ffffff' : item.color }}
                      title={item.tip}
                      aria-current={isSel ? 'true' : undefined}
                      onClick={() => openRow(item)}
                      onContextMenu={(e) => { select(tab, item.sel); openMenu(e, item.sel, item.name); }}
                    >
                      <span className="ojs-row-name"><Hl text={item.title} hits={item.hits} /></span>
                      {item.via && <span className="ojs-row-via"><Hl text={item.via.text} hits={item.via.hits} /></span>}
                      {item.keyText && <span className="ojs-row-key" style={{ color: item.keyColor }}><Hl text={item.keyText} hits={item.keyHits} /></span>}
                    </button>
                  );
                })}
            </div>
            {legend && (
              <div className="ojs-legend">{legend.map(([label, color]) => <span key={label} style={{ color }}>{label}</span>)}</div>
            )}

            {menu && menuActions && (
              <div className="ojs-menu" role="menu" aria-label={`Options for ${menu.name}`} style={{ top: menu.top, left: menu.left }}>
                <div className="ojs-menu-title">Choose Option</div>
                <div className="ojs-menu-body">
                  <MenuItem verb={menuActions.verb} target={menu.name} disabled={!menuActions.complete}
                    onClick={(e) => { menuActions.complete?.(e); setMenu(null); }} />
                  <MenuItem verb="Show on map" target={menu.name} disabled={!menuActions.map}
                    onClick={() => { if (menuActions.map) showChunkOnMap(menuActions.map.cx, menuActions.map.cy); setMenu(null); }} />
                  {menuActions.wiki && (
                    <a role="menuitem" className="ojs-menu-item" href={menuActions.wiki} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(null)}>
                      Open wiki <span className="t">{menu.name}</span>
                    </a>
                  )}
                  {tab !== listTabFor(menu.sel) && (
                    <MenuItem verb={`Show in ${TAB_LABEL[listTabFor(menu.sel)]}`} target={menu.name} onClick={() => { showInList(menu.sel); setMenu(null); }} />
                  )}
                  {(menu.sel.kind === 'quest' || menu.sel.kind === 'task' || menu.sel.kind === 'tier') && (
                    <MenuItem verb="Plan a route" target={menu.name} onClick={() => {
                      const s = menu.sel;
                      if (s.kind === 'quest') planJournalAction({ kind: 'quest', sub: 'QUESTS', id: s.id, name: menu.name, unmet: 0, diffRank: 0 });
                      else {
                        const tierId = s.kind === 'task' ? taskById(s.id)?.tierId ?? '' : s.id;
                        planJournalAction({ kind: 'diary', sub: 'DIARIES', id: tierId, name: tierId, unmet: 0, diffRank: 0 });
                      }
                      setMenu(null);
                    }} />
                  )}
                  {menu.sel.kind === 'quest' && QUEST_DATA[menu.sel.id] && !unlocks.quests.includes(menu.sel.id) && (
                    <MenuItem verb="What it unlocks" target={menu.name} onClick={() => setMenuNote(unlocksNote(menu.sel.id))} keepOpen />
                  )}
                  {menuNote && <div className="ojs-menu-note">{menuNote}</div>}
                  <MenuItem verb="Cancel" target="" onClick={() => setMenu(null)} />
                </div>
              </div>
            )}
          </div>

          {detail}
        </div>

        <div className="ojs-foot">
          <span>Quest Points: <span style={{ color: '#ffffff' }}>{quest.currentQP}/{quest.maxQP}</span></span>
          <span>Ready: <span style={{ color: '#ffffff' }}>{readyCount}</span></span>
          <span>Keys waiting: <span style={{ color: YELLOW }}>{keysWaitingText}</span></span>
          <span className="ojs-foot-note">Right-click an entry for options. A missed quest roll still gives a Fate Point.</span>
        </div>
      </section>

      {quest.skillPopover && <SkillTrainingPopover {...quest.skillPopover} onClose={() => quest.setSkillPopover(null)} />}
    </div>
  );
};

const TAB_LABEL: Record<OsrsJournalTab, string> = Object.fromEntries(TABS) as Record<OsrsJournalTab, string>;
const listTabFor = (s: JournalSel): OsrsJournalTab =>
  s.kind === 'quest' ? 'quests' : s.kind === 'task' || s.kind === 'tier' ? 'diaries' : 'combat';

const MenuItem: React.FC<{ verb: string; target: string; disabled?: boolean; keepOpen?: boolean; onClick: (e: React.MouseEvent) => void }> =
  ({ verb, target, disabled, onClick }) => (
    <button type="button" role="menuitem" className="ojs-menu-item" disabled={disabled} onClick={onClick}>
      {verb}{target && <> <span className="t">{target}</span></>}
    </button>
  );

/* ── Diaries: one line per area, the four tiers as columns, as in game. ───── */

const TIERS = ['Easy', 'Medium', 'Hard', 'Elite'] as const;
const SHORT: Record<string, string> = { Easy: 'Easy', Medium: 'Med', Hard: 'Hard', Elite: 'Elite' };
const areaOf = (tierId: string): string => tierId.replace(/ (Easy|Medium|Hard|Elite)$/, '');

const DiaryGrid: React.FC<{
  d: ReturnType<typeof useDiaryJournal>;
  unlocks: ReturnType<typeof useGame>['unlocks'];
  currentKey: string;
  onPick: (id: string) => void;
  onMenu: (e: React.MouseEvent<HTMLElement>, id: string) => void;
}> = ({ d, unlocks, currentKey, onPick, onMenu }) => {
  const views = useMemo(() => d.sortedDiaries.map(diary => {
    const tasks = tasksOfTier(diary.id);
    const complete = diary.status === 'COMPLETED';
    const done = complete ? tasks.length : tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
    const tone = complete || (tasks.length > 0 && done === tasks.length) ? TONE.done : done > 0 ? TONE.ready : TONE.locked;
    return { diary, tasks, done, tone };
  }), [d.sortedDiaries, unlocks]);
  const byId = new Map(views.map(v => [v.diary.id, v]));
  const areas = [...new Set(views.map(v => areaOf(v.diary.id)))].sort();
  if (views.length === 0) return <div className="ojs-empty" style={{ paddingLeft: 10 }}>No diaries found matching filter.</div>;

  if (d.sortMode === 'PROGRESS') {
    // "Closest first": one line per tier, in the classic log's order.
    return <>{views.map(v => {
      const key = `tier:${v.diary.id}`;
      return (
        <button key={key} type="button" data-sel-key={key} className={`ojs-row${currentKey === key ? ' is-sel' : ''}`}
          style={{ paddingLeft: 10, color: v.tone }} onClick={() => onPick(v.diary.id)} onContextMenu={(e) => { onPick(v.diary.id); onMenu(e, v.diary.id); }}>
          <span className="ojs-row-name">{v.diary.id}</span>
          <span className="ojs-row-key" style={{ color: v.tone }}>{v.done}/{v.tasks.length}</span>
        </button>
      );
    })}</>;
  }
  return (
    <>
      <div className="ojs-dgrid"><span />{TIERS.map(t => <span key={t} className="ojs-dhdr">{SHORT[t]}</span>)}</div>
      {areas.map(area => (
        <div key={area} className="ojs-dgrid">
          <span className="ojs-darea">{area}</span>
          {TIERS.map(tier => {
            const v = byId.get(`${area} ${tier}`);
            if (!v) return <span key={tier} />;
            const key = `tier:${v.diary.id}`;
            return (
              <button key={tier} type="button" data-sel-key={key} className={`ojs-dcell${currentKey === key ? ' is-sel' : ''}`} style={{ color: v.tone }}
                aria-label={`${v.diary.id}: ${v.done} of ${v.tasks.length} tasks done`} aria-current={currentKey === key ? 'true' : undefined}
                onClick={() => onPick(v.diary.id)} onContextMenu={(e) => { onPick(v.diary.id); onMenu(e, v.diary.id); }}>
                {v.done}/{v.tasks.length}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
};

/* ── Filters: the classic logs' own filter bars and insights, in a drop-down. ─ */

const QuestFilters: React.FC<{ q: ReturnType<typeof useQuestJournal>; onPick: (id: string) => void }> = ({ q, onPick }) => (
  <>
    <JournalFilterBar
      title="Quest Journal"
      icon={<JournalIcon kind="quest" size={16} />}
      accent=""
      searchValue={q.localSearch}
      onSearchChange={q.setLocalSearch}
      searchPlaceholder="Search quests..."
      status={q.filter}
      onStatusChange={q.setFilter}
      statusCounts={q.statusCounts}
      completed={q.completedMain + q.completedMinis}
      total={q.totalQuests + q.totalMinis}
      regions={q.questRegions}
      activeRegion={q.activeRegion}
      onRegionChange={q.setRegionFilter}
      tiers={[{ id: 'Novice' }, { id: 'Intermediate' }, { id: 'Experienced' }, { id: 'Master' }, { id: 'Grandmaster' }]}
      activeTier={q.diffFilter}
      onTierChange={q.setDiffFilter}
      rightExtras={
        <div className="flex items-center gap-2 shrink-0">
          <select value={q.sortMode} onChange={(e) => q.setSortMode(e.target.value)} className="ojr-select" title="Sort quests" aria-label="Sort quests">
            <option value="SMART">Smart</option>
            <option value="NAME">A–Z</option>
            <option value="QP">Quest Points</option>
            <option value="DIFFICULTY">Difficulty</option>
          </select>
          <button type="button" onClick={() => q.setAdvisorMode(!q.advisorMode)} className={`osrs-btn${q.advisorMode ? ' is-on' : ''}`} style={{ height: 28, padding: '0 8px' }}
            title={q.advisorMode ? 'Switch to Quick Wins (by difficulty)' : 'Switch to High Impact (by unlock count)'}>High impact</button>
          <button type="button" onClick={() => q.setGroupBySeries(!q.groupBySeries)} className={`osrs-btn${q.groupBySeries ? ' is-on' : ''}`} style={{ height: 28, padding: '0 8px' }}
            title={q.groupBySeries ? 'Group by Type (Main/Mini)' : 'Group by Series'}>By series</button>
        </div>
      }
    />
    {q.advisorsEnabled && <QuestInsights />}
    {q.showAdvisorStrip && <QuestAdvisorPanel ranked={q.rankedQuests} onItemClick={onPick} />}
  </>
);

const DiaryFilters: React.FC<{ d: ReturnType<typeof useDiaryJournal> }> = ({ d }) => (
  <>
    <JournalFilterBar
      title="Diaries"
      icon={<JournalIcon kind="diary" size={16} />}
      accent=""
      searchValue={d.localSearch}
      onSearchChange={d.setLocalSearch}
      searchPlaceholder="Search diaries or tasks..."
      status={d.filterStatus}
      onStatusChange={d.setFilterStatus}
      statusCounts={d.statusCounts}
      completed={d.unlocks.diaries.length}
      total={Object.keys(DIARY_DATA).length}
      regions={d.regions}
      activeRegion={d.filterRegion}
      onRegionChange={d.setFilterRegion}
      tiers={[{ id: 'Easy' }, { id: 'Medium' }, { id: 'Hard' }, { id: 'Elite' }]}
      activeTier={d.filterTier}
      onTierChange={d.setFilterTier}
      rightExtras={
        <select value={d.sortMode} onChange={(e) => d.setSortMode(e.target.value)} className="ojr-select" title="Sort diaries" aria-label="Sort diaries">
          <option value="AREA">By area</option>
          <option value="PROGRESS">Closest first</option>
        </select>
      }
    />
    {d.advisorsEnabled && <DiaryInsights />}
  </>
);

const CAFilters: React.FC<{ c: ReturnType<typeof useCAJournal> }> = ({ c }) => (
  <>
    <JournalFilterBar
      title="Combat Achievements"
      icon={<JournalIcon kind="ca" size={16} />}
      accent=""
      searchValue={c.localSearch}
      onSearchChange={c.setLocalSearch}
      searchPlaceholder="Search tiers or tasks..."
      status={c.filterStatus}
      onStatusChange={c.setFilterStatus}
      statusCounts={c.statusCounts}
      completed={c.statusCounts.COMPLETED}
      total={Object.keys(CA_DATA).length}
      tiers={[{ id: 'Easy' }, { id: 'Medium' }, { id: 'Hard' }, { id: 'Elite' }, { id: 'Master' }, { id: 'Grandmaster', label: 'GM' }]}
      activeTier={c.filterTier}
      onTierChange={c.setFilterTier}
    />
    {c.advisorsEnabled && <CAInsights />}
  </>
);

export default OsrsJournalScreen;
