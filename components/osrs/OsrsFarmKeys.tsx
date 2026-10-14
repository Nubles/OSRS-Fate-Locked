import React, { useEffect, useMemo, useRef, useState } from 'react';
import './osrs-farm.css';
import { DropSource, type LogEntry } from '../../types';
import { DROP_RATES, BOSSES_LIST } from '../../constants';
import { bossTier, TIER_SOURCE, TIER_LABEL, TIER_ORDER, type BossTier } from '../../data/bossKeyTiers';
import { useGame } from '../../context/GameContext';
import { wikiService } from '../../services/WikiService';
import { LEVEL_ROLL_MAX } from '../../config/economy';
import {
  BRUTUS_BOSS_NAME,
  CLUE_ONBOARDING_MINIMUMS,
  effectiveVanillaClueRate,
  vanillaBossKeyStage,
  type KeyRollContext,
} from '../../config/vanillaKeyEconomy';
import { VANILLA_BOSS_SEARCH_PLACEHOLDER, vanillaBossNote, vanillaBossSearchEmptyMessage } from '../vanillaBossSearchCopy';
import { PETS, unclaimedPets, type Pet } from '../../data/pets';
import { PET_SOURCES, petImageFile } from '../../data/petSources';
import { OPEN_PETS_EVENT } from '../../utils/petFollower';
import { PetPicker } from '../PetPicker';
import { WikiIcon } from '../WikiIcon';
import { isRollEntry } from '../../utils/logEntry';
import { formatKeyPercent, formatKeyRollValue } from '../../utils/keyRoll';
import { useFarmModel } from '../ActionSection';
import { setBossQuery, setFarmTab, useKeysView, type FarmSubTab } from './OsrsKeysState';
import { OsrsKeysTabs } from './OsrsKeysTabs';

/**
 * Farm Keys in the OSRS layout, in two sizes:
 *   compact (home screen Keys panel, Main board): category buttons, then one
 *     list row per source with its rate and a Roll button;
 *   wide (Keys screen, FarmKeys-NPCs board): an NPC card per source topped by
 *     the gem of its odds tier, with the last roll as an NPC dialogue, the odds
 *     ladder and the recent rolls beside it.
 * Every source, rate and roll handler comes from ActionSection's useFarmModel
 * and the same GameContext; this file only draws them.
 */

type RollPoint = { clientX: number; clientY: number };

const UI = `${import.meta.env.BASE_URL}osrs-ui/`;
const KEY_IMG = `${UI}items/key.png`;
const OMNI_IMG = `${UI}items/omni_key.png`;
const BOSS_TASK_IMG = `${UI}items/11864.png`;
const MINIGAME_IMG = `${UI}items/4067.png`;

// ── Gem tiers: the ladder of the design board (opal .. zenyte). A source sits
// on the first gem whose ceiling its rate does not pass. ─────────────────────
const GEMS: readonly { name: string; file: string; color: string; max: number }[] = [
  { name: 'Opal', file: 'opal', color: '#d9cfc0', max: 5 },
  { name: 'Jade', file: 'jade', color: '#6fbf6a', max: 10 },
  { name: 'Red topaz', file: 'red_topaz', color: '#e0703c', max: 20 },
  { name: 'Sapphire', file: 'sapphire', color: '#5a7cf0', max: 25 },
  { name: 'Emerald', file: 'emerald', color: '#2fbf5a', max: 35 },
  { name: 'Ruby', file: 'ruby', color: '#e03535', max: 50 },
  { name: 'Diamond', file: 'diamond', color: '#dcecff', max: 65 },
  { name: 'Dragonstone', file: 'dragonstone', color: '#c060e0', max: 70 },
  { name: 'Onyx', file: 'onyx', color: '#a8a8a8', max: 80 },
  { name: 'Zenyte', file: 'zenyte', color: '#f5a623', max: 100 },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const gemFor = (rate: number) => {
  const i = GEMS.findIndex((g) => rate <= g.max);
  const idx = i < 0 ? GEMS.length - 1 : i;
  return { ...GEMS[idx], idx, src: `${UI}gems/${GEMS[idx].file}.png`, label: `Tier ${ROMAN[idx]}` };
};
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// ── Local sprites. Anything without one keeps the classic wiki image. ──────
const NPC_SPRITES: Record<string, string> = {
  turael: 'turael', spria: 'spria', mazchna: 'mazchna', vannaka: 'vannaka', chaeldar: 'chaeldar',
  konar: 'konar', nieve: 'nieve', krystilia: 'krystilia', duradel: 'duradel',
  'crazy archaeologist': 'crazyarch',
};
// Bodies that have no chathead: the dialogue falls back to the body.
const BODY_ONLY: Record<string, string> = { 'duke sucellus': 'duke', [BRUTUS_BOSS_NAME.toLowerCase()]: 'brutus' };
const isBigBody = (name: string) => Boolean(BODY_ONLY[name.toLowerCase()]);
const npcBody = (name: string): string | null => {
  const k = name.toLowerCase();
  return NPC_SPRITES[k] ? `${UI}npc/${NPC_SPRITES[k]}_body.png` : BODY_ONLY[k] ? `${UI}npc/${BODY_ONLY[k]}_body.png` : null;
};
const npcHead = (name: string): string | null => {
  const k = name.toLowerCase();
  return NPC_SPRITES[k] ? `${UI}npc/${NPC_SPRITES[k]}_chat.png` : BODY_ONLY[k] ? `${UI}npc/${BODY_ONLY[k]}_body.png` : null;
};
// Clue scrolls by tier (item ids of the scrolls themselves).
const CLUE_SCROLL_IDS: Record<string, number> = { Beginner: 23182, Easy: 2677, Medium: 2801, Hard: 2722, Elite: 12073, Master: 19835 };
const clueSprite = (tier: string) => `${UI}items/${CLUE_SCROLL_IDS[tier] ?? 19835}.png`;

// Category button icons, as each board draws them.
const COMPACT_TAB_ICONS: Record<FarmSubTab, string> = {
  SLAYER: `${UI}skills/slayer.png`, CLUES: `${UI}items/19835.png`, BOSSING: `${UI}items/21907.png`, ACTIVITIES: MINIGAME_IMG,
};
const WIDE_TAB_ICONS: Record<FarmSubTab, string> = { ...COMPACT_TAB_ICONS, CLUES: `${UI}items/19835.png` };

const BLURBS: Record<FarmSubTab, string> = {
  SLAYER: 'Finish a task, then roll your master. Harder masters roll better.',
  CLUES: 'Finish a clue, then roll its tier. Harder caskets roll better.',
  BOSSING: 'Roll the boss you killed. Its tier sets the odds.',
  ACTIVITIES: 'Every finished game rolls, with no limit.',
};
const VANILLA_BOSS_BLURB = 'Vanilla: each boss holds a small Key stash. Once it is empty, kills stop rolling.';
const LADDER_TITLES: Record<FarmSubTab, string> = {
  SLAYER: 'Slayer odds by tier', CLUES: 'Clue odds by tier', BOSSING: 'Boss odds, next Key', ACTIVITIES: 'Activity odds',
};
const TABS: { id: FarmSubTab; label: string }[] = [
  { id: 'SLAYER', label: 'Slayer' }, { id: 'CLUES', label: 'Clues' }, { id: 'BOSSING', label: 'Bossing' }, { id: 'ACTIVITIES', label: 'Activities' },
];

// ── Roll suspense: the same 0.6s pause the classic cards make before rolling.
const useRollSuspense = (onRoll: (p: RollPoint) => void) => {
  const [isRolling, setIsRolling] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const trigger = async (e: React.MouseEvent) => {
    if (isRolling) return;
    const point = { clientX: e.clientX, clientY: e.clientY };
    setIsRolling(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (mounted.current) setIsRolling(false);
    onRoll(point);
  };
  return { isRolling, trigger };
};

/** Image fetched from the wiki by page name, as the classic WikiIcon helper does. */
const WikiNamedImg: React.FC<{ name: string; className?: string; style?: React.CSSProperties }> = ({ name, className, style }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    wikiService.fetchImage(name).then((url) => { if (live && url) setSrc(url); });
    return () => { live = false; };
  }, [name]);
  return src ? <img src={src} alt={name} className={className} style={style} /> : null;
};

// ── One source, as a model both sizes draw ────────────────────────────────
type Art =
  | { kind: 'body'; src: string; big?: boolean }
  | { kind: 'item'; src: string }
  | { kind: 'wiki'; src: string }
  | { kind: 'wikiName'; name: string };

/** The small picture on a compact list row: a chathead, an item sprite, or a wiki image by name. */
type Thumb = { src: string; item?: boolean } | { wikiName: string };

interface CardModel {
  id: string;
  name: string;
  sub: string;
  rate: number;
  bonus: number;
  art: Art;
  thumb: Thumb;
  status: { text: string; color: string };
  stats: string;
  extra?: { text: string; color: string };
  stash?: { cap: number; awarded: number };
  disabled?: boolean;
  btn: string;
  examine: string;
  title: string;
  onRoll: (p: RollPoint) => void;
}

const BonusTag: React.FC<{ bonus: number }> = ({ bonus }) =>
  bonus ? <span title="Region passive modifier active" style={{ color: bonus > 0 ? '#00ff00' : '#ff3030', marginLeft: 3 }}>{bonus > 0 ? '+' : '−'}{Math.abs(bonus)}</span> : null;

/** Wide: the NPC card (FarmKeys-NPCs board). */
const NpcCard: React.FC<{ card: CardModel }> = ({ card }) => {
  const { isRolling, trigger } = useRollSuspense(card.onRoll);
  const gem = gemFor(card.rate);
  const live = !card.disabled;
  const stageBg = live
    ? `radial-gradient(ellipse at 50% 92%, ${rgba(gem.color, 0.32)} 0%, ${rgba(gem.color, 0.08)} 45%, rgba(0,0,0,0) 70%), linear-gradient(#2a231b, #1c1712)`
    : 'linear-gradient(#24201a, #171410)';
  const filter = live ? undefined : 'grayscale(.9) brightness(.45)';
  const art = card.art;
  return (
    <div className="okf-card" title={card.title} data-examine={card.examine} data-examine-name={card.name} data-examine-kind="npc"
      style={{ boxShadow: live ? `inset 0 0 0 2px ${gem.color}` : 'inset 0 0 0 2px var(--osrs-inner-ring, #4f4434)' }}>
      <div className="okf-card-head">
        <img className="osrs-px" src={gem.src} alt="" aria-hidden="true" />
        <span className="tier" style={{ color: gem.color }}>{gem.label}</span>
        <span className="rate">{card.rate}%<BonusTag bonus={card.bonus} /></span>
      </div>
      <div className="okf-stage" style={{ background: stageBg }}>
        <div className="shadow" />
        {art.kind === 'body' && <img className={`body${art.big ? ' big' : ''}`} src={art.src} alt={card.name} style={{ filter }} />}
        {art.kind === 'item' && <img className="item osrs-px" src={art.src} alt={card.name} style={{ filter }} />}
        {art.kind === 'wiki' && <img className="body" src={art.src} alt={card.name} style={{ filter, height: '70%' }} />}
        {art.kind === 'wikiName' && <WikiNamedImg name={art.name} className="body" style={{ filter, height: '70%' }} />}
        {card.stash && (
          <div className="okf-stash" aria-label={`${card.stash.awarded} of ${card.stash.cap} Keys paid`}>
            {Array.from({ length: card.stash.cap }, (_, i) => (
              <div key={i} className={`osrs-slot${i < card.stash!.awarded ? ' paid' : ''}`}>
                <img className="osrs-px" src={KEY_IMG} alt="" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="okf-card-foot">
        <span className="name">{card.name}</span>
        <span className="small" style={{ color: 'var(--osrs-tan, #c8b897)' }}>{card.sub}</span>
        <span className="small" style={{ color: card.status.color }}>{card.status.text}</span>
        {card.extra && <span className="small" style={{ color: card.extra.color }}>{card.extra.text}</span>}
        <span className="small" style={{ color: '#ffffff' }}>{card.stats}</span>
        <button type="button" className="osrs-btn" disabled={card.disabled || isRolling} onClick={trigger}>
          {isRolling ? 'Rolling...' : card.btn}
        </button>
      </div>
    </div>
  );
};

const RowThumb: React.FC<{ thumb: Thumb; dim?: boolean }> = ({ thumb, dim }) => (
  <span className={`okf-thumb${dim ? ' is-dim' : ''}`} aria-hidden="true">
    {'wikiName' in thumb
      ? <WikiNamedImg name={thumb.wikiName} />
      : <img className={thumb.item ? 'osrs-px is-item' : undefined} src={thumb.src} alt="" />}
  </span>
);

/** Compact: one list row (Main board), with the source's picture. */
const SourceRow: React.FC<{ card: CardModel }> = ({ card }) => {
  const { isRolling, trigger } = useRollSuspense(card.onRoll);
  return (
    <div className="okf-row has-thumb" title={card.title} data-examine={card.examine} data-examine-name={card.name} data-examine-kind="npc">
      <RowThumb thumb={card.thumb} dim={card.disabled} />
      <div className="who">
        <div className="name">{card.name}</div>
        <div className="where">{card.extra?.text ?? card.sub}</div>
      </div>
      <span className="rate">{card.disabled && card.stash ? 'Spent' : `${card.rate}%`}<BonusTag bonus={card.bonus} /></span>
      <button type="button" className="osrs-btn" disabled={card.disabled || isRolling} onClick={trigger}>{isRolling ? '...' : card.btn}</button>
    </div>
  );
};

/** A row of the long all-boss list outside Vanilla (both sizes). */
const BossRow: React.FC<{ name: string; rate: number; bonus: number; tierLabel: string; onRoll: (p: RollPoint) => void }> = ({ name, rate, bonus, tierLabel, onRoll }) => {
  const { isRolling, trigger } = useRollSuspense(onRoll);
  const head = npcHead(name);
  return (
    <div className="okf-row has-thumb" data-examine={`${tierLabel}-tier boss. ${rate}% chance of a Key per kill.`} data-examine-name={name} data-examine-kind="npc">
      <RowThumb thumb={head ? { src: head } : { wikiName: name }} />
      <div className="who">
        <div className="name">{name}</div>
        <div className="where">{tierLabel}-tier boss</div>
      </div>
      <span className="rate">{rate}%<BonusTag bonus={bonus} /></span>
      <button type="button" className="osrs-btn" disabled={isRolling} onClick={trigger}>{isRolling ? '...' : 'Roll'}</button>
    </div>
  );
};

// ── Odds ladder ───────────────────────────────────────────────────────────
interface LadderRow { label: string; rate: number; live: boolean }
const Ladder: React.FC<{ title: string; rows: LadderRow[] }> = ({ title, rows }) => (
  <div className="osrs-win okf-side">
    <h2 className="okf-wtitle">{title}</h2>
    <div className="osrs-inner okf-ladder">
      {rows.map((r) => {
        const gem = gemFor(r.rate);
        return (
          <div key={`${r.label}-${r.rate}`} className="okf-ladder-row" style={{ opacity: r.live ? 1 : 0.5 }}>
            <img className="osrs-px" src={gem.src} alt={gem.name} />
            <span className="name">{r.label}</span>
            <div className="okf-bar"><div style={{ width: `${Math.min(100, r.rate)}%`, background: gem.color }} /></div>
            <span className="rate">{r.rate}%</span>
          </div>
        );
      })}
    </div>
  </div>
);

const buildLadder = (cards: { label: string; rate: number; live: boolean }[]): LadderRow[] => {
  const byRate = new Map<number, LadderRow & { labels: string[] }>();
  for (const c of cards) {
    const row = byRate.get(c.rate);
    if (row) {
      if (!row.labels.includes(c.label)) row.labels.push(c.label);
      row.live = row.live || c.live;
    } else byRate.set(c.rate, { label: '', rate: c.rate, live: c.live, labels: [c.label] });
  }
  return [...byRate.values()]
    .map((r) => ({ label: r.labels.join(' / '), rate: r.rate, live: r.live }))
    .sort((a, b) => a.rate - b.rate);
};

// ── Pet claim (same flow as PetClaimCard) ─────────────────────────────────
const OsrsPetClaim: React.FC<{ claimed: readonly number[] | undefined; onClaim: (pet: Pet, e: React.MouseEvent) => void; wide?: boolean }> = ({ claimed, onClaim, wide }) => {
  const left = useMemo(() => unclaimedPets(claimed), [claimed]);
  const [chosen, setChosen] = useState('');
  const [confirming, setConfirming] = useState(false);
  const pet = left.find((candidate) => String(candidate.id) === chosen);
  return (
    <div className={wide ? 'okf-card okf-pet wide' : 'okf-pet'}
      data-examine="An Omni-Key for each new pet, once per pet. Not a roll." data-examine-name="New Pet">
      {wide && (
        <div className="okf-card-head">
          <img className="osrs-px" src={OMNI_IMG} alt="" aria-hidden="true" />
          <span className="tier" style={{ color: '#c77dff' }}>New Pet</span>
          <span className="rate">Omni-Key</span>
        </div>
      )}
      <div className="okf-pet-body">
        {!wide && <span className="name">New Pet</span>}
        <span className="small">An Omni-Key for each new pet, once per pet.</span>
        {left.length === 0 ? (
          <span style={{ color: '#ffff00' }}>Every pet is claimed.</span>
        ) : confirming && pet ? (
          <div role="group" aria-label="Check your pet" className="osrs-chat okf-pet-confirm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WikiIcon file={petImageFile(pet)} alt="" size={36} className="shrink-0" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'RSBold, sans-serif', color: '#800000' }}>Claim an Omni-Key for {pet.name}?</div>
                {PET_SOURCES[pet.id] && <div>From {PET_SOURCES[pet.id].source}</div>}
              </div>
            </div>
            <div>Each pet counts once, so check it’s the one you got.</div>
            <button type="button" className="osrs-btn" onClick={(e) => { onClaim(pet, e); setChosen(''); setConfirming(false); }}>
              Yes, I got {pet.name}
            </button>
            <button type="button" className="osrs-btn" onClick={() => setConfirming(false)}>Back</button>
          </div>
        ) : (
          <>
            <PetPicker pets={left} value={pet ? chosen : ''} onChange={setChosen} label="The pet you got" />
            <button type="button" className="osrs-btn" disabled={!pet} onClick={() => { if (pet) setConfirming(true); }}>
              <img className="osrs-px" src={OMNI_IMG} alt="" aria-hidden="true" style={{ width: 22, height: 20 }} />
              Claim Omni-Key
            </button>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
          <span className="small" style={{ color: 'var(--osrs-muted, #8a7c66)' }}>{PETS.length - left.length} of {PETS.length} pets claimed</span>
          {left.length < PETS.length && (
            <button type="button" className="okf-link" onClick={() => window.dispatchEvent(new Event(OPEN_PETS_EVENT))}>Your pets</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Other Key Sources (not on the boards): a small stone button opens them. ─
const OtherSources: React.FC<{ journalMin: number; journalMax: number; statsIcon: string; collLogIcon: string; onClose: () => void; className: string }> = (p) => (
  <div className={`osrs-win okf-other ${p.className}`} role="dialog" aria-label="Other Key Sources">
    <div className="okf-other-head">
      <h2 className="okf-wtitle">Other Key Sources</h2>
      <button type="button" className="osrs-btn okeys-sq" aria-label="Close" onClick={p.onClose}>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
      </button>
    </div>
    <div className="osrs-inner">
      <div className="okf-other-row" data-examine={`Click unlocked skills in the Dashboard to roll. Chance = Level / 5 (up to ${LEVEL_ROLL_MAX.toFixed(1)}%).`} data-examine-name="Skill Rolling">
        <img className="osrs-px" src={p.statsIcon} alt="" aria-hidden="true" />
        <div>
          <div className="label">Skill Rolling</div>
          <div className="desc">Click unlocked skills in the <em>Dashboard</em> to roll.</div>
          <div className="rate">Chance = Level / 5 (up to {LEVEL_ROLL_MAX.toFixed(1)}%)</div>
        </div>
      </div>
      <div className="okf-other-row" data-examine={`Complete Quests, Diaries and CAs in the Journal Tab. Variable (${p.journalMin}% - ${p.journalMax}%).`} data-examine-name="Journal Activities">
        <img src={`${UI}quest_point_icon.png`} alt="" aria-hidden="true" />
        <div>
          <div className="label">Journal Activities</div>
          <div className="desc">Complete Quests, Diaries &amp; CAs in the <em>Journal Tab</em>.</div>
          <div className="rate">Variable ({p.journalMin}% - {p.journalMax}%)</div>
        </div>
      </div>
      <div className="okf-other-row" data-examine={`Log new unique items in the Collection Log Tab to roll. ${DROP_RATES[DropSource.COLLECTION_LOG]}% Drop Chance.`} data-examine-name="Collection Log">
        <img src={p.collLogIcon} alt="" aria-hidden="true" />
        <div>
          <div className="label">Collection Log</div>
          <div className="desc">Log new unique items in the <em>Collection Log Tab</em> to roll.</div>
          <div className="rate">{DROP_RATES[DropSource.COLLECTION_LOG]}% Drop Chance</div>
        </div>
      </div>
    </div>
  </div>
);

// ── Who speaks for a roll ─────────────────────────────────────────────────
interface Speaker { who: string; head: string | null; headIsItem: boolean }
interface PendingRoll extends Speaker { source: string; at: number }

const SOURCE_SPEAKER: Partial<Record<string, Speaker>> = {
  [DropSource.SLAYER_BEGINNER]: { who: 'Turael', head: npcHead('Turael'), headIsItem: false },
  [DropSource.SLAYER_MAZCHNA]: { who: 'Mazchna', head: npcHead('Mazchna'), headIsItem: false },
  [DropSource.SLAYER_VANNAKA]: { who: 'Vannaka', head: npcHead('Vannaka'), headIsItem: false },
  [DropSource.SLAYER_CHAELDAR]: { who: 'Chaeldar', head: npcHead('Chaeldar'), headIsItem: false },
  [DropSource.SLAYER_KONAR]: { who: 'Konar', head: npcHead('Konar'), headIsItem: false },
  [DropSource.SLAYER_NIEVE]: { who: 'Nieve', head: npcHead('Nieve'), headIsItem: false },
  [DropSource.SLAYER_KRYSTILIA]: { who: 'Krystilia', head: npcHead('Krystilia'), headIsItem: false },
  [DropSource.SLAYER_DURADEL]: { who: 'Duradel', head: npcHead('Duradel'), headIsItem: false },
  [DropSource.SLAYER_BOSS]: { who: 'Boss Task', head: BOSS_TASK_IMG, headIsItem: true },
  [DropSource.ACTIVITY_MINIGAME]: { who: 'Minigame', head: MINIGAME_IMG, headIsItem: true },
};
const SLAYER_SOURCES = new Set<string>([
  DropSource.SLAYER_BEGINNER, DropSource.SLAYER_MAZCHNA, DropSource.SLAYER_VANNAKA, DropSource.SLAYER_CHAELDAR, DropSource.SLAYER_KONAR,
  DropSource.SLAYER_NIEVE, DropSource.SLAYER_KRYSTILIA, DropSource.SLAYER_DURADEL, DropSource.SLAYER_BOSS,
]);
const CLUE_SOURCES: [string, DropSource][] = [
  ['Beginner', DropSource.CLUE_BEGINNER], ['Easy', DropSource.CLUE_EASY], ['Medium', DropSource.CLUE_MEDIUM],
  ['Hard', DropSource.CLUE_HARD], ['Elite', DropSource.CLUE_ELITE], ['Master', DropSource.CLUE_MASTER],
];
for (const [tier, source] of CLUE_SOURCES) {
  SOURCE_SPEAKER[source] = { who: `Clue scroll (${tier.toLowerCase()})`, head: clueSprite(tier), headIsItem: true };
}
for (const tier of TIER_ORDER) {
  SOURCE_SPEAKER[TIER_SOURCE[tier]] = { who: `${TIER_LABEL[tier]}-tier boss`, head: KEY_IMG, headIsItem: true };
}
const FARM_SOURCES = new Set(Object.keys(SOURCE_SPEAKER));
const isFarmRoll = (h: LogEntry) => isRollEntry(h) && !!h.source && FARM_SOURCES.has(h.source);

const speakerFor = (entry: LogEntry, pending: PendingRoll | null): Speaker => {
  if (pending && pending.source === entry.source && entry.timestamp >= pending.at) return pending;
  const bossName = entry.meta?.bossName as string | undefined;
  if (bossName) {
    const head = npcHead(bossName);
    return { who: bossName, head: head ?? KEY_IMG, headIsItem: !head };
  }
  return SOURCE_SPEAKER[entry.source ?? ''] ?? { who: entry.source ?? 'Fate', head: KEY_IMG, headIsItem: true };
};

/** What the speaker says about a roll, and what it paid. */
const rollWords = (entry: LogEntry) => {
  const roll = typeof entry.rollValue === 'number' ? entry.rollValue : (entry.meta?.roll as number | undefined);
  const threshold = typeof entry.threshold === 'number' ? entry.threshold : (entry.meta?.threshold as number | undefined);
  const won = entry.result === 'SUCCESS';
  const keys = Number(entry.meta?.standardKeysAwarded ?? 1);
  const fate = Number(entry.meta?.fatePointsEarned ?? 0);
  const omni = entry.type === 'ROLL_OMNI';
  const intro = entry.source && SLAYER_SOURCES.has(entry.source) ? 'Task done. ' : '';
  const rolled = roll !== undefined && threshold !== undefined
    ? `You rolled ${formatKeyRollValue(roll)}, needing ${formatKeyPercent(threshold)} or under. `
    : '';
  const verdict = entry.type === 'PITY'
    ? entry.message
    : won ? (omni ? `Fate smiles on you. ${entry.message}` : 'Fate smiles on you. Take this Key.') : 'No Key this time, but Fate remembers.';
  return { roll, threshold, won, keys, fate, omni, line: `${intro}${rolled}${verdict}` };
};

const DialogueBody: React.FC<{ entry: LogEntry; speaker: Speaker }> = ({ entry, speaker }) => {
  const w = rollWords(entry);
  return (
    <>
      {speaker.head
        ? <img className={`chathead${speaker.headIsItem ? ' item osrs-px' : ''}`} src={speaker.head} alt="" aria-hidden="true" />
        : <span />}
      <span className="text">
        <span className="who">{speaker.who}</span>
        <span className="line">{w.line}</span>
        <span className="cont">Click here to continue</span>
      </span>
      {w.won ? (
        <span className="osrs-slot won" title={w.omni ? 'Key and Omni-Key won' : 'Key won'}>
          <img className="osrs-px" src={w.omni ? OMNI_IMG : KEY_IMG} alt={w.omni ? 'Omni-Key won' : 'Key won'} />
          <span className="osrs-stack" style={{ color: '#00ff00' }}>+{w.omni ? 1 : w.keys}</span>
        </span>
      ) : w.fate > 0 ? <span className="fate">+{w.fate} Fate</span> : null}
    </>
  );
};

const lastFarmRoll = (history: readonly LogEntry[]) => {
  for (let i = history.length - 1; i >= 0; i--) if (isFarmRoll(history[i])) return history[i];
  return null;
};

/** Compact: the last roll made from this panel answers in a dialogue docked at the bottom. */
const DockedDialogue: React.FC<{ history: readonly LogEntry[]; pending: PendingRoll | null }> = ({ history, pending }) => {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const entry = useMemo(() => lastFarmRoll(history), [history]);
  if (!entry || !pending || entry.id === dismissed) return null;
  if (pending.source !== entry.source || entry.timestamp < pending.at) return null;
  const speaker = speakerFor(entry, pending);
  return (
    <div className="okf-dock">
      <button type="button" className="okf-dialogue" onClick={() => setDismissed(entry.id)}
        aria-label={`${speaker.who}: ${rollWords(entry).line} Click here to continue`}>
        <DialogueBody entry={entry} speaker={speaker} />
      </button>
    </div>
  );
};

/** Wide: the "Last roll" window always holds the latest Farm Keys roll. */
const LastRollWindow: React.FC<{ history: readonly LogEntry[]; pending: PendingRoll | null }> = ({ history, pending }) => {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const entry = useMemo(() => lastFarmRoll(history), [history]);
  const shown = entry && entry.id !== dismissed ? entry : null;
  const speaker = shown ? speakerFor(shown, pending) : null;
  return (
    <div className="osrs-win okf-side">
      <h2 className="okf-wtitle">Last roll</h2>
      {shown && speaker ? (
        <button type="button" className="okf-dialogue big" onClick={() => setDismissed(shown.id)}
          aria-label={`${speaker.who}: ${rollWords(shown).line} Click here to continue`}>
          <DialogueBody entry={shown} speaker={speaker} />
        </button>
      ) : (
        <div className="okf-dialogue big empty"><span /><span className="text"><span className="line">No Farm Keys roll to show.</span></span></div>
      )}
    </div>
  );
};

/** Wide: the latest Farm Keys rolls as game messages, newest first. */
const RecentRolls: React.FC<{ history: readonly LogEntry[] }> = ({ history }) => {
  const lines = useMemo(() => {
    const out: LogEntry[] = [];
    for (let i = history.length - 1; i >= 0 && out.length < 40; i--) if (isFarmRoll(history[i])) out.push(history[i]);
    return out;
  }, [history]);
  return (
    <div className="osrs-win okf-side grow">
      <h2 className="okf-wtitle">Recent rolls</h2>
      <div className="okf-recent">
        {lines.length === 0 && <div className="ln">No Farm Keys rolls yet.</div>}
        {lines.map((e) => {
          const w = rollWords(e);
          const who = speakerFor(e, null).who;
          const need = w.threshold !== undefined ? formatKeyPercent(w.threshold) : '';
          const detail = w.roll !== undefined
            ? `Rolled ${formatKeyRollValue(w.roll)}, needed ${need}${w.won ? ' or under.' : `.${w.fate > 0 ? ` +${w.fate} Fate` : ''}`}`
            : e.details ?? '';
          return (
            <div key={e.id} className="ln" title={`${who}: ${e.message} ${detail}`}>
              <span style={{ color: '#0000ff' }}>{who}:</span>{' '}
              <span style={{ color: w.won ? '#005f00' : '#7f0000' }}>{w.won ? 'Key found!' : 'No Key.'}</span> {detail}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── The panel ─────────────────────────────────────────────────────────────
export const OsrsFarmKeys: React.FC<{ wide?: boolean }> = ({ wide = false }) => {
  const { claimPet, petsClaimed, unlocks, bossStandardKeysAwarded, history } = useGame();
  const p = useFarmModel();
  const { farmTab: subTab, bossQuery } = useKeysView();
  const [pending, setPending] = useState<PendingRoll | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const { isVanilla, regionBonus, effectiveRate, handleRoll } = p;

  const roll = (speaker: Speaker, source: string, chance: number, context?: KeyRollContext) => (pt: RollPoint) => {
    setPending({ ...speaker, source, at: Date.now() });
    handleRoll(source, chance, pt, context);
  };

  // Rolls per source from the log, for each card's tally.
  const tally = useMemo(() => {
    const bySource = new Map<string, { rolled: number; keys: number }>();
    for (const h of history) {
      if (!isFarmRoll(h)) continue;
      const won = h.result === 'SUCCESS' ? 1 : 0;
      const s = bySource.get(h.source!) ?? { rolled: 0, keys: 0 };
      bySource.set(h.source!, { rolled: s.rolled + 1, keys: s.keys + won });
    }
    return bySource;
  }, [history]);
  const tallyText = (t: { rolled: number; keys: number } | undefined) =>
    t && t.rolled ? `${t.rolled} rolled · ${t.keys} Key${t.keys === 1 ? '' : 's'}` : '0 rolled';

  const ready = { text: 'Ready to roll', color: '#0dc10d' };

  const slayerCards: CardModel[] = p.slayers.map((m) => {
    const rate = effectiveRate(m.source);
    const isBossTask = m.source === DropSource.SLAYER_BOSS;
    const body = npcBody(m.name);
    const sharer = p.slayers.find((o) => o.source === m.source);
    const shared = sharer && sharer.name !== m.name;
    const head = isBossTask ? BOSS_TASK_IMG : npcHead(m.name);
    return {
      id: m.name,
      name: m.name,
      sub: m.subText,
      rate,
      bonus: regionBonus,
      art: isBossTask ? { kind: 'item', src: BOSS_TASK_IMG } : body ? { kind: 'body', src: body } : { kind: 'wiki', src: m.image },
      thumb: isBossTask ? { src: BOSS_TASK_IMG, item: true } : { src: head ?? m.image },
      status: ready,
      stats: shared ? `Shares ${sharer!.name}’s odds` : tallyText(tally.get(m.source)),
      btn: 'Roll',
      title: `${m.name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% per roll`,
      examine: `${m.subText}. ${rate}% chance of a Key per task.`,
      onRoll: roll({ who: m.name, head: head ?? m.image, headIsItem: isBossTask || !head }, m.source, DROP_RATES[m.source]),
    };
  });

  const clueCards: CardModel[] = p.clues.map((c) => {
    const baseRate = DROP_RATES[c.source];
    const rate = isVanilla ? effectiveVanillaClueRate(baseRate, p.clueKeysAwarded) : effectiveRate(c.source);
    // The subline: the onboarding rate while it applies, else this tier's own
    // tally on the compact list (the wide card already shows it as its stats).
    const onboarding = isVanilla && p.clueKeysAwarded < CLUE_ONBOARDING_MINIMUMS.length && rate > baseRate;
    const extra: CardModel['extra'] = onboarding
      ? { text: `${rate}% for your first Keys (${Math.min(p.clueKeysAwarded, CLUE_ONBOARDING_MINIMUMS.length)} of ${CLUE_ONBOARDING_MINIMUMS.length})`, color: '#00ff00' }
      : wide ? undefined : { text: tallyText(tally.get(c.source)), color: 'var(--osrs-tan, #c8b897)' };
    const name = `${c.tier} clue`;
    const sprite = clueSprite(c.tier);
    return {
      id: c.tier,
      name,
      sub: 'Treasure Trails',
      rate,
      bonus: isVanilla ? 0 : regionBonus,
      art: { kind: 'item', src: sprite },
      thumb: { src: sprite, item: true },
      status: ready,
      extra,
      stats: tallyText(tally.get(c.source)),
      btn: 'Roll',
      title: `${name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% per roll`,
      examine: `Clue scroll (${c.tier.toLowerCase()}). ${rate}% chance of a Key per casket.`,
      onRoll: roll(
        { who: `Clue scroll (${c.tier.toLowerCase()})`, head: sprite, headIsItem: true },
        c.source, baseRate, isVanilla ? { kind: 'clue', clueTier: c.tier } : undefined,
      ),
    };
  });

  const q = bossQuery.trim().toLowerCase();
  const vanillaBossCards: CardModel[] = isVanilla ? p.vanillaBosses
    .filter((name) => name.toLowerCase().includes(q))
    .map((name) => {
      const bossClass = name === BRUTUS_BOSS_NAME ? 'brutus' as const : bossTier(name);
      const source = bossClass === 'brutus' ? TIER_SOURCE.low : TIER_SOURCE[bossClass];
      const stage = vanillaBossKeyStage(name, bossStandardKeysAwarded?.[name] ?? 0);
      const rate = stage.currentRate ?? 0;
      const note = vanillaBossNote(name, unlocks.quests);
      const body = npcBody(name);
      const head = npcHead(name);
      const classLabel = bossClass === 'brutus' ? 'Low' : TIER_LABEL[bossClass];
      const rates = stage.rates.map((r) => `${r}%`).join(', then ');
      return {
        id: name,
        name,
        sub: `${classLabel} boss · stash ${stage.cap} Key${stage.cap === 1 ? '' : 's'}`,
        rate: stage.capped ? (stage.rates[stage.rates.length - 1] ?? 0) : rate,
        bonus: 0,
        art: body ? { kind: 'body', src: body, big: isBigBody(name) } : { kind: 'wikiName', name },
        thumb: head ? { src: head } : { wikiName: name },
        status: stage.capped
          ? { text: 'Stash empty: kills no longer roll', color: 'var(--osrs-muted, #8a7c66)' }
          : { text: 'Ready to roll', color: '#0dc10d' },
        extra: note ? { text: note, color: '#ffff00' } : undefined,
        stats: stage.capped
          ? `${stage.awarded} of ${stage.cap} Keys paid`
          : `Stash ${stage.cap} Key${stage.cap === 1 ? '' : 's'}: ${rates} · ${stage.awarded} paid`,
        stash: { cap: stage.cap, awarded: stage.awarded },
        disabled: stage.capped,
        btn: stage.capped ? 'Spent' : 'Roll',
        title: stage.capped
          ? `${name}: This boss no longer rolls for Keys or Fate. Its Combat Achievements, Collection Log items and pet still roll.`
          : `${name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% for the next Key`,
        examine: stage.capped
          ? `${classLabel} boss. All ${stage.cap} Key${stage.cap === 1 ? '' : 's'} paid: kills no longer roll for Keys or Fate.`
          : `${classLabel} boss. Stash of ${stage.cap} Key${stage.cap === 1 ? '' : 's'} at ${rates}. ${rate}% chance of a Key per kill now.`,
        onRoll: roll({ who: name, head: head ?? KEY_IMG, headIsItem: !head }, source, rate, { kind: 'boss', bossName: name, bossClass }),
      };
    }) : [];

  const activityCards: CardModel[] = p.activities.map((a) => {
    const rate = effectiveRate(a.source);
    return {
      id: a.name,
      name: a.name,
      sub: a.subText,
      rate,
      bonus: regionBonus,
      art: { kind: 'item', src: MINIGAME_IMG },
      thumb: { src: MINIGAME_IMG, item: true },
      status: ready,
      stats: tallyText(tally.get(a.source)),
      btn: 'Roll',
      title: `${a.name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% per roll`,
      examine: `${a.subText}. ${rate}% chance of a Key per game.`,
      onRoll: roll({ who: a.name, head: MINIGAME_IMG, headIsItem: true }, a.source, DROP_RATES[a.source]),
    };
  });

  const counts: Record<FarmSubTab, number> = {
    SLAYER: p.slayers.length,
    CLUES: p.clues.length,
    BOSSING: isVanilla ? p.vanillaBosses.length : BOSSES_LIST.length,
    ACTIVITIES: p.activities.length + 1,
  };

  const ladderRows: LadderRow[] = (() => {
    if (subTab === 'SLAYER') return buildLadder(slayerCards.map((c) => ({ label: c.name, rate: c.rate, live: true })));
    if (subTab === 'CLUES') return buildLadder(clueCards.map((c) => ({ label: c.name, rate: c.rate, live: true })));
    if (subTab === 'BOSSING') {
      if (isVanilla) return buildLadder(vanillaBossCards.map((c) => ({ label: c.name, rate: c.rate, live: !c.disabled })));
      return TIER_ORDER.map((t) => ({ label: `${TIER_LABEL[t]}-tier`, rate: effectiveRate(TIER_SOURCE[t]), live: true })).sort((a, b) => a.rate - b.rate);
    }
    return buildLadder(activityCards.map((c) => ({ label: c.name, rate: c.rate, live: true })));
  })();

  const categoryButtons = (icons: Record<FarmSubTab, string>) => (
    <div className={`okf-cats${wide ? ' wide' : ''}`} role="tablist" aria-label="Key sources">
      {TABS.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={subTab === t.id} className="okf-cat" onClick={() => setFarmTab(t.id)}>
          <img className="osrs-px" src={icons[t.id]} alt="" aria-hidden="true" />
          {t.label}
          <span className="count">{counts[t.id]}</span>
        </button>
      ))}
    </div>
  );

  const bossSearch = subTab === 'BOSSING' && (
    <input className="okf-search" value={bossQuery} onChange={(e) => setBossQuery(e.target.value)}
      placeholder={isVanilla ? VANILLA_BOSS_SEARCH_PLACEHOLDER : 'Search bosses…'} aria-label="Search bosses" />
  );

  // The long all-boss list outside Vanilla, grouped by tier (both sizes).
  const tierGroups = !isVanilla && subTab === 'BOSSING' && (
    <>
      {TIER_ORDER.map((tier: BossTier) => {
        const list = BOSSES_LIST.filter((b) => bossTier(b) === tier && b.toLowerCase().includes(q));
        if (list.length === 0) return null;
        const source = TIER_SOURCE[tier];
        const rate = effectiveRate(source);
        const gem = gemFor(rate);
        return (
          <div key={tier} className="okf-group">
            <div className="okf-group-head">
              <img className="osrs-px" src={gem.src} alt="" aria-hidden="true" />
              <span style={{ fontFamily: "'RSBold', sans-serif", color: gem.color }}>{gem.label}</span>
              <span style={{ color: '#ff981f' }}>{TIER_LABEL[tier]}-tier</span>
              <span style={{ marginLeft: 'auto', color: '#ffff00' }}>{rate}%</span>
              <span className="small">· {list.length}</span>
            </div>
            <div className={wide ? 'okf-group-rows' : undefined}>
              {list.map((name) => (
                <BossRow key={name} name={name} rate={rate} bonus={regionBonus} tierLabel={TIER_LABEL[tier]}
                  onRoll={roll({ who: name, head: npcHead(name) ?? KEY_IMG, headIsItem: !npcHead(name) }, source, DROP_RATES[source])} />
              ))}
            </div>
          </div>
        );
      })}
      {BOSSES_LIST.filter((b) => b.toLowerCase().includes(q)).length === 0 && (
        <div className="okf-empty">No bosses match “{bossQuery}”.</div>
      )}
    </>
  );

  const cards = subTab === 'SLAYER' ? slayerCards : subTab === 'CLUES' ? clueCards : subTab === 'BOSSING' ? vanillaBossCards : activityCards;
  const emptyBosses = subTab === 'BOSSING' && isVanilla && vanillaBossCards.length === 0
    ? <div className="okf-empty">{vanillaBossSearchEmptyMessage(bossQuery)}</div> : null;
  const petClaim = subTab === 'ACTIVITIES'
    ? <OsrsPetClaim claimed={petsClaimed} wide={wide} onClaim={(pet, e) => claimPet(pet, e.clientX, e.clientY)} /> : null;
  const other = otherOpen && (
    <OtherSources journalMin={p.journalMin} journalMax={p.journalMax} statsIcon={p.statsIcon} collLogIcon={p.collLogIcon}
      onClose={() => setOtherOpen(false)} className={wide ? 'at-wide' : 'at-compact'} />
  );
  const otherBtn = (
    <button type="button" className="osrs-btn okf-small-btn" aria-expanded={otherOpen} onClick={() => setOtherOpen((o) => !o)}>Other sources</button>
  );

  if (!wide) {
    return (
      <div className="okf okf-compact" data-osrs-farm="">
        {categoryButtons(COMPACT_TAB_ICONS)}
        <div className="osrs-inner okf-list">
          <div className="okf-list-scroll">
            {bossSearch}
            {subTab === 'BOSSING' && !isVanilla ? tierGroups : cards.map((c) => <SourceRow key={c.id} card={c} />)}
            {emptyBosses}
            {petClaim}
          </div>
          <div className="okf-list-foot">
            {otherBtn}
          </div>
          {other}
          <DockedDialogue history={history} pending={pending} />
        </div>
      </div>
    );
  }

  const cols = subTab === 'SLAYER' || cards.length > 6 ? 5 : 3;
  return (
    <div className="okf okf-wide" data-osrs-farm="">
      <div className="osrs-win okf-main">
        <OsrsKeysTabs />
        {categoryButtons(WIDE_TAB_ICONS)}
        <div className="okf-blurb">
          <span>{subTab === 'BOSSING' && isVanilla ? VANILLA_BOSS_BLURB : BLURBS[subTab]}</span>
          <span className="hint"><b>Gem = odds tier.</b> Same gem, same chance, on every tab.</span>
          {otherBtn}
        </div>
        {bossSearch}
        {subTab === 'BOSSING' && !isVanilla ? (
          <div className="osrs-inner okf-tiers">{tierGroups}</div>
        ) : (
          <div className="okf-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {cards.map((c) => <NpcCard key={c.id} card={c} />)}
            {petClaim}
            {emptyBosses}
          </div>
        )}
        {other}
      </div>
      <div className="okf-col">
        <LastRollWindow history={history} pending={pending} />
        {ladderRows.length > 0 && <Ladder title={LADDER_TITLES[subTab]} rows={ladderRows} />}
        <RecentRolls history={history} />
      </div>
    </div>
  );
};

export default OsrsFarmKeys;
