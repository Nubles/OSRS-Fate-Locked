import React from 'react';
import { TableType, type LogEntry, type UnlockState } from '../../types';
import { BANK_BY_ID } from '../../data/banks';
import { chunkLabel } from '../../utils/chunkAdjacency';
import { tierBand } from '../../utils/skillTiers';
import './osrs-shell.css';

const BASE = import.meta.env.BASE_URL;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** One gem ladder for the whole app: Tier I..X. */
const GEMS = ['opal', 'jade', 'red_topaz', 'sapphire', 'emerald', 'ruby', 'diamond', 'dragonstone', 'onyx', 'zenyte'];
const GEM_NAMES = ['Opal', 'Jade', 'Red topaz', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Dragonstone', 'Onyx', 'Zenyte'];
const KEY_SPRITE: Record<string, string> = { key: 'key.png', specialKey: 'omni_key.png', chaosKey: 'chaos_key.png', fate: 'void_seal.png', mercy: 'void_seal.png', breakthrough: 'void_seal.png' };

/** "a new …" for each table, as the game words its unlock messages. */
const NOUN: Partial<Record<string, string>> = {
  [TableType.REGIONS]: 'a new area',
  [TableType.CHUNKS]: 'a new chunk',
  [TableType.MOBILITY]: 'a new mobility unlock',
  [TableType.ARCANA]: 'a new combat power',
  [TableType.POH]: 'a new housing option',
  [TableType.MERCHANTS]: 'a new merchant',
  [TableType.MINIGAMES]: 'a new minigame',
  [TableType.BOSSES]: 'a new boss',
  [TableType.STORAGE]: 'new storage',
  [TableType.GUILDS]: 'a new guild',
  [TableType.FARMING_LAYERS]: 'a new farming patch',
  [TableType.AGILITY_COURSES]: 'a new agility course',
  [TableType.SLAYER_UNLOCKS]: 'a new Slayer unlock',
  [TableType.BANKS]: 'a new bank',
};

/** One unlock to announce: what the reducer put on lastEvent, plus how it was paid for. */
export interface LevelUpUnlock {
  id: string;
  table: string;
  item: string;
  costType?: string;
}

export interface LevelUpMessage {
  line1: string;
  line2: string;
  icon: { src: string; alt: string; width: number; height: number };
  gem?: { src: string; alt: string };
}

/** The level-up message for an unlock, from the run's current unlocks. Pure. */
export const levelUpMessage = (unlock: LevelUpUnlock, unlocks: UnlockState): LevelUpMessage => {
  const { table, item } = unlock;
  const keyIcon = {
    src: `${BASE}osrs-ui/items/${KEY_SPRITE[unlock.costType ?? 'key'] ?? 'key.png'}`,
    alt: '', width: 72, height: 64,
  };
  const gemFor = (tier: number) => {
    const i = Math.max(0, Math.min(9, tier - 1));
    return { src: `${BASE}osrs-ui/gems/${GEMS[i]}.png`, alt: `Tier ${ROMAN[i]}, ${GEM_NAMES[i]}` };
  };

  if (table === TableType.SKILLS) {
    const tier = unlocks.skills?.[item] ?? 0;
    return {
      line1: `Congratulations, you’ve unlocked a new ${item} tier.`,
      line2: tier > 0 ? `${item} is now Tier ${ROMAN[Math.min(9, tier - 1)]}: methods up to level ${tierBand(tier).max}.` : `${item} is now unlocked.`,
      icon: { src: `${BASE}osrs-ui/skills/${item.toLowerCase()}.png`, alt: item, width: 50, height: 50 },
      gem: tier > 0 ? gemFor(tier) : undefined,
    };
  }
  if (table === TableType.EQUIPMENT) {
    const tier = unlocks.equipment?.[item] ?? 0;
    return {
      line1: `Congratulations, you’ve unlocked a new ${item} tier.`,
      line2: tier > 0 ? `${item} is now Tier ${ROMAN[Math.min(9, tier - 1)]}.` : `${item} is now unlocked.`,
      icon: keyIcon,
      gem: tier > 0 ? gemFor(tier) : undefined,
    };
  }
  const label = table === TableType.BANKS ? (BANK_BY_ID[item]?.name ?? item)
    : table === TableType.CHUNKS ? chunkLabel(item) : item;
  const noun = NOUN[table];
  const world = table === TableType.REGIONS || table === TableType.CHUNKS;
  return {
    line1: noun ? `Congratulations, you’ve unlocked ${noun}.` : `Congratulations, you’ve unlocked ${label}.`,
    line2: world ? `${label} is now part of your world.` : `${label} is now unlocked.`,
    icon: keyIcon,
  };
};

/** How the newest history entry for this unlock was paid for (Key, Omni-Key or Chaos Key). */
export const unlockCostType = (history: LogEntry[], item: string): string | undefined => {
  for (let i = history.length - 1; i >= 0 && i >= history.length - 50; i--) {
    const entry = history[i];
    if (entry.type === 'UNLOCK' && entry.meta?.item === item) return entry.meta?.costType;
  }
  return undefined;
};

/**
 * The OSRS level-up message box: fills the chatbox's parchment with the
 * unlock's icon, the "Congratulations" lines and "Click here to continue".
 * It shows after the unlock reveal has been accepted, so it never covers it.
 */
export const OsrsLevelUp: React.FC<{ message: LevelUpMessage; onContinue: () => void }> = ({ message, onContinue }) => {
  return (
    <div className="osrs-lvl" role="dialog" aria-label="Unlocked" aria-live="polite">
      <div className="osrs-lvl-side">
        <img className="osrs-px" src={message.icon.src} alt={message.icon.alt} width={message.icon.width} height={message.icon.height} />
      </div>
      <div className="osrs-lvl-text">
        <span style={{ color: '#000080' }}>{message.line1}</span>
        <span style={{ color: '#000000' }}>{message.line2}</span>
        <button type="button" className="osrs-lvl-cont" onClick={onContinue}>Click here to continue</button>
      </div>
      <div className="osrs-lvl-side">
        {message.gem && <img className="osrs-px" src={message.gem.src} alt={message.gem.alt} width={36} height={32} />}
      </div>
    </div>
  );
};

export default OsrsLevelUp;
