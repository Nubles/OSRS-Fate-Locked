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

/**
 * Farm Keys in the OSRS layout. A presentation of ActionSection: every source,
 * rate, roll and handler comes from ActionSection's props and the same
 * GameContext; this file only draws them as an OSRS interface. Each Slayer
 * master, clue tier, boss and activity is an NPC card topped by the gem of its
 * odds tier, and the last roll answers in an NPC dialogue box.
 */

export type FarmSubTab = 'SLAYER' | 'CLUES' | 'BOSSING' | 'ACTIVITIES';
type RollPoint = { clientX: number; clientY: number };

export interface FarmSlayerSource { name: string; subText: string; source: DropSource; image: string }
export interface FarmClueSource { tier: string; source: DropSource; itemId: number }
export interface FarmActivitySource { name: string; subText: string; source: DropSource; image: string }

export interface OsrsFarmKeysProps {
  subTab: FarmSubTab;
  setSubTab: (tab: FarmSubTab) => void;
  bossQuery: string;
  setBossQuery: (query: string) => void;
  slayers: readonly FarmSlayerSource[];
  clues: readonly FarmClueSource[];
  activities: readonly FarmActivitySource[];
  tabIcons: Record<FarmSubTab, string>;
  isVanilla: boolean;
  vanillaBosses: readonly string[];
  clueKeysAwarded: number;
  regionBonus: number;
  effectiveRate: (source: string) => number;
  handleRoll: (source: string, chance: number, e: RollPoint, context?: KeyRollContext) => void;
  journalMin: number;
  journalMax: number;
  statsIcon: string;
  collLogIcon: string;
}

const UI = `${import.meta.env.BASE_URL}osrs-ui/`;
const WIKI_IMG = 'https://oldschool.runescape.wiki/images/';
const KEY_IMG = `${UI}items/key.png`;
const OMNI_IMG = `${UI}items/omni_key.png`;

// ── Gem tiers: the same ladder as the design board (opal .. zenyte). A source
// sits on the first gem whose ceiling its rate does not pass. ──────────────
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
// Keyed by lower-case name, so "Crazy Archaeologist" and "Crazy archaeologist" both match.
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

const BLURBS: Record<FarmSubTab, string> = {
  SLAYER: 'Finish a task, then roll your master. Harder masters roll better.',
  CLUES: 'Finish a clue, then roll its tier. Harder caskets roll better.',
  BOSSING: 'Roll the boss you killed. Its tier sets the odds.',
  ACTIVITIES: 'Every finished game rolls, with no limit.',
};
const VANILLA_BOSS_BLURB = 'Vanilla: each boss holds a small Key stash. Once it is empty, kills stop rolling.';
const LADDER_TITLES: Record<FarmSubTab, string> = {
  SLAYER: 'Slayer odds by tier', CLUES: 'Clue odds by tier', BOSSING: 'Boss odds', ACTIVITIES: 'Activity odds',
};

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
const WikiNamedImg: React.FC<{ name: string; fallback?: string; className?: string }> = ({ name, fallback, className }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    wikiService.fetchImage(name).then((url) => { if (live && url) setSrc(url); });
    return () => { live = false; };
  }, [name]);
  const shown = src || fallback;
  return shown ? <img src={shown} alt={name} className={className} /> : null;
};

// ── One source as an NPC card ─────────────────────────────────────────────
type Art =
  | { kind: 'body'; src: string; big?: boolean }
  | { kind: 'item'; src: string }
  | { kind: 'wiki'; src: string }
  | { kind: 'wikiName'; name: string };

interface CardModel {
  id: string;
  name: string;
  sub: string;
  rate: number;
  bonus: number;
  art: Art;
  status: { text: string; color: string };
  lines: { text: string; color: string; wrap?: boolean }[];
  stash?: { cap: number; awarded: number };
  disabled?: boolean;
  btn: string;
  examine: string;
  title: string;
  onRoll: (p: RollPoint) => void;
}

const BonusTag: React.FC<{ bonus: number }> = ({ bonus }) =>
  bonus ? <span title="Region passive modifier active" style={{ color: bonus > 0 ? '#00ff00' : '#ff3030', marginLeft: 3 }}>{bonus > 0 ? '+' : '−'}{Math.abs(bonus)}</span> : null;

const NpcCard: React.FC<{ card: CardModel }> = ({ card }) => {
  const { isRolling, trigger } = useRollSuspense(card.onRoll);
  const gem = gemFor(card.rate);
  const live = !card.disabled;
  const frame = live ? `inset 0 0 0 2px ${gem.color}` : 'inset 0 0 0 2px var(--osrs-inner-ring, #4f4434)';
  const stageBg = live
    ? `radial-gradient(ellipse at 50% 92%, ${rgba(gem.color, 0.32)} 0%, ${rgba(gem.color, 0.08)} 45%, rgba(0,0,0,0) 70%), linear-gradient(#2a231b, #1c1712)`
    : 'linear-gradient(#24201a, #171410)';
  const filter = live ? undefined : 'grayscale(.9) brightness(.45)';
  const art = card.art;
  return (
    <div
      className="osrs-farm-card"
      title={card.title}
      data-examine={card.examine}
      data-examine-name={card.name}
    >
      <div className="osrs-farm-card-head">
        <img className="osrs-px" src={gem.src} alt="" aria-hidden="true" />
        <span className="tier" style={{ color: gem.color }}>{gem.label}</span>
        <span className="rate">{card.disabled && card.stash ? 'Spent' : `${card.rate}%`}<BonusTag bonus={card.bonus} /></span>
      </div>
      <div className="osrs-farm-stage" style={{ background: stageBg }}>
        <div className="shadow" />
        {art.kind === 'body' && <img className={`body osrs-smooth${art.big ? ' big' : ''}`} src={art.src} alt={card.name} style={{ filter }} />}
        {art.kind === 'item' && <img className="item" src={art.src} alt={card.name} style={{ filter }} />}
        {art.kind === 'wiki' && <img className="body osrs-smooth" src={art.src} alt={card.name} style={{ filter, height: '78%' }} />}
        {art.kind === 'wikiName' && (
          <span style={{ position: 'relative', display: 'flex', height: '78%', marginBottom: 8, filter }}>
            <WikiNamedImg name={art.name} className="osrs-smooth" />
          </span>
        )}
        {card.stash && (
          <div className="osrs-farm-stash" aria-label={`${card.stash.awarded} of ${card.stash.cap} Keys paid`}>
            {Array.from({ length: card.stash.cap }, (_, i) => (
              <div key={i} className={`osrs-slot${i < card.stash!.awarded ? ' paid' : ''}`}>
                <img className="osrs-px" src={KEY_IMG} alt="" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="osrs-farm-card-foot">
        <span className="name">{card.name}</span>
        <span className="small" style={{ color: 'var(--osrs-tan, #c8b897)' }}>{card.sub}</span>
        <span className="small" style={{ color: card.status.color }}>{card.status.text}</span>
        {card.lines.map((l, i) => (
          <span key={i} className={`small${l.wrap ? ' wrap' : ''}`} style={{ color: l.color }}>{l.text}</span>
        ))}
        <div className="spacer" />
        <button type="button" className="osrs-btn" disabled={card.disabled || isRolling} onClick={trigger}>
          {isRolling ? 'Rolling...' : card.btn}
        </button>
      </div>
      <div className="osrs-farm-frame" style={{ boxShadow: frame }} aria-hidden="true" />
    </div>
  );
};

/** A compact row for the long all-boss list outside Vanilla. */
const BossRow: React.FC<{ name: string; rate: number; bonus: number; tierLabel: string; onRoll: (p: RollPoint) => void }> = ({ name, rate, bonus, tierLabel, onRoll }) => {
  const { isRolling, trigger } = useRollSuspense(onRoll);
  return (
    <div
      className="osrs-farm-row"
      data-examine={`${tierLabel}-tier boss. ${rate}% chance of a Key per kill.`}
      data-examine-name={name}
    >
      <span className="name">{name}</span>
      <span className="rate">{rate}%{bonus > 0 ? <span style={{ color: '#00ff00' }}> +{bonus}</span> : ''}</span>
      <button type="button" className="osrs-btn" disabled={isRolling} onClick={trigger}>{isRolling ? '...' : 'Roll'}</button>
    </div>
  );
};

// ── Odds ladder ───────────────────────────────────────────────────────────
interface LadderRow { label: string; rate: number; live: boolean }
const Ladder: React.FC<{ title: string; rows: LadderRow[] }> = ({ title, rows }) => {
  if (rows.length < 2) return null;
  return (
    <div className="osrs-win" style={{ padding: 4 }}>
      <h3 className="osrs-title" style={{ margin: '2px 0 4px', textAlign: 'center' }}>{title}</h3>
      <div className="osrs-inner osrs-farm-ladder">
        {rows.map((r) => {
          const gem = gemFor(r.rate);
          return (
            <div key={`${r.label}-${r.rate}`} className="osrs-farm-ladder-row" style={{ opacity: r.live ? 1 : 0.5 }}>
              <img className="osrs-px" src={gem.src} alt={gem.name} />
              <span className="name">{r.label}</span>
              <div className="osrs-farm-bar"><div style={{ width: `${Math.min(100, r.rate)}%`, background: gem.color }} /></div>
              <span className="rate">{r.rate}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
const OsrsPetClaim: React.FC<{ claimed: readonly number[] | undefined; onClaim: (pet: Pet, e: React.MouseEvent) => void }> = ({ claimed, onClaim }) => {
  const left = useMemo(() => unclaimedPets(claimed), [claimed]);
  const [chosen, setChosen] = useState('');
  const [confirming, setConfirming] = useState(false);
  const pet = left.find((candidate) => String(candidate.id) === chosen);
  return (
    <div
      className="osrs-win"
      style={{ gridColumn: '1 / -1', padding: 4 }}
      data-examine="An Omni-Key for each new pet, once per pet. Not a roll."
      data-examine-name="New Pet"
    >
      <h3 className="osrs-title" style={{ margin: '2px 0 4px', textAlign: 'center' }}>New Pet</h3>
      <div className="osrs-inner osrs-farm-pet">
        <span style={{ fontFamily: 'RSSmall, sans-serif', lineHeight: '15px' }}>An Omni-Key for each new pet, once per pet.</span>
        {left.length === 0 ? (
          <span style={{ color: '#ffff00' }}>Every pet is claimed.</span>
        ) : confirming && pet ? (
          <div role="group" aria-label="Check your pet" className="osrs-chat confirm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WikiIcon file={petImageFile(pet)} alt="" size={36} className="shrink-0" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'RSBold, sans-serif', color: '#800000' }}>Claim an Omni-Key for {pet.name}?</div>
                {PET_SOURCES[pet.id] && <div>From {PET_SOURCES[pet.id].source}</div>}
              </div>
            </div>
            <div>Each pet counts once, so check it’s the one you got.</div>
            <button
              type="button"
              className="osrs-btn"
              onClick={(e) => { onClaim(pet, e); setChosen(''); setConfirming(false); }}
            >
              Yes, I got {pet.name}
            </button>
            <button type="button" className="osrs-btn" onClick={() => setConfirming(false)}>Back</button>
          </div>
        ) : (
          <>
            <PetPicker pets={left} value={pet ? chosen : ''} onChange={setChosen} label="The pet you got" />
            <button type="button" className="osrs-btn" disabled={!pet} onClick={() => { if (pet) setConfirming(true); }}>
              <img className="osrs-px" src={OMNI_IMG} alt="" aria-hidden="true" style={{ width: 27, height: 24 }} />
              Claim Omni-Key
            </button>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-muted, #8a7c66)' }}>{PETS.length - left.length} of {PETS.length} pets claimed</span>
          {left.length < PETS.length && (
            <button type="button" className="osrs-farm-link" onClick={() => window.dispatchEvent(new Event(OPEN_PETS_EVENT))}>Your pets</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Last roll as an NPC dialogue ──────────────────────────────────────────
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
  [DropSource.SLAYER_BOSS]: { who: 'Boss Task', head: `${WIKI_IMG}Purple_slayer_helmet.png`, headIsItem: true },
  [DropSource.ACTIVITY_MINIGAME]: { who: 'Minigame', head: `${WIKI_IMG}Void_knight_mace.png`, headIsItem: true },
};
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

const speakerFor = (entry: LogEntry, pending: PendingRoll | null): Speaker => {
  if (pending && pending.source === entry.source && entry.timestamp >= pending.at) return pending;
  const bossName = entry.meta?.bossName as string | undefined;
  if (bossName) {
    const head = npcHead(bossName);
    return { who: bossName, head: head ?? KEY_IMG, headIsItem: !head };
  }
  return SOURCE_SPEAKER[entry.source ?? ''] ?? { who: entry.source ?? 'Fate', head: KEY_IMG, headIsItem: true };
};

const LastRollDialogue: React.FC<{ history: readonly LogEntry[]; pending: PendingRoll | null }> = ({ history, pending }) => {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const entry = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (isRollEntry(h) && h.source && FARM_SOURCES.has(h.source)) return h;
    }
    return null;
  }, [history]);
  // Only a roll made from this panel opens the dialogue, as talking to an NPC
  // does; "Click here to continue" closes it until the next roll.
  if (!entry || !pending || entry.id === dismissed) return null;
  if (pending.source !== entry.source || entry.timestamp < pending.at) return null;
  const speaker = speakerFor(entry, pending);
  const roll = typeof entry.rollValue === 'number' ? entry.rollValue : (entry.meta?.roll as number | undefined);
  const threshold = typeof entry.threshold === 'number' ? entry.threshold : (entry.meta?.threshold as number | undefined);
  const won = entry.result === 'SUCCESS';
  const keys = Number(entry.meta?.standardKeysAwarded ?? 1);
  const fate = Number(entry.meta?.fatePointsEarned ?? 0);
  const omni = entry.type === 'ROLL_OMNI';
  const rolled = roll !== undefined && threshold !== undefined
    ? `You rolled ${formatKeyRollValue(roll)}, needing ${formatKeyPercent(threshold)} or under. `
    : '';
  const verdict = entry.type === 'PITY'
    ? entry.message
    : won ? `Fate smiles on you. ${entry.message}` : 'No Key this time, but Fate remembers.';
  return (
    <div className="osrs-farm-dialogue-dock">
      <button
        type="button"
        className="osrs-farm-dialogue"
        onClick={() => setDismissed(entry.id)}
        aria-label={`${speaker.who}: ${rolled}${verdict} Click here to continue`}
      >
        {speaker.head
          ? <img className={`chathead${speaker.headIsItem ? ' item' : ' osrs-smooth'}`} src={speaker.head} alt="" aria-hidden="true" />
          : <span />}
        <span className="text">
          <span className="who">{speaker.who}</span>
          <span className="line">{rolled}{verdict}</span>
          <span className="cont">Click here to continue</span>
        </span>
        {won ? (
          <span className="osrs-slot won" title={omni ? 'Key and Omni-Key won' : 'Key won'}>
            <img className="osrs-px" src={omni ? OMNI_IMG : KEY_IMG} alt={omni ? 'Omni-Key won' : 'Key won'} />
            <span className="osrs-stack" style={{ color: '#00ff00' }}>+{omni ? 1 : keys}</span>
          </span>
        ) : fate > 0 ? <span className="fate">+{fate} Fate</span> : null}
      </button>
    </div>
  );
};

// ── The panel ─────────────────────────────────────────────────────────────
export const OsrsFarmKeys: React.FC<OsrsFarmKeysProps> = (p) => {
  const { claimPet, petsClaimed, unlocks, bossStandardKeysAwarded, history } = useGame();
  const [pending, setPending] = useState<PendingRoll | null>(null);
  const { subTab, isVanilla, regionBonus, effectiveRate, handleRoll } = p;

  const roll = (speaker: Speaker, source: string, chance: number, context?: KeyRollContext) => (pt: RollPoint) => {
    setPending({ ...speaker, source, at: Date.now() });
    handleRoll(source, chance, pt, context);
  };

  // Rolls per source from the log, for each card's tally.
  const tally = useMemo(() => {
    const bySource = new Map<string, { rolled: number; keys: number }>();
    const byBoss = new Map<string, { rolled: number; keys: number }>();
    for (const h of history) {
      if (!isRollEntry(h) || !h.source || !FARM_SOURCES.has(h.source)) continue;
      const won = h.result === 'SUCCESS' ? 1 : 0;
      const s = bySource.get(h.source) ?? { rolled: 0, keys: 0 };
      bySource.set(h.source, { rolled: s.rolled + 1, keys: s.keys + won });
      const boss = h.meta?.bossName as string | undefined;
      if (boss) {
        const b = byBoss.get(boss) ?? { rolled: 0, keys: 0 };
        byBoss.set(boss, { rolled: b.rolled + 1, keys: b.keys + won });
      }
    }
    return { bySource, byBoss };
  }, [history]);
  const tallyText = (t: { rolled: number; keys: number } | undefined) =>
    t && t.rolled ? `${t.rolled} rolled · ${t.keys} Key${t.keys === 1 ? '' : 's'}` : '0 rolled';

  const ready = { text: 'Ready to roll', color: '#0dc10d' };

  const slayerCards: CardModel[] = p.slayers.map((m) => {
    const rate = effectiveRate(m.source);
    const body = npcBody(m.name);
    const isItem = m.source === DropSource.SLAYER_BOSS;
    const sharer = p.slayers.find((o) => o.source === m.source);
    const shared = sharer && sharer.name !== m.name;
    const head = isItem ? null : npcHead(m.name);
    return {
      id: m.name,
      name: m.name,
      sub: m.subText,
      rate,
      bonus: regionBonus,
      art: body ? { kind: 'body', src: body } : { kind: 'wiki', src: m.image },
      status: ready,
      lines: [{ text: shared ? `Shares ${sharer!.name}’s odds` : tallyText(tally.bySource.get(m.source)), color: '#ffffff' }],
      btn: 'Roll',
      title: `${m.name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% per roll`,
      examine: `${m.subText}. ${rate}% chance of a Key per task.`,
      onRoll: roll({ who: m.name, head: head ?? m.image, headIsItem: isItem || !head }, m.source, DROP_RATES[m.source]),
    };
  });

  const clueCards: CardModel[] = p.clues.map((c) => {
    const baseRate = DROP_RATES[c.source];
    const rate = isVanilla ? effectiveVanillaClueRate(baseRate, p.clueKeysAwarded) : effectiveRate(c.source);
    const lines: CardModel['lines'] = [{ text: tallyText(tally.bySource.get(c.source)), color: '#ffffff' }];
    if (isVanilla) {
      const onboarding = p.clueKeysAwarded < CLUE_ONBOARDING_MINIMUMS.length && rate > baseRate;
      lines.push({
        text: `First clue Keys: ${Math.min(p.clueKeysAwarded, CLUE_ONBOARDING_MINIMUMS.length)} of ${CLUE_ONBOARDING_MINIMUMS.length}`,
        color: 'var(--osrs-tan, #c8b897)',
      });
      lines.push({
        text: onboarding ? `${rate}% for your first Keys` : (p.clueKeysAwarded >= CLUE_ONBOARDING_MINIMUMS.length ? 'Normal tier rates apply' : `${rate}% tier rate`),
        color: onboarding ? '#00ff00' : 'var(--osrs-tan, #c8b897)',
      });
    }
    const name = `${c.tier} clue`;
    const sprite = clueSprite(c.tier);
    return {
      id: c.tier,
      name,
      sub: 'Treasure Trails',
      rate,
      bonus: isVanilla ? 0 : regionBonus,
      art: { kind: 'item', src: sprite },
      status: ready,
      lines,
      btn: 'Roll',
      title: `${name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% per roll`,
      examine: `Clue scroll (${c.tier.toLowerCase()}). ${rate}% chance of a Key per casket.`,
      onRoll: roll(
        { who: `Clue scroll (${c.tier.toLowerCase()})`, head: sprite, headIsItem: true },
        c.source, baseRate, isVanilla ? { kind: 'clue', clueTier: c.tier } : undefined,
      ),
    };
  });

  const q = p.bossQuery.trim().toLowerCase();
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
      const lines: CardModel['lines'] = [];
      if (note) lines.push({ text: note, color: '#ffff00', wrap: true });
      lines.push({ text: `${stage.awarded} of ${stage.cap} Keys paid`, color: '#ffffff' });
      if (!stage.capped && stage.nextRate !== null) lines.push({ text: `${stage.nextRate}% next`, color: 'var(--osrs-tan, #c8b897)' });
      const rates = stage.rates.map((r) => `${r}%`).join(', then ');
      return {
        id: name,
        name,
        sub: `${classLabel} boss · stash ${stage.cap} Key${stage.cap === 1 ? '' : 's'}`,
        rate: stage.capped ? (stage.rates[stage.rates.length - 1] ?? 0) : rate,
        bonus: 0,
        art: body ? { kind: 'body', src: body, big: isBigBody(name) } : { kind: 'wikiName', name },
        status: stage.capped ? { text: 'All Keys paid', color: 'var(--osrs-muted, #8a7c66)' } : { text: `${rate}% now`, color: '#0dc10d' },
        lines,
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
      art: { kind: 'wiki', src: a.image },
      status: ready,
      lines: [{ text: tallyText(tally.bySource.get(a.source)), color: '#ffffff' }],
      btn: 'Roll',
      title: `${a.name}: ${gemFor(rate).label} (${gemFor(rate).name}), ${rate}% per roll`,
      examine: `${a.subText}. ${rate}% chance of a Key per game.`,
      onRoll: roll({ who: a.name, head: a.image, headIsItem: true }, a.source, DROP_RATES[a.source]),
    };
  });

  const counts: Record<FarmSubTab, number> = {
    SLAYER: p.slayers.length,
    CLUES: p.clues.length,
    BOSSING: isVanilla ? p.vanillaBosses.length : BOSSES_LIST.length,
    ACTIVITIES: p.activities.length + 1,
  };
  const TABS: { id: FarmSubTab; label: string }[] = [
    { id: 'SLAYER', label: 'Slayer' }, { id: 'CLUES', label: 'Clues' }, { id: 'BOSSING', label: 'Bossing' }, { id: 'ACTIVITIES', label: 'Activities' },
  ];

  const ladderRows: LadderRow[] = (() => {
    if (subTab === 'SLAYER') return buildLadder(slayerCards.map((c) => ({ label: c.name, rate: c.rate, live: true })));
    if (subTab === 'CLUES') return buildLadder(clueCards.map((c) => ({ label: c.name, rate: c.rate, live: true })));
    if (subTab === 'BOSSING') {
      if (isVanilla) return buildLadder(vanillaBossCards.map((c) => ({ label: c.name, rate: c.rate, live: !c.disabled })));
      return TIER_ORDER.map((t) => ({ label: `${TIER_LABEL[t]}-tier`, rate: effectiveRate(TIER_SOURCE[t]), live: true })).sort((a, b) => a.rate - b.rate);
    }
    return buildLadder(activityCards.map((c) => ({ label: c.name, rate: c.rate, live: true })));
  })();

  return (
    <div className="osrs-farm" data-osrs-farm="">
      <div className="osrs-farm-tabs" role="tablist" aria-label="Key sources">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={subTab === t.id}
            className="osrs-farm-tab"
            onClick={() => p.setSubTab(t.id)}
          >
            <img className="osrs-px" src={p.tabIcons[t.id]} alt="" aria-hidden="true" />
            {t.label}
            <span className="osrs-farm-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="osrs-farm-blurb">
        <span>{subTab === 'BOSSING' && isVanilla ? VANILLA_BOSS_BLURB : BLURBS[subTab]}</span>
        <span className="hint"><b>Gem = odds tier.</b> Same gem, same chance, on every tab.</span>
      </div>

      {subTab === 'SLAYER' && (
        <div className="osrs-farm-grid">{slayerCards.map((c) => <NpcCard key={c.id} card={c} />)}</div>
      )}

      {subTab === 'CLUES' && (
        <div className="osrs-farm-grid">{clueCards.map((c) => <NpcCard key={c.id} card={c} />)}</div>
      )}

      {subTab === 'BOSSING' && (
        <>
          <input
            className="osrs-farm-search"
            value={p.bossQuery}
            onChange={(e) => p.setBossQuery(e.target.value)}
            placeholder={isVanilla ? VANILLA_BOSS_SEARCH_PLACEHOLDER : 'Search bosses…'}
            aria-label="Search bosses"
          />
          {isVanilla ? (
            vanillaBossCards.length > 0
              ? <div className="osrs-farm-grid">{vanillaBossCards.map((c) => <NpcCard key={c.id} card={c} />)}</div>
              : <div className="osrs-farm-empty">{vanillaBossSearchEmptyMessage(p.bossQuery)}</div>
          ) : (
            <>
              {TIER_ORDER.map((tier: BossTier) => {
                const list = BOSSES_LIST.filter((b) => bossTier(b) === tier && b.toLowerCase().includes(q));
                if (list.length === 0) return null;
                const source = TIER_SOURCE[tier];
                const rate = effectiveRate(source);
                const gem = gemFor(rate);
                return (
                  <div key={tier} className="osrs-win" style={{ padding: 2, boxShadow: `inset 0 0 0 2px ${gem.color}` }}>
                    <div className="osrs-farm-group-head">
                      <img className="osrs-px" src={gem.src} alt="" aria-hidden="true" />
                      <span style={{ fontFamily: 'RSBold, sans-serif', color: gem.color }}>{gem.label}</span>
                      <span className="osrs-title" style={{ marginLeft: 4 }}>{TIER_LABEL[tier]}-tier</span>
                      <span style={{ marginLeft: 'auto', color: '#ffff00' }}>{rate}%</span>
                      <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-tan, #c8b897)' }}>· {list.length}</span>
                    </div>
                    <div className="osrs-inner osrs-farm-rows">
                      {list.map((name) => (
                        <BossRow
                          key={name}
                          name={name}
                          rate={rate}
                          bonus={regionBonus}
                          tierLabel={TIER_LABEL[tier]}
                          onRoll={roll({ who: name, head: npcHead(name) ?? KEY_IMG, headIsItem: !npcHead(name) }, source, DROP_RATES[source])}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {BOSSES_LIST.filter((b) => b.toLowerCase().includes(q)).length === 0 && (
                <div className="osrs-farm-empty">No bosses match “{p.bossQuery}”.</div>
              )}
            </>
          )}
        </>
      )}

      {subTab === 'ACTIVITIES' && (
        <div className="osrs-farm-grid">
          {activityCards.map((c) => <NpcCard key={c.id} card={c} />)}
          <OsrsPetClaim claimed={petsClaimed} onClaim={(pet, e) => claimPet(pet, e.clientX, e.clientY)} />
        </div>
      )}

      <Ladder title={LADDER_TITLES[subTab]} rows={ladderRows} />

      <div className="osrs-win" style={{ padding: 4 }}>
        <h3 className="osrs-title" style={{ margin: '2px 0 4px', textAlign: 'center' }}>Other Key Sources</h3>
        <div className="osrs-inner osrs-farm-other">
          <div className="osrs-farm-other-row" data-examine={`Click unlocked skills in the Dashboard to roll. Chance = Level / 5 (up to ${LEVEL_ROLL_MAX.toFixed(1)}%).`} data-examine-name="Skill Rolling">
            <img className="osrs-px" src={p.statsIcon} alt="" aria-hidden="true" />
            <div>
              <div className="label">Skill Rolling</div>
              <div className="desc">Click unlocked skills in the <em>Dashboard</em> to roll.</div>
              <div className="rate">Chance = Level / 5 (up to {LEVEL_ROLL_MAX.toFixed(1)}%)</div>
            </div>
          </div>
          <div className="osrs-farm-other-row" data-examine={`Complete Quests, Diaries and CAs in the Journal Tab. Variable (${p.journalMin}% - ${p.journalMax}%).`} data-examine-name="Journal Activities">
            <img src={`${WIKI_IMG}Quest_point_icon.png`} alt="" aria-hidden="true" />
            <div>
              <div className="label">Journal Activities</div>
              <div className="desc">Complete Quests, Diaries &amp; CAs in the <em>Journal Tab</em>.</div>
              <div className="rate">Variable ({p.journalMin}% - {p.journalMax}%)</div>
            </div>
          </div>
          <div className="osrs-farm-other-row" data-examine={`Log new unique items in the Collection Log Tab to roll. ${DROP_RATES[DropSource.COLLECTION_LOG]}% Drop Chance.`} data-examine-name="Collection Log">
            <img src={p.collLogIcon} alt="" aria-hidden="true" />
            <div>
              <div className="label">Collection Log</div>
              <div className="desc">Log new unique items in the <em>Collection Log Tab</em> to roll.</div>
              <div className="rate">{DROP_RATES[DropSource.COLLECTION_LOG]}% Drop Chance</div>
            </div>
          </div>
        </div>
      </div>

      <LastRollDialogue history={history} pending={pending} />
    </div>
  );
};

export default OsrsFarmKeys;
