import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock,
  Check,
  Swords,
  Store,
  Users,
  Scroll,
  Package,
  BookOpen,
  Sparkles,
  Sprout,
  Flag,
  Gamepad2,
  Pickaxe,
  Skull,
  Route,
  ChevronDown,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { chunkContentService, ChunkContent } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import {
  evaluateQuestEligibility,
  QuestEligibility,
  getQuestStatus,
  QuestStatus,
} from '../utils/journalStatus';
import { classifyShop } from '../utils/merchantShops';
import { resourceReqFor, resourceUsable } from '../utils/chunkResources';
import { mobilityFor } from '../utils/chunkMobility';
import { placeOf, chunkUnlocked, showChunkOnMap } from '../utils/chunkLocations';
import { isAreaReachable, isBankReachable, bankLocksActive } from '../utils/reachability';
import { FARMING_PATCH_LIST, GUILDS_LIST, MINIGAMES_LIST, MOBILITY_LIST, BOSSES_LIST } from '../constants';
import type { ChunkCoord } from '../utils/mapCoords';
import { WikiLink } from './WikiLink';
import { displayAreaName } from '../data/areaMapPolicy';
import { ChunkInfoHeader } from './chunk-info/ChunkInfoHeader';
import { ChunkInfoAccessCard, type ChunkInfoBankState } from './chunk-info/ChunkInfoAccessCard';
import { ChunkInfoBodyState } from './chunk-info/ChunkInfoBodyState';
import { ChunkInfoSection } from './chunk-info/ChunkInfoSection';

import { ChunkInfoSummary } from './chunk-info/ChunkInfoSummary';
import {
  buildChunkInfoDrawerSummary,
  buildChunkInfoSectionStats,
  CHUNK_INFO_SECTION_ORDER,
  getChunkInfoScope,
  chunkContentIsEmpty,
  resolveChunkInfoItemState,
  formatChunkInfoSectionSummary,
  getDefaultChunkInfoSection,
  type ChunkInfoItemState,
  type ChunkInfoSectionId,
  type ChunkInfoSectionStats,
} from './chunk-info/chunkInfoPresentation';

/**
 * What gathering a resource node yields, from the picker's per-skill item tables.
 * Matches the chunk's node name (e.g. "Gem rocks", "Yew tree") against the
 * skill's method keys: exact first, then a tolerant substring match. Returns
 * [item, rate] pairs, or null when the dataset has nothing for this node.
 */
function nodeYields(skill: string, nodeName: string): [string, string][] | null {
  const methods = chunkContentService.skillYields(skill);
  const keys = Object.keys(methods);
  if (!keys.length) return null;
  const lower = nodeName.toLowerCase();
  let key = keys.find(k => k.toLowerCase() === lower);
  // Tolerant fallback, but only for names long enough to be unambiguous
  // (avoids short generic nodes like "Soil"/"Rocks" grabbing the wrong table).
  if (!key && lower.length >= 4) {
    key = keys.find(k => { const kl = k.toLowerCase(); return kl.includes(lower) || (kl.length >= 4 && lower.includes(kl)); });
  }
  return key ? methods[key] : null;
}

/** Trim a raw access-requirement string to a compact chip label. */
const shortReq = (s: string): string =>
  s.replace(/\s*Complete the quest$/i, '')
   .replace(/^Access (?:the |to )?/i, '')
   .replace(/\s+\d+$/, '') // quest-step number suffix
   .trim();

/** Amber lock chip for an entity's access/use requirements (quest, task, guild). */
const ReqBadge: React.FC<{ reqs: string[] }> = ({ reqs }) => (
  <span
    className="text-[9px] px-1 rounded bg-amber-950/60 text-amber-300 flex items-center gap-0.5 max-w-[120px]"
    title={`Access requirement: ${reqs.join(' · ')}`}
  >
    <Lock size={8} className="shrink-0" />
    <span className="truncate">{shortReq(reqs[0])}{reqs.length > 1 ? ` +${reqs.length - 1}` : ''}</span>
  </span>
);

// Boss name → set for O(1) lookup; diary area → home region for the diary gate.
const BOSS_SET = new Set(BOSSES_LIST.map(b => b.toLowerCase()));
const DIARY_AREA_REGION: Record<string, string> = {};
for (const d of Object.values(DIARY_DATA)) {
  const area = d.id.replace(/ (Easy|Medium|Hard|Elite)$/, '');
  DIARY_AREA_REGION[area] = d.region;
}

/**
 * Walk the Connect graph from a chunk to the nearest *named* areas, hopping up
 * to 3 steps through unnamed connector chunks (ocean/dungeon). Skips areas the
 * chunk already belongs to (ownIds).
 */
const expandLinks = (graph: Record<string, string[]>, start: string, ownIds: Set<string>) => {
  const out = new Map<string, { label: string; cx: number; cy: number; via: string | null }>();
  const visited = new Set<string>([start]);
  // Each frontier node carries the named connector (e.g. "Brimhaven Dungeon")
  // traversed to reach it, so we can classify the link type.
  let frontier = (graph[start] ?? []).map(id => ({ id, via: isNaN(+id) ? id : null }));
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: { id: string; via: string | null }[] = [];
    for (const { id, via } of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      const numeric = !isNaN(+id);
      const tx = numeric ? Math.floor(+id / 256) : -1, ty = numeric ? +id % 256 : -1;
      const label = numeric ? (placeOf(tx, ty).subArea ?? placeOf(tx, ty).region) : null;
      if (label) { if (!ownIds.has(id) && !out.has(label)) out.set(label, { label, cx: tx, cy: ty, via }); }
      else {
        const nextVia = numeric ? via : id; // a named connector node names the link
        for (const t of graph[id] ?? []) next.push({ id: t, via: nextVia });
      }
    }
    frontier = next;
  }
  return [...out.values()];
};

/** Classify a link by the named connector it routes through. */
const classifyVia = (via: string | null): string => {
  if (!via) return 'Stairs & links';
  if (/altar/i.test(via)) return 'Altars';
  if (/dungeon|cave|catacomb|lair|sewer|\bmine\b|crypt|basement|temple|prison|vault|nexus|cavern|hole|\bpit\b|ruins|tomb|tunnel/i.test(via)) return 'Dungeons & caves';
  return 'Stairs & links';
};

/**
 * "What can I play here?" — the OneChunkMan-style content readout for a
 * clicked map chunk, or aggregated across its whole region (since this mode
 * unlocks areas, not single chunks). Every activity is checked against the
 * run's actual unlocks — quests via getQuestStatus, monsters via Slayer,
 * shops via their merchant category, farming patches / guilds / minigames
 * via their own unlock tables — and rendered green (usable) or red with a
 * state badge or icon (locked). A concise availability summary and independently
 * expandable content groups follow. Content data: ChunkContentService (credit: source-chunk/chunk-picker-v2).
 */

interface Props {
  chunk: ChunkCoord;
  region: string | null;
  /** Named sub-area this chunk belongs to (e.g. 'Falador'), when known. */
  subArea?: string | null;
  regionChunks: readonly ChunkCoord[];
  unlocked: boolean;
  /** Whole area spans independently owned chunks or subareas. */
  wholeAreaOwnershipMixed: boolean;
  onClose: () => void;
}

const QUEST_BADGE: Record<QuestStatus, { cls: string; label: string }> = {
  COMPLETED: { cls: 'text-green-400', label: 'completed' },
  AVAILABLE: { cls: 'text-amber-300', label: 'requirements met — can do now' },
  LOCKED_REGION: { cls: 'text-gray-500', label: 'locked: region not unlocked' },
  LOCKED_SKILL: { cls: 'text-gray-500', label: 'locked: skill requirements not met' },
  LOCKED_QUEST: { cls: 'text-gray-500', label: 'locked: prerequisite quest missing' },
};

const rowStateCls = (state: ChunkInfoItemState): string => state === 'locked'
  ? 'text-gray-400'
  : state === 'completed'
    ? 'text-gray-400'
    : state === 'neutral' || state === 'mixed'
      ? 'text-gray-300'
      : 'text-gray-100';


// ── Farming patches: chunk object name → FARMING_PATCH_LIST unlock ─────────
const PATCH_RULES: [RegExp, string][] = [
  [/fruit tree patch/i, 'Fruit Tree'],
  [/hardwood (tree )?patch/i, 'Hardwood Tree'],
  [/spirit tree patch/i, 'Spirit Tree'],
  [/crystal tree patch/i, 'Crystal Tree'],
  [/celastrus/i, 'Celastrus'],
  [/redwood (tree )?patch/i, 'Redwood'],
  [/calquat/i, 'Calquat'],
  [/tree patch/i, 'Wood Tree'],
  [/herb patch/i, 'Herb'],
  [/flower patch/i, 'Flower'],
  [/hops patch/i, 'Hops'],
  [/bush patch/i, 'Bush'],
  [/cactus patch/i, 'Cactus'],
  [/mushroom patch/i, 'Mushroom'],
  [/belladonna/i, 'Belladonna'],
  [/seaweed patch/i, 'Seaweed'],
  [/hespori/i, 'Hespori Patch'],
  [/anima patch/i, 'Anima'],
  [/grape ?vine|vine patch/i, 'Vinery'],
  [/coral nursery|coral patch/i, 'Coral Nursery'],
  [/allotment/i, 'Allotment'],
];
const farmingPatchFor = (objectName: string): string | null => {
  for (const [re, patch] of PATCH_RULES) if (re.test(objectName)) return patch;
  return null;
};

const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** List entries (guilds / minigames) present in this chunk's content text. */
const matchListInText = (list: string[], haystack: string): string[] => {
  const out: string[] = [];
  for (const name of list) {
    const re = new RegExp(`\\b${escapeRe(norm(name))}\\b`, 'i');
    if (re.test(haystack)) out.push(name);
  }
  return out;
};

const SectionHead: React.FC<{ icon: React.ReactNode; label: string; count?: number }> = ({ icon, label, count }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-3 mb-1">
    {icon}{label}{count != null && <span className="text-gray-600 font-mono">({count})</span>}
  </div>
);

/** A capped list with a "+N more" expander. */
const CappedList: React.FC<{ items: React.ReactNode[]; cap: number }> = ({ items, cap }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, cap);
  return (
    <>
      {shown}
      {items.length > cap && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-0.5 rounded text-[10px] text-cyan-400/80 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none"
        >
          {expanded ? 'show less' : `+${items.length - cap} more`}
        </button>
      )}
    </>
  );
};

export interface ChunkQuestRow {
  name: string;
  kind: string;
  status: QuestStatus | null;
  eligibility: QuestEligibility | null;
}

export const chunkQuestOverviewItem = (
  row: ChunkQuestRow,
  areaUnlocked: boolean,
): { can: boolean; label: string } | null => {
  if (!row.status || row.status === 'COMPLETED') return null;
  const checks = row.eligibility?.manualChecks ?? [];
  return {
    can: areaUnlocked && row.eligibility?.eligible === true,
    label: checks.length > 0
      ? `${row.name} — ${checks.map(check => `Confirm: ${check}`).join(' · ')}`
      : row.name,
  };
};

export const chunkQuestPresentation = (
  row: ChunkQuestRow,
): { kind: 'completed' | 'available' | 'confirmation' | 'locked' | 'untracked'; title: string } => {
  if (row.status === 'COMPLETED') return { kind: 'completed', title: 'Completed' };
  if (!row.status) return { kind: 'untracked', title: 'miniquest / not tracked' };
  if (row.status === 'AVAILABLE' && row.eligibility && !row.eligibility.eligible) {
    return {
      kind: 'confirmation',
      title: row.eligibility.manualChecks.map(check => `Confirm: ${check}`).join(' · '),
    };
  }
  if (row.status === 'AVAILABLE') {
    return { kind: 'available', title: QUEST_BADGE.AVAILABLE.label };
  }
  return { kind: 'locked', title: QUEST_BADGE[row.status].label };
};

export const ChunkActivityPanel: React.FC<Props> = ({ chunk, region, subArea, regionChunks, unlocked, wholeAreaOwnershipMixed, onClose }) => {
  const { unlocks, gameModeId, customMode } = useGame();
  const [mode, setMode] = useState<'chunk' | 'region'>('chunk');
  const [, setLoadedTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [openShop, setOpenShop] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<string | null>(null);
  const [linksCap, setLinksCap] = useState<Record<string, number>>({});
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setFailed(false);
    chunkContentService.init()
      .then(ok => {
        if (!active) return;
        if (ok) setLoadedTick(t => t + 1);
        else setFailed(true);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [loadAttempt]);

  const content: ChunkContent | null = useMemo(() => {
    if (!chunkContentService.ready) return null;
    if (mode === 'region' && region) return chunkContentService.aggregate([...regionChunks]);
    return chunkContentService.contentFor(chunk.cx, chunk.cy);
  }, [mode, region, regionChunks, chunk, chunkContentService.ready]);

  const entrances = mode === 'chunk' && chunkContentService.ready
    ? chunkContentService.entrancesFor(chunk.cx, chunk.cy)
    : [];
  const entryRequirements = mode === 'chunk' && chunkContentService.ready
    ? chunkContentService.chunkEntryRequirements(chunk.cx, chunk.cy)
    : [];

  const bankState: ChunkInfoBankState = mode !== 'chunk' || !chunkContentService.ready || !chunkContentService.hasBank(chunk.cx, chunk.cy)
    ? null
    : !bankLocksActive(gameModeId, customMode)
      ? 'present'
      : isBankReachable(chunk.cx, chunk.cy, unlocks, gameModeId, customMode)
        ? 'available'
        : 'locked';

  // Transport links grouped by network (fairy ring / canoe / boat / …). A link
  // is only usable if both the destination area AND its transport network are
  // unlocked — an unlocked area you can't yet sail/ring to is still locked.
  const linkGroups = useMemo(() => {
    if (!chunkContentService.ready) return [];
    const graph = chunkContentService.connectGraph();
    const ownIds = new Set(regionChunks.map(c => String(c.cx * 256 + c.cy)));
    const sources = mode === 'region' ? regionChunks : [chunk];
    const mob = new Set(unlocks.mobility ?? []);
    const mobNetworks = new Set(MOBILITY_LIST);
    const byCat = new Map<string, Map<string, { cx: number; cy: number; unlocked: boolean }>>();

    for (const s of sources) {
      const dests = expandLinks(graph, String(s.cx * 256 + s.cy), ownIds);
      if (!dests.length) continue;
      // A recognised transport object in the source chunk names the network
      // (fairy ring / canoe / boat …); otherwise classify by the connector.
      const c = chunkContentService.contentFor(s.cx, s.cy);
      const nets = new Set<string>();
      for (const [obj] of c?.objects ?? []) { const n = mobilityFor(obj); if (n) nets.add(n); }
      const sourceNet = nets.size === 1 ? [...nets][0] : null;
      for (const d of dests) {
        const category = sourceNet ?? classifyVia(d.via);
        if (!byCat.has(category)) byCat.set(category, new Map());
        const m = byCat.get(category)!;
        if (!m.has(d.label)) m.set(d.label, { cx: d.cx, cy: d.cy, unlocked: chunkUnlocked(d.cx, d.cy, unlocks, gameModeId) });
      }
    }

    return [...byCat.entries()].map(([category, m]) => ({
      category,
      isNetwork: mobNetworks.has(category),
      networkUnlocked: !mobNetworks.has(category) || mob.has(category),
      dests: [...m.entries()].map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.label.localeCompare(b.label)),
    })).sort((a, b) => b.dests.length - a.dests.length);
  }, [mode, chunk, regionChunks, unlocks, gameModeId, chunkContentService.ready]);

  const totalLinks = useMemo(() => linkGroups.reduce((a, g) => a + g.dests.length, 0), [linkGroups]);

  const slayerLevel = unlocks.levels['Slayer'] ?? 1;
  const slayerUnlocked = (unlocks.skills?.['Slayer'] ?? 0) > 0;

  const questRows = useMemo(() => {
    if (!content) return [];
    return Object.entries(content.quests)
      .map(([name, kind]) => {
        const data = QUEST_DATA[name];
        const status = data ? getQuestStatus(data, unlocks, gameModeId) : null;
        const eligibility = data ? evaluateQuestEligibility(data, unlocks, gameModeId) : null;
        return { name, kind, status, eligibility };
      })
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'first' ? -1 : 1));
  }, [content, unlocks, gameModeId]);

  // ── Derived sections with their own unlock gates ──────────────────────────
  const derived = useMemo(() => {
    if (!content) return null;

    // Shops → merchant category gate.
    const shops = content.shops.map(name => {
      const category = classifyShop(name);
      const catUnlocked = category != null && unlocks.merchants.includes(category);
      return { name, category, usable: catUnlocked };
    });

    // Monsters split: world bosses (gated by the Bosses table) vs the rest
    // (gated per-monster on Slayer, handled at render time).
    const bosses: { name: string; count: number; usable: boolean }[] = [];
    const monsters: typeof content.monsters = [];
    for (const m of content.monsters) {
      if (BOSS_SET.has(m.name.toLowerCase())) {
        bosses.push({ name: m.name, count: m.count, usable: unlocks.bosses.includes(m.name) });
      } else {
        monsters.push(m);
      }
    }

    // Objects split four ways: Transport nodes (mobility gate), Farming patches
    // (own table), gatherable Resources (skill tier + level), and inert scenery.
    const transport: { name: string; count: number; network: string; usable: boolean }[] = [];
    const farming: { name: string; count: number; patch: string; usable: boolean }[] = [];
    const resources: { name: string; count: number; skill: string; level: number; usable: boolean }[] = [];
    const objects: [string, number][] = [];
    for (const [name, count] of content.objects) {
      const network = mobilityFor(name);
      const patch = farmingPatchFor(name);
      const req = resourceReqFor(name);
      if (network && MOBILITY_LIST.includes(network)) {
        transport.push({ name, count, network, usable: unlocks.mobility.includes(network) });
      } else if (patch && FARMING_PATCH_LIST.includes(patch)) {
        farming.push({ name, count, patch, usable: unlocks.farming.includes(patch) });
      } else if (req) {
        resources.push({ name, count, skill: req.skill, level: req.level, usable: resourceUsable(req, unlocks) });
      } else {
        objects.push([name, count]);
      }
    }
    // Group like nodes within a skill first, then by required level.
    resources.sort((a, b) => a.skill.localeCompare(b.skill) || a.level - b.level || a.name.localeCompare(b.name));

    // Diary tasks → reachable when the diary's home region is unlocked.
    const diaries = Object.entries(content.diaries).map(([area, refs]) => {
      const region = DIARY_AREA_REGION[area];
      const reachable = !region || isAreaReachable(region, unlocks, gameModeId);
      return { area, refs, region, reachable };
    });

    // Guilds & minigames detected from the chunk's own text.
    const haystack = norm([
      content.name ?? '', subArea ?? '',
      ...content.npcs, ...content.objects.map(o => o[0]),
      ...content.shops, ...Object.keys(content.quests), ...content.spawns,
    ].join(' | '));
    const guilds = matchListInText(GUILDS_LIST, haystack)
      .map(name => ({ name, usable: unlocks.guilds.includes(name) }));
    const minigames = matchListInText(MINIGAMES_LIST, haystack)
      .map(name => ({ name, usable: unlocks.minigames.includes(name) }));

    return { shops, bosses, monsters, transport, farming, resources, objects, guilds, minigames, diaries };
  }, [content, subArea, unlocks, gameModeId]);

  // Scope determines whether Whole area can make a trustworthy availability claim.
  const scope = getChunkInfoScope(mode, wholeAreaOwnershipMixed, unlocked);
  const stateFor = (intrinsicAvailable: boolean): ChunkInfoItemState =>
    resolveChunkInfoItemState(intrinsicAvailable, scope);
  const neutralRows = (count: number): ChunkInfoItemState[] =>
    Array.from({ length: count }, () => 'neutral');

  const monsterPresentations = useMemo(() => {
    if (!derived) return [];
    const sources = mode === 'region' ? regionChunks : [chunk];

    return derived.monsters.map(monster => {
      const slayerMet = monster.slayer == null
        || (slayerUnlocked && slayerLevel >= monster.slayer);
      const requirements = [...new Set(
        sources.flatMap(source => chunkContentService.taskRequirements(
          monster.name,
          'monster',
          source.cx,
          source.cy,
        )),
      )];
      const state: ChunkInfoItemState = scope !== 'mixed' && requirements.length > 0
        ? 'neutral'
        : resolveChunkInfoItemState(slayerMet, scope);

      return { ...monster, slayerMet, requirements, state };
    });
  }, [derived, mode, regionChunks, chunk, slayerUnlocked, slayerLevel, scope]);

  const sectionStates = useMemo<Partial<Record<ChunkInfoSectionId, ChunkInfoItemState[]>>>(() => {
    if (!content || !derived) return {};
    const quests = questRows.map(row => {
      if (row.status === 'COMPLETED') return 'completed' as const;
      const item = chunkQuestOverviewItem(row, true);
      return item ? stateFor(item.can) : 'neutral';
    });
    const combat = [
      ...derived.bosses.map(boss => stateFor(boss.usable)),
      ...monsterPresentations.map(monster => monster.state),
    ];
    const gathering = [
      ...derived.farming.map(patch => stateFor(patch.usable)),
      ...derived.resources.map(resource => stateFor(resource.usable)),
    ];
    const shops = derived.shops.map(shop => shop.category ? stateFor(shop.usable) : 'neutral');
    const travel = [
      ...derived.transport.map(node => stateFor(node.usable)),
      ...linkGroups.flatMap(group => group.dests.map(destination => stateFor(group.networkUnlocked && destination.unlocked))),
    ];
    const other = [
      ...derived.guilds.map(guild => stateFor(guild.usable)),
      ...derived.minigames.map(minigame => stateFor(minigame.usable)),
      ...derived.diaries.map(diary => stateFor(diary.reachable)),
      ...neutralRows(derived.objects.length),
      ...neutralRows(Object.keys(content.clues).length),
      ...neutralRows(content.npcs.length),
      ...neutralRows(content.spawns.length),
    ];
    return { quests, combat, gathering, shops, travel, other };
  }, [content, derived, questRows, scope, monsterPresentations, linkGroups]);

  const sectionStats = useMemo<Partial<Record<ChunkInfoSectionId, ChunkInfoSectionStats>>>(() => {
    const next: Partial<Record<ChunkInfoSectionId, ChunkInfoSectionStats>> = {};
    for (const id of CHUNK_INFO_SECTION_ORDER) {
      const states = sectionStates[id];
      if (states?.length) next[id] = buildChunkInfoSectionStats(states);
    }
    return next;
  }, [sectionStates]);

  const drawerSummary = useMemo(
    () => buildChunkInfoDrawerSummary(sectionStats, scope),
    [sectionStats, scope],
  );

  const title = mode === 'region' && region
    ? region
    : content?.name ?? `Chunk ${chunk.cx}, ${chunk.cy}`;
  const emptyContentState = !content || chunkContentIsEmpty(content);
  const detailedContent = content && derived;

  const presentSectionIds = CHUNK_INFO_SECTION_ORDER.filter(id => (sectionStats[id]?.total ?? 0) > 0);
  const defaultSection = getDefaultChunkInfoSection(presentSectionIds);
  const panelResetKey = `${mode}:${chunk.cx},${chunk.cy}`;

  useEffect(() => {
    if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    setOpenShop(null);
    setOpenResource(null);
    setLinksCap({});
  }, [panelResetKey]);
  const hasMixedScope = scope === 'mixed';

  const bossRows = derived?.bosses.map(b => {
    const visibleState = resolveChunkInfoItemState(b.usable, scope);
    return (
      <div key={b.name} className="flex items-center justify-between gap-2 py-px"
        title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? `${b.name} unlocked` : b.usable ? 'Chunk locked' : `Needs the "${b.name}" boss unlock`}>
        <span className={`truncate ${rowStateCls(visibleState)}`}>
          <WikiLink name={b.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">{'\u00d7'}{b.count}</span>
        </span>
        <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${visibleState === 'mixed' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
          {visibleState === 'mixed' ? 'Area' : visibleState === 'available' ? 'Unlocked' : b.usable ? 'Locked' : `Needs ${b.name}`}
        </span>
      </div>
    );
  }) ?? [];
  const monsterRows = monsterPresentations.map(m => {
    const met = m.slayerMet;
    const visibleState = m.state;
    const reqs = m.requirements;
    const isRequirementNeutral = visibleState === 'neutral' && reqs.length > 0;
    return (
      <div key={m.name} className="flex items-center justify-between gap-2 py-px">
        <span className={`truncate ${rowStateCls(visibleState)}`}>
          <WikiLink name={m.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">{'\u00d7'}{m.count}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {reqs.length > 0 && <ReqBadge reqs={reqs} />}
          {m.slayer != null && (
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] px-1 rounded font-bold ${visibleState === 'mixed' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : isRequirementNeutral && met ? 'bg-white/5 text-gray-300' : met ? 'bg-red-950/70 text-red-300' : 'bg-amber-950/70 text-amber-200'}`}
              title={hasMixedScope ? `Slayer ${m.slayer} requirement` : visibleState === 'available' ? 'Slayer requirement met' : isRequirementNeutral ? 'Access requirements need evaluation' : met ? 'Chunk locked' : `Needs Slayer ${m.slayer} \u2014 you have ${slayerUnlocked ? slayerLevel : 'the skill locked'}`}
            >
              {visibleState === 'mixed' || (isRequirementNeutral && met) ? `Slay ${m.slayer}` : visibleState === 'available' ? <><Check size={9} aria-hidden="true" />Slay {m.slayer}</> : met ? 'Locked' : `Needs Slay ${m.slayer}`}
            </span>
          )}
          {m.slayer == null && reqs.length === 0 && visibleState === 'locked' && (
            <span className="rounded bg-red-950/70 px-1 text-[9px] font-bold text-red-300" title="Chunk locked">Locked</span>
          )}
          {m.slayer == null && reqs.length === 0 && visibleState === 'available' && (
            <span className="rounded bg-green-900/60 px-1 text-[9px] font-bold text-green-300">Available</span>
          )}

        </span>
      </div>
    );
  }) ?? [];
  const farmingRows = derived?.farming.map(f => {
    const visibleState = resolveChunkInfoItemState(f.usable, scope);
    return (
      <div key={f.name} className="flex items-center justify-between gap-2 py-px" title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? `${f.patch} patches unlocked` : f.usable ? 'Chunk locked' : `Needs the "${f.patch}" unlock in the Farming table`}>
        <span className={`truncate ${rowStateCls(visibleState)}`}>
          <WikiLink name={f.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">{'\u00d7'}{f.count}</span>
        </span>
        <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${visibleState === 'mixed' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>{visibleState === 'mixed' ? f.patch : visibleState === 'available' ? 'Available' : f.usable ? 'Locked' : `Needs ${f.patch}`}</span>
      </div>
    );
  }) ?? [];
  const resourceRows = derived?.resources.map(r => {
    const yields = nodeYields(r.skill, r.name);
    const isOpen = openResource === r.name;
    const visibleState = resolveChunkInfoItemState(r.usable, scope);
    return (
      <div key={r.name}>
        <div className="flex items-center justify-between gap-2 py-px"
          title={visibleState === 'mixed'
            ? 'Availability varies across this area'
            : visibleState === 'available'
              ? `${r.skill} ${r.level} \u2014 you can gather this`
              : r.usable
                ? 'Chunk locked'
                : (unlocks.skills?.[r.skill] ?? 0) > 0
                  ? `Needs ${r.skill} ${r.level} \u2014 you have ${unlocks.levels?.[r.skill] ?? 1}`
                  : `${r.skill} skill not unlocked yet (needs level ${r.level})`}>
          <span className={`flex items-center gap-1 min-w-0 ${rowStateCls(visibleState)}`}>
            {yields && yields.length > 0 && (
              <button type="button" onClick={() => setOpenResource(isOpen ? null : r.name)} className="shrink-0 rounded text-gray-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none" title="Show what this yields" aria-expanded={isOpen}>
                {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
            <span className="truncate">
              <WikiLink name={r.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">{'\u00d7'}{r.count}</span>
            </span>
          </span>
          <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${visibleState === 'mixed' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
            {visibleState === 'mixed' ? `${r.skill.slice(0, 4)} ${r.level}` : visibleState === 'available' ? 'Available' : r.usable ? 'Locked' : `Needs ${r.skill.slice(0, 4)} ${r.level}`}
          </span>
        </div>
        {isOpen && yields && (
          <div className="ml-4 mb-1 flex flex-wrap gap-1">
            {yields.map(([item, rate]) => (
              <span key={item} className="text-[9px] px-1 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 flex items-center gap-1">
                <WikiLink name={item} className="hover:text-white" />
                <span className="text-gray-600 font-mono">{rate}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }) ?? [];
  const shopRows = derived?.shops.map(s => {
    const stock = chunkContentService.shopStock(s.name);
    const isOpen = openShop === s.name;
    const visibleState = s.category ? resolveChunkInfoItemState(s.usable, scope) : hasMixedScope ? 'mixed' : 'neutral';
    return (
      <div key={s.name}>
        <div className="flex items-center justify-between gap-2 py-px"
          title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? s.category ? `${s.category} unlocked` : 'Available' : s.usable ? 'Chunk locked' : s.category ? `Needs the "${s.category}" merchant unlock` : 'Unclassified shop \u2014 no merchant category gate'}>
          <span className="flex min-w-0 items-center gap-1">
            {stock.length > 0 && (
              <button type="button" onClick={() => setOpenShop(isOpen ? null : s.name)} className="shrink-0 rounded text-gray-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none" title="Show stock" aria-expanded={isOpen}>
                {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
            <WikiLink name={s.name} className={`truncate hover:underline decoration-dotted underline-offset-2 ${rowStateCls(visibleState)}`} />
          </span>
          <span className={`shrink-0 rounded px-1 text-[9px] ${visibleState === 'mixed' || visibleState === 'neutral' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
            {!s.category ? visibleState === 'mixed' ? 'Area' : 'No unlock gate' : visibleState === 'mixed' ? s.category.replace(/ Shops?$/, '') : visibleState === 'available' ? 'Unlocked' : s.usable ? 'Locked' : `Needs ${s.category.replace(/ Shops?$/, '')}`}
          </span>
        </div>
        {isOpen && stock.length > 0 && (
          <div className="mb-1 ml-4 flex flex-wrap gap-1">
            {stock.map(it => (
              <WikiLink key={it} name={it} className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px] text-gray-400 hover:border-white/20 hover:text-white" />
            ))}
          </div>
        )}
      </div>
    );
  }) ?? [];
  const transportRows = derived?.transport.map(t => {
    const visibleState = resolveChunkInfoItemState(t.usable, scope);
    return (
      <div key={t.name} className="flex items-center justify-between gap-2 py-px"
        title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? `${t.network} network unlocked` : t.usable ? 'Chunk locked' : `Needs the "${t.network}" mobility unlock`}>
        <span className={`truncate ${rowStateCls(visibleState)}`}>
          <WikiLink name={t.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="no-underline text-gray-600">x{t.count}</span>
        </span>
        <span className={`shrink-0 rounded px-1 text-[9px] font-bold ${visibleState === 'mixed' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
          {visibleState === 'mixed' ? t.network.replace(/s$/, '') : visibleState === 'available' ? 'Available' : t.usable ? 'Locked' : `Needs ${t.network.replace(/s$/, '')}`}
        </span>
      </div>
    );
  }) ?? [];
  const travelLinkGroups = linkGroups.map(g => (
    <div key={g.category} className="mb-1.5 ml-1">
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="text-[10px] font-semibold text-gray-300">{g.category}</span>
        <span className="font-mono text-[9px] text-gray-600">{g.dests.length}</span>
        {!g.networkUnlocked && (
          <span className="rounded border border-amber-700/40 bg-amber-950/60 px-1 text-[8px] text-amber-300/90" title={`Needs the "${g.category}" mobility unlock`}>network locked</span>
        )}
      </div>
      <div className="ml-1 flex flex-wrap gap-1">
        {g.dests.slice(0, linksCap[g.category] ?? 8).map(d => {
          const usable = d.unlocked && g.networkUnlocked;
          const visibleState = resolveChunkInfoItemState(usable, scope);
          const title = hasMixedScope && g.networkUnlocked
            ? 'Availability varies across this area'
            : visibleState === 'available' ? 'Reachable \u2014 click to view' : usable ? 'Chunk locked' : !d.unlocked ? 'Area locked' : `Needs the "${g.category}" network`;
          const classes = visibleState === 'mixed'
            ? 'border-white/10 bg-white/5 text-gray-300'
            : visibleState === 'available' ? 'border-emerald-600/30 bg-emerald-900/20 text-emerald-200'
              : 'border-red-700/30 bg-red-950/30 text-gray-400';
          return (
            <button
              type="button"
              key={d.label}
              onClick={() => showChunkOnMap(d.cx, d.cy)}
              title={title}
              className={`inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] transition-colors hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none ${classes}`}
            >
              {visibleState === 'available' && <Check size={9} aria-hidden="true" />}
              {visibleState === 'locked' && <Lock size={9} aria-hidden="true" />}
              {d.label}
            </button>
          );
        })}
        {g.dests.length > (linksCap[g.category] ?? 8) && (
          <button type="button" onClick={() => setLinksCap(c => ({ ...c, [g.category]: g.dests.length }))} className="rounded px-1 py-0.5 text-[9px] text-cyan-400 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none">
            +{g.dests.length - (linksCap[g.category] ?? 8)} more
          </button>
        )}
      </div>
    </div>
  ));
  const guildRows = derived?.guilds.length ? (
    <>
      <SectionHead icon={<Flag size={11} />} label="Guilds" count={derived.guilds.length} />
      {derived.guilds.map(g => {
        const visibleState = resolveChunkInfoItemState(g.usable, scope);
        return (
          <div key={g.name} className="flex items-center gap-1.5 py-px" title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? 'Guild unlocked' : g.usable ? 'Chunk locked' : 'Needs the Guilds-table unlock'}>
            {visibleState === 'available' ? <Check size={10} className="shrink-0 text-green-400" /> : visibleState === 'locked' ? <Lock size={10} className="shrink-0 text-red-400/70" /> : <span className="w-[10px] shrink-0 text-center text-gray-600">{'\u00b7'}</span>}
            <WikiLink name={g.name} className={`hover:underline decoration-dotted underline-offset-2 ${rowStateCls(visibleState)}`} />
          </div>
        );
      })}
    </>
  ) : null;
  const minigameRows = derived?.minigames.length ? (
    <>
      <SectionHead icon={<Gamepad2 size={11} />} label="Minigames" count={derived.minigames.length} />
      {derived.minigames.map(mg => {
        const visibleState = resolveChunkInfoItemState(mg.usable, scope);
        return (
          <div key={mg.name} className="flex items-center gap-1.5 py-px" title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? 'Minigame unlocked' : mg.usable ? 'Chunk locked' : 'Needs the Minigames-table unlock'}>
            {visibleState === 'available' ? <Check size={10} className="shrink-0 text-green-400" /> : visibleState === 'locked' ? <Lock size={10} className="shrink-0 text-red-400/70" /> : <span className="w-[10px] shrink-0 text-center text-gray-600">{'\u00b7'}</span>}
            <WikiLink name={mg.name} className={`hover:underline decoration-dotted underline-offset-2 ${rowStateCls(visibleState)}`} />
          </div>
        );
      })}
    </>
  ) : null;
  const diaryRows = derived?.diaries.length ? (
    <>
      <SectionHead icon={<BookOpen size={11} />} label="Diary tasks here" count={derived.diaries.length} />
      {derived.diaries.map(d => {
        const visibleState = resolveChunkInfoItemState(d.reachable, scope);
        return (
          <div key={d.area} className="flex items-center justify-between gap-2 py-px"
            title={hasMixedScope ? 'Availability varies across this area' : visibleState === 'available' ? `${d.region ?? d.area} is unlocked \u2014 these tasks are reachable` : d.reachable ? 'Chunk locked' : `Locked: the ${d.region} region isn't unlocked yet`}>
            <span className={`truncate ${rowStateCls(visibleState)}`}>
              <WikiLink name={`${d.area} Diary`} className="hover:underline decoration-dotted underline-offset-2">{d.area}</WikiLink> <span className="no-underline text-gray-600">({d.refs})</span>
            </span>
            {d.region && (
              <span className={`shrink-0 rounded px-1 text-[9px] ${visibleState === 'mixed' ? 'bg-white/5 text-gray-300' : visibleState === 'available' ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
                {visibleState === 'mixed' ? 'Area' : visibleState === 'available' ? 'Reachable' : 'Locked'}
              </span>
            )}
          </div>
        );
      })}
    </>
  ) : null;
  const objectRows = derived?.objects.length ? (
    <>
      <SectionHead icon={<Package size={11} />} label="Objects" count={derived.objects.length} />
      <CappedList cap={10} items={derived.objects.map(([name, count]) => (
        <div key={name} className={`truncate py-px ${rowStateCls('neutral')}`}><WikiLink name={name} /> <span className="text-gray-600">x{count}</span></div>
      ))} />
    </>
  ) : null;
  const clueRows = content && Object.keys(content.clues).length ? (
    <>
      <SectionHead icon={<Scroll size={11} />} label="Clue steps" count={Object.keys(content.clues).length} />
      <div className="flex flex-wrap gap-1">
        {Object.entries(content.clues).map(([tier, n]) => (
          <span key={tier} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] capitalize text-gray-300">
            {tier} x{n}
          </span>
        ))}
      </div>
    </>
  ) : null;
  const npcRows = content?.npcs.length ? (
    <>
      <SectionHead icon={<Users size={11} />} label="NPCs" count={content.npcs.length} />
      <CappedList cap={6} items={content.npcs.map(n => (
        <div key={n} className={`truncate py-px ${rowStateCls('neutral')}`}><WikiLink name={n} /></div>
      ))} />
    </>
  ) : null;
  const spawnRows = content?.spawns.length ? (
    <>
      <SectionHead icon={<Package size={11} />} label="Item spawns" count={content.spawns.length} />
      <CappedList cap={6} items={content.spawns.map(s => (
        <div key={s} className={`truncate py-px ${rowStateCls('neutral')}`}><WikiLink name={s} /></div>
      ))} />
    </>
  ) : null;


  return (
    <div className="absolute bottom-3 right-3 top-3 z-30 flex w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-cyan-900/50 bg-[#16191b]/95 shadow-2xl backdrop-blur-sm">
      <ChunkInfoHeader
        title={title}
        meta={mode === 'region'
          ? `${regionChunks.length} chunks`
          : <>chunk ({chunk.cx}, {chunk.cy}){subArea && <> {" \u00B7 "}<span className="font-semibold text-cyan-300/90">{displayAreaName(subArea)}</span></>}{region && <> {" \u00B7 "}{region}</>}</>}
        unlocked={unlocked}
        showModeSwitch={Boolean(region)}
        mode={mode}
        onModeChange={setMode}
        onClose={onClose}
      />
      {/* Body */}
      <div ref={scrollBodyRef} className="min-w-0 flex-1 overflow-y-auto px-3 pb-3 text-[11px] custom-scrollbar" data-testid="chunk-info-scroll-body">
        {failed ? (
          <ChunkInfoBodyState kind="error" onRetry={() => setLoadAttempt(attempt => attempt + 1)} />
        ) : !chunkContentService.ready ? (
          <ChunkInfoBodyState kind="loading" />
        ) : (
          <>
            {!emptyContentState && <ChunkInfoSummary summary={drawerSummary} />}
            {mode === 'chunk' && (
              <ChunkInfoAccessCard previewLocked={!unlocked} entryRequirements={entryRequirements} entrances={entrances} chunkUnlocked={unlocked} bankState={bankState} />
            )}
            {emptyContentState
              ? <ChunkInfoBodyState kind="empty" />
              : detailedContent && (
                <>
            <>
            {questRows.length > 0 && (
              <ChunkInfoSection
                key={`${panelResetKey}:quests`}
                id="quests"
                label="Quests"
                icon={<Sparkles size={11} />}
                summary={formatChunkInfoSectionSummary(sectionStats.quests!, scope)}
                defaultOpen={defaultSection === 'quests'}
              >
                <CappedList cap={8} items={questRows.map(row => {
                  const presentation = chunkQuestPresentation(row);
                  const visibleState = row.status === 'COMPLETED'
                    ? 'completed'
                    : chunkQuestOverviewItem(row, true)?.can
                      ? resolveChunkInfoItemState(true, scope)
                      : row.status ? resolveChunkInfoItemState(false, scope) : 'neutral';
                  const { name, kind, status } = row;
                  return (
                    <div key={name} className="flex items-center gap-1.5 py-0.5" title={hasMixedScope && presentation.kind === 'available' ? 'Availability varies across this area' : presentation.title}>
                      {presentation.kind === 'completed' ? <Check size={11} className="shrink-0 text-emerald-400" />
                        : presentation.kind === 'confirmation' ? <Compass size={11} className="shrink-0 text-fuchsia-300" />
                        : visibleState === 'locked' ? <Lock size={10} className="shrink-0 text-rose-300" />
                        : visibleState === 'available' ? <Check size={10} className="shrink-0 text-emerald-300" />
                        : <span className="w-[11px] shrink-0 text-center text-gray-600">{'\u00b7'}</span>}
                      <WikiLink name={name} className={`min-w-0 flex-1 truncate hover:underline decoration-dotted underline-offset-2 ${rowStateCls(visibleState)}`} />
                      {kind === 'first' && <span className="shrink-0 rounded bg-cyan-900/60 px-1 text-[9px] text-cyan-300">starts here</span>}
                      {presentation.kind === 'confirmation' && <span className="shrink-0 rounded bg-fuchsia-950/60 px-1 text-[9px] text-fuchsia-200">Confirm</span>}
                      {status === null && <span className="shrink-0 text-[9px] text-gray-600">untracked</span>}
                    </div>
                  );
                })} />
              </ChunkInfoSection>
            )}
            {(derived.bosses.length > 0 || derived.monsters.length > 0) && (
              <ChunkInfoSection
                key={`${panelResetKey}:combat`}
                id="combat"
                label="Combat"
                icon={<Swords size={11} />}
                summary={formatChunkInfoSectionSummary(sectionStats.combat!, scope)}
                defaultOpen={defaultSection === 'combat'}
              >
                {derived.bosses.length > 0 && <><SectionHead icon={<Skull size={11} />} label="Bosses" count={derived.bosses.length} />{bossRows}</>}
                {derived.monsters.length > 0 && <><SectionHead icon={<Swords size={11} />} label="Monsters" count={derived.monsters.length} /><CappedList cap={8} items={monsterRows} /></>}
              </ChunkInfoSection>
            )}
            {(derived.farming.length > 0 || derived.resources.length > 0) && (
              <ChunkInfoSection
                key={`${panelResetKey}:gathering`}
                id="gathering"
                label="Gathering"
                icon={<Pickaxe size={11} />}
                summary={formatChunkInfoSectionSummary(sectionStats.gathering!, scope)}
                defaultOpen={defaultSection === 'gathering'}
              >
                {derived.farming.length > 0 && <><SectionHead icon={<Sprout size={11} />} label="Farming" count={derived.farming.length} />{farmingRows}</>}
                {derived.resources.length > 0 && <><SectionHead icon={<Pickaxe size={11} />} label="Resources" count={derived.resources.length} /><CappedList cap={10} items={resourceRows} /></>}
              </ChunkInfoSection>
            )}

            </>
            {derived.shops.length > 0 && (
              <ChunkInfoSection
                key={`${panelResetKey}:shops`}
                id="shops"
                label="Shops"
                icon={<Store size={11} />}
                summary={formatChunkInfoSectionSummary(sectionStats.shops!, scope)}
                defaultOpen={defaultSection === 'shops'}
              >
                {shopRows}
              </ChunkInfoSection>
            )}
            {(derived.transport.length > 0 || totalLinks > 0) && (
              <ChunkInfoSection
                key={`${panelResetKey}:travel`}
                id="travel"
                label="Travel"
                icon={<Route size={11} />}
                summary={formatChunkInfoSectionSummary(sectionStats.travel!, scope)}
                defaultOpen={defaultSection === 'travel'}
              >
                {derived.transport.length > 0 && <><SectionHead icon={<Route size={11} />} label="Transport nodes" count={derived.transport.length} />{transportRows}</>}
                {totalLinks > 0 && <><SectionHead icon={<Compass size={11} />} label="Destinations" count={totalLinks} />{travelLinkGroups}</>}
              </ChunkInfoSection>
            )}
            {(sectionStats.other?.total ?? 0) > 0 && (
              <ChunkInfoSection
                key={`${panelResetKey}:other`}
                id="other"
                label="Other"
                icon={<Package size={11} />}
                summary={formatChunkInfoSectionSummary(sectionStats.other!, scope)}
                defaultOpen={defaultSection === 'other'}
              >
                {guildRows}
                {minigameRows}
                {diaryRows}
                {objectRows}
                {clueRows}
                {npcRows}
                {spawnRows}
              </ChunkInfoSection>
            )}
                </>
              )}
          </>
        )}
      </div>
    </div>
  );
};
