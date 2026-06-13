import React, { useEffect, useMemo, useState } from 'react';
import { X, Lock, Check, Swords, Store, Users, Scroll, Package, BookOpen, MapPin, Sparkles, Sprout, Flag, Gamepad2, Pickaxe, Skull, Route, ChevronDown, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { chunkContentService, ChunkContent } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { getQuestStatus, QuestStatus } from '../utils/journalStatus';
import { classifyShop } from '../utils/merchantShops';
import { resourceReqFor, resourceUsable } from '../utils/chunkResources';
import { mobilityFor } from '../utils/chunkMobility';
import { FARMING_PATCH_LIST, GUILDS_LIST, MINIGAMES_LIST, MOBILITY_LIST, BOSSES_LIST, MISTHALIN_AREAS } from '../constants';
import type { ChunkCoord } from '../utils/mapCoords';
import { WikiLink } from './WikiLink';

// Boss name → set for O(1) lookup; diary area → home region for the diary gate.
const BOSS_SET = new Set(BOSSES_LIST.map(b => b.toLowerCase()));
const DIARY_AREA_REGION: Record<string, string> = {};
for (const d of Object.values(DIARY_DATA)) {
  const area = d.id.replace(/ (Easy|Medium|Hard|Elite)$/, '');
  DIARY_AREA_REGION[area] = d.region;
}

/**
 * "What can I play here?" — the OneChunkMan-style content readout for a
 * clicked map chunk, or aggregated across its whole region (since this mode
 * unlocks areas, not single chunks). Every activity is checked against the
 * run's actual unlocks — quests via getQuestStatus, monsters via Slayer,
 * shops via their merchant category, farming patches / guilds / minigames
 * via their own unlock tables — and rendered green (usable) or red with a
 * strike-through (locked). A collapsible Can-do / Locked overview tops the
 * panel. Content data: ChunkContentService (credit: source-chunk/chunk-picker-v2).
 */

interface Props {
  chunk: ChunkCoord;
  region: string | null;
  /** Named sub-area this chunk belongs to (e.g. 'Falador'), when known. */
  subArea?: string | null;
  regionChunks: ChunkCoord[];
  unlocked: boolean;
  onClose: () => void;
}

const QUEST_BADGE: Record<QuestStatus, { cls: string; label: string }> = {
  COMPLETED: { cls: 'text-green-400', label: 'completed' },
  AVAILABLE: { cls: 'text-amber-300', label: 'requirements met — can do now' },
  LOCKED_REGION: { cls: 'text-gray-500', label: 'locked: region not unlocked' },
  LOCKED_SKILL: { cls: 'text-gray-500', label: 'locked: skill requirements not met' },
  LOCKED_QUEST: { cls: 'text-gray-500', label: 'locked: prerequisite quest missing' },
};

/** Green when usable, red + strike-through when locked. */
const stateCls = (usable: boolean) =>
  usable ? 'text-green-300' : 'text-red-400/80 line-through decoration-red-500/60';

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
          onClick={() => setExpanded(e => !e)}
          className="text-[10px] text-cyan-400/80 hover:text-cyan-300 mt-0.5"
        >
          {expanded ? 'show less' : `+${items.length - cap} more`}
        </button>
      )}
    </>
  );
};

/** Collapsible overview block: header with count, comma-list body. */
const Overview: React.FC<{ kind: 'can' | 'cant'; items: string[] }> = ({ kind, items }) => {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const can = kind === 'can';
  return (
    <div className={`mt-2 rounded border ${can ? 'border-emerald-700/40 bg-emerald-950/30' : 'border-red-800/40 bg-red-950/20'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
      >
        {open ? <ChevronDown size={11} className="text-gray-500 shrink-0" /> : <ChevronRight size={11} className="text-gray-500 shrink-0" />}
        {can ? <Check size={11} className="text-green-400 shrink-0" /> : <Lock size={11} className="text-red-400/80 shrink-0" />}
        <span className={`text-[10px] font-bold uppercase tracking-wide ${can ? 'text-emerald-300' : 'text-red-300/90'}`}>
          {can ? 'Can do here' : 'Locked for now'}
        </span>
        <span className="text-[10px] font-mono text-gray-500">({items.length})</span>
      </button>
      {open && (
        <div className={`px-2 pb-2 text-[10px] leading-relaxed ${can ? 'text-emerald-200/90' : 'text-red-200/70'}`}>
          {items.join(' · ')}
        </div>
      )}
    </div>
  );
};

export const ChunkActivityPanel: React.FC<Props> = ({ chunk, region, subArea, regionChunks, unlocked, onClose }) => {
  const { unlocks } = useGame();
  const [mode, setMode] = useState<'chunk' | 'region'>('chunk');
  const [, setLoadedTick] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    chunkContentService.init().then(ok => (ok ? setLoadedTick(t => t + 1) : setFailed(true)));
  }, []);

  const content: ChunkContent | null = useMemo(() => {
    if (!chunkContentService.ready) return null;
    if (mode === 'region' && region) return chunkContentService.aggregate(regionChunks);
    return chunkContentService.contentFor(chunk.cx, chunk.cy);
  }, [mode, region, regionChunks, chunk, chunkContentService.ready]);

  const slayerLevel = unlocks.levels['Slayer'] ?? 1;
  const slayerUnlocked = (unlocks.skills?.['Slayer'] ?? 0) > 0;

  const questRows = useMemo(() => {
    if (!content) return [];
    return Object.entries(content.quests)
      .map(([name, kind]) => {
        const data = QUEST_DATA[name];
        const status = data ? getQuestStatus(data, unlocks) : null;
        return { name, kind, status };
      })
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'first' ? -1 : 1));
  }, [content, unlocks]);

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
      const reachable = !region || region === 'Misthalin' || MISTHALIN_AREAS.includes(region) || unlocks.regions.includes(region);
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
  }, [content, subArea, unlocks]);

  // ── Can-do / Locked overview ───────────────────────────────────────────────
  const overview = useMemo(() => {
    if (!content || !derived) return { can: [] as string[], cant: [] as string[] };
    const can: string[] = [];
    const cant: string[] = [];
    const push = (ok: boolean, label: string) => (ok ? can : cant).push(label);

    for (const q of questRows) {
      if (q.status === 'COMPLETED') continue;
      if (q.status === 'AVAILABLE') push(unlocked, `Quest: ${q.name}`);
      else if (q.status) cant.push(`Quest: ${q.name}`);
    }
    for (const b of derived.bosses) push(unlocked && b.usable, `Boss: ${b.name}`);
    for (const m of derived.monsters.slice(0, 12)) {
      const met = m.slayer == null || (slayerUnlocked && slayerLevel >= m.slayer);
      push(unlocked && met, `Kill ${m.name}`);
    }
    for (const s of derived.shops) push(unlocked && s.usable, `Shop: ${s.name}`);
    for (const t of derived.transport) push(unlocked && t.usable, `Travel: ${t.name}`);
    for (const f of derived.farming) push(unlocked && f.usable, `Farm: ${f.name}`);
    for (const r of derived.resources) push(unlocked && r.usable, `Gather: ${r.name}`);
    for (const g of derived.guilds) push(unlocked && g.usable, g.name);
    for (const mg of derived.minigames) push(unlocked && mg.usable, mg.name);
    return { can, cant };
  }, [content, derived, questRows, unlocked, slayerLevel, slayerUnlocked]);

  const title = mode === 'region' && region
    ? region
    : content?.name ?? `Chunk ${chunk.cx}, ${chunk.cy}`;

  return (
    <div className="absolute top-3 right-3 bottom-3 w-72 z-30 bg-[#161616]/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-white/10 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-white leading-tight truncate">{title}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500">
              <MapPin size={10} />
              {mode === 'region'
                ? `${regionChunks.length} chunks`
                : <>chunk ({chunk.cx}, {chunk.cy}){subArea && <> · <span className="text-cyan-300/90 font-semibold">{subArea}</span></>}{region && <> · {region}</>}</>}
              <span className={`px-1.5 py-px rounded font-bold ${unlocked ? 'bg-green-900/60 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {unlocked ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0" aria-label="Close chunk info">
            <X size={15} />
          </button>
        </div>
        {region && (
          <div className="flex mt-2 bg-black/40 rounded-lg p-0.5 gap-0.5">
            {(['chunk', 'region'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${mode === m ? 'bg-cyan-900/70 text-cyan-200' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {m === 'chunk' ? 'This chunk' : 'Whole area'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 text-[11px] ${unlocked ? '' : 'opacity-75'}`}>
        {!unlocked && (
          <div className="mt-2 px-2 py-1.5 rounded bg-amber-950/50 border border-amber-700/40 text-amber-300/90 text-[10px]">
            <Lock size={10} className="inline mr-1 -mt-px" />
            This area is still locked — a preview of what fate could grant.
          </div>
        )}

        {/* Brief can / can't overview — collapsed by default. */}
        <Overview kind="can" items={overview.can} />
        <Overview kind="cant" items={overview.cant} />

        {failed && <div className="mt-3 text-gray-500">Chunk content unavailable (failed to load).</div>}
        {!failed && !content && <div className="mt-3 text-gray-500 animate-pulse">Loading chunk content…</div>}
        {content && derived && (
          <>
            {questRows.length > 0 && (
              <>
                <SectionHead icon={<Sparkles size={11} />} label="Quests" count={questRows.length} />
                <CappedList cap={8} items={questRows.map(({ name, kind, status }) => (
                  <div key={name} className="flex items-center gap-1.5 py-px" title={status ? QUEST_BADGE[status].label : 'miniquest / not tracked'}>
                    {status === 'COMPLETED' ? <Check size={11} className="text-green-400 shrink-0" />
                      : status === 'AVAILABLE' ? <span className="w-[11px] text-center text-amber-300 shrink-0">●</span>
                      : status ? <Lock size={10} className="text-gray-600 shrink-0" />
                      : <span className="w-[11px] text-center text-gray-600 shrink-0">·</span>}
                    <WikiLink name={name} className={`truncate hover:underline decoration-dotted underline-offset-2 ${status ? QUEST_BADGE[status].cls : 'text-gray-400'}`} />
                    {kind === 'first' && <span className="text-[9px] px-1 rounded bg-cyan-900/60 text-cyan-300 shrink-0">starts here</span>}
                  </div>
                ))} />
              </>
            )}

            {derived.bosses.length > 0 && (
              <>
                <SectionHead icon={<Skull size={11} />} label="Bosses" count={derived.bosses.length} />
                {derived.bosses.map(b => (
                  <div key={b.name} className="flex items-center justify-between gap-2 py-px"
                    title={b.usable ? `${b.name} unlocked` : `Needs the "${b.name}" boss unlock`}>
                    <span className={`truncate ${stateCls(b.usable)}`}>
                      <WikiLink name={b.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">×{b.count}</span>
                    </span>
                    <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${b.usable ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
                      {b.usable ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                ))}
              </>
            )}

            {derived.monsters.length > 0 && (
              <>
                <SectionHead icon={<Swords size={11} />} label="Monsters" count={derived.monsters.length} />
                <CappedList cap={8} items={derived.monsters.map(m => {
                  const met = m.slayer == null || (slayerUnlocked && slayerLevel >= m.slayer);
                  return (
                    <div key={m.name} className="flex items-center justify-between gap-2 py-px">
                      <span className={`truncate ${stateCls(met)}`}>
                        <WikiLink name={m.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">×{m.count}</span>
                      </span>
                      {m.slayer != null && (
                        <span
                          className={`text-[9px] px-1 rounded shrink-0 font-bold ${met ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}
                          title={met ? 'Slayer requirement met' : `Needs Slayer ${m.slayer} — you have ${slayerUnlocked ? slayerLevel : 'the skill locked'}`}
                        >
                          Slay {m.slayer}
                        </span>
                      )}
                    </div>
                  );
                })} />
              </>
            )}

            {derived.farming.length > 0 && (
              <>
                <SectionHead icon={<Sprout size={11} />} label="Farming" count={derived.farming.length} />
                {derived.farming.map(f => (
                  <div key={f.name} className="flex items-center justify-between gap-2 py-px" title={f.usable ? `${f.patch} patches unlocked` : `Needs the "${f.patch}" unlock in the Farming table`}>
                    <span className={`truncate ${stateCls(f.usable)}`}>
                      <WikiLink name={f.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">×{f.count}</span>
                    </span>
                    <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${f.usable ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>{f.patch}</span>
                  </div>
                ))}
              </>
            )}

            {derived.transport.length > 0 && (
              <>
                <SectionHead icon={<Route size={11} />} label="Transport" count={derived.transport.length} />
                {derived.transport.map(t => (
                  <div key={t.name} className="flex items-center justify-between gap-2 py-px"
                    title={t.usable ? `${t.network} network unlocked` : `Needs the "${t.network}" mobility unlock`}>
                    <span className={`truncate ${stateCls(t.usable)}`}>
                      <WikiLink name={t.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">×{t.count}</span>
                    </span>
                    <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${t.usable ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
                      {t.network.replace(/s$/, '')}
                    </span>
                  </div>
                ))}
              </>
            )}

            {derived.guilds.length > 0 && (
              <>
                <SectionHead icon={<Flag size={11} />} label="Guilds" count={derived.guilds.length} />
                {derived.guilds.map(g => (
                  <div key={g.name} className="flex items-center gap-1.5 py-px" title={g.usable ? 'Guild unlocked' : 'Needs the Guilds-table unlock'}>
                    {g.usable ? <Check size={10} className="text-green-400 shrink-0" /> : <Lock size={10} className="text-red-400/70 shrink-0" />}
                    <WikiLink name={g.name} className={`hover:underline decoration-dotted underline-offset-2 ${stateCls(g.usable)}`} />
                  </div>
                ))}
              </>
            )}

            {derived.minigames.length > 0 && (
              <>
                <SectionHead icon={<Gamepad2 size={11} />} label="Minigames" count={derived.minigames.length} />
                {derived.minigames.map(mg => (
                  <div key={mg.name} className="flex items-center gap-1.5 py-px" title={mg.usable ? 'Minigame unlocked' : 'Needs the Minigames-table unlock'}>
                    {mg.usable ? <Check size={10} className="text-green-400 shrink-0" /> : <Lock size={10} className="text-red-400/70 shrink-0" />}
                    <WikiLink name={mg.name} className={`hover:underline decoration-dotted underline-offset-2 ${stateCls(mg.usable)}`} />
                  </div>
                ))}
              </>
            )}

            {derived.shops.length > 0 && (
              <>
                <SectionHead icon={<Store size={11} />} label="Shops" count={derived.shops.length} />
                {derived.shops.map(s => (
                  <div key={s.name} className="flex items-center justify-between gap-2 py-px"
                    title={s.usable ? `${s.category} unlocked` : s.category ? `Needs the "${s.category}" merchant unlock` : 'Unclassified shop — no merchant category gate'}>
                    <WikiLink name={s.name} className={`truncate hover:underline decoration-dotted underline-offset-2 ${s.category ? stateCls(s.usable) : 'text-gray-300'}`} />
                    {s.category && (
                      <span className={`text-[9px] px-1 rounded shrink-0 ${s.usable ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
                        {s.category.replace(/ Shops?$/, '')}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            {derived.resources.length > 0 && (
              <>
                <SectionHead icon={<Pickaxe size={11} />} label="Resources" count={derived.resources.length} />
                <CappedList cap={10} items={derived.resources.map(r => (
                  <div key={r.name} className="flex items-center justify-between gap-2 py-px"
                    title={r.usable
                      ? `${r.skill} ${r.level} — you can gather this`
                      : (unlocks.skills?.[r.skill] ?? 0) > 0
                        ? `Needs ${r.skill} ${r.level} — you have ${unlocks.levels?.[r.skill] ?? 1}`
                        : `${r.skill} skill not unlocked yet (needs level ${r.level})`}>
                    <span className={`truncate ${stateCls(r.usable)}`}>
                      <WikiLink name={r.name} className="hover:underline decoration-dotted underline-offset-2" /> <span className="text-gray-600 no-underline">×{r.count}</span>
                    </span>
                    <span className={`text-[9px] px-1 rounded shrink-0 font-bold ${r.usable ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
                      {r.skill.slice(0, 4)} {r.level}
                    </span>
                  </div>
                ))} />
              </>
            )}

            {derived.objects.length > 0 && (
              <>
                <SectionHead icon={<Package size={11} />} label="Objects" count={derived.objects.length} />
                <CappedList cap={10} items={derived.objects.map(([name, count]) => (
                  <div key={name} className="text-gray-300 py-px truncate"><WikiLink name={name} /> <span className="text-gray-600">×{count}</span></div>
                ))} />
              </>
            )}

            {derived.diaries.length > 0 && (
              <>
                <SectionHead icon={<BookOpen size={11} />} label="Diary tasks here" count={derived.diaries.length} />
                {derived.diaries.map(d => (
                  <div key={d.area} className="flex items-center justify-between gap-2 py-px"
                    title={d.reachable
                      ? `${d.region ?? d.area} is unlocked — these tasks are reachable`
                      : `Locked: the ${d.region} region isn't unlocked yet`}>
                    <span className={`truncate ${stateCls(d.reachable)}`}>
                      <WikiLink name={`${d.area} Diary`} className="hover:underline decoration-dotted underline-offset-2">{d.area}</WikiLink> <span className="text-gray-600 no-underline">({d.refs})</span>
                    </span>
                    {d.region && (
                      <span className={`text-[9px] px-1 rounded shrink-0 ${d.reachable ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}>
                        {d.reachable ? 'Reachable' : 'Locked'}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            {Object.keys(content.clues).length > 0 && (
              <>
                <SectionHead icon={<Scroll size={11} />} label="Clue steps" />
                <div className="flex flex-wrap gap-1">
                  {Object.entries(content.clues).map(([tier, n]) => (
                    <span key={tier} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 capitalize">
                      {tier} ×{n}
                    </span>
                  ))}
                </div>
              </>
            )}

            {content.npcs.length > 0 && (
              <>
                <SectionHead icon={<Users size={11} />} label="NPCs" count={content.npcs.length} />
                <CappedList cap={6} items={content.npcs.map(n => (
                  <div key={n} className="text-gray-400 py-px truncate"><WikiLink name={n} /></div>
                ))} />
              </>
            )}

            {content.spawns.length > 0 && (
              <>
                <SectionHead icon={<Package size={11} />} label="Item spawns" count={content.spawns.length} />
                <CappedList cap={6} items={content.spawns.map(s => (
                  <div key={s} className="text-gray-400 py-px truncate"><WikiLink name={s} /></div>
                ))} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
