import React, { useState } from 'react';
import { vanillaMinigameKeyStage, type KeyRollContext } from '../config/vanillaKeyEconomy';
import { MINIGAME_TIER_LABEL, MINIGAME_TIER_ORDER, minigameTier, type MinigameTier } from '../data/minigameKeyTiers';
import { TIER_STYLES, VanillaBossRollCard } from './ActionSection';

const MINIGAME_TIER_STYLE: Record<MinigameTier, typeof TIER_STYLES.GREEN> = {
  long: TIER_STYLES.PURPLE,
  standard: TIER_STYLES.BLUE,
  quick: TIER_STYLES.GREEN,
};

const MINIGAME_CAPPED_TEXT = 'This minigame no longer rolls for Keys or Fate. Its Collection Log items and pet still roll.';

type Props = {
  /** The run's unlocked minigames. */
  minigames: readonly string[];
  awarded: Readonly<Record<string, number>> | undefined;
  onRoll: (context: KeyRollContext, rate: number, e: React.MouseEvent) => void;
};

/** Vanilla's Activities cards: each unlocked minigame rolls from its own Key reserve, grouped by tier. */
export const VanillaMinigameRolls: React.FC<Props> = ({ minigames, awarded, onRoll }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = minigames.filter(name => name.toLowerCase().includes(q));

  return (
    <div className="mb-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your minigames…"
        aria-label="Search your minigames"
        className="w-full mb-3 bg-[#161616] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/25"
      />
      {MINIGAME_TIER_ORDER.map(tier => {
        const list = matches.filter(name => minigameTier(name) === tier);
        if (list.length === 0) return null;
        const style = MINIGAME_TIER_STYLE[tier];
        return (
          <div key={tier} className="mb-3">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>{MINIGAME_TIER_LABEL[tier]}</span>
              <span className="text-[9px] font-mono text-gray-500">{list.length}</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {list.map(name => {
                const stage = vanillaMinigameKeyStage(name, awarded?.[name] ?? 0);
                return (
                  <VanillaBossRollCard
                    key={name}
                    name={name}
                    displayRate={stage.currentRate ?? 0}
                    style={style}
                    stage={stage}
                    cappedText={MINIGAME_CAPPED_TEXT}
                    onClick={(e) => onRoll({ kind: 'minigame', minigameName: name, minigameTier: tier }, stage.currentRate ?? 0, e)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {minigames.length === 0 ? (
        <div className="text-center text-gray-600 text-xs py-6">Unlock a minigame from the Minigames table to give it a Key stash.</div>
      ) : matches.length === 0 && (
        <div className="text-center text-gray-600 text-xs py-6">No minigames match “{query}”.</div>
      )}
    </div>
  );
};
