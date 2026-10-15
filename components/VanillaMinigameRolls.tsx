import React, { useState } from 'react';
import { minigameMissPaysFate, MINIGAME_MISS_FATE_MIN_RATE, vanillaMinigameKeyStage, type KeyRollContext } from '../config/vanillaKeyEconomy';
import { MINIGAME_KEY_RESERVES } from '../data/minigameKeyReserves';
import { TIER_STYLES, VanillaBossRollCard } from './ActionSection';

const MINIGAME_CAPPED_TEXT = 'This minigame no longer rolls for Keys or Fate. Its Collection Log items and pet still roll.';

type Props = {
  /** The run's unlocked minigames. */
  minigames: readonly string[];
  awarded: Readonly<Record<string, number>> | undefined;
  onRoll: (context: KeyRollContext, rate: number, e: React.MouseEvent) => void;
};

/** Vanilla's Activities cards: each unlocked minigame rolls from its own Key reserve. */
export const VanillaMinigameRolls: React.FC<Props> = ({ minigames, awarded, onRoll }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = minigames
    .filter(name => name.toLowerCase().includes(q))
    .sort((left, right) => left.localeCompare(right));

  return (
    <div className="mb-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your minigames…"
        aria-label="Search your minigames"
        className="w-full mb-3 bg-[#161616] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/25"
      />
      {matches.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {matches.map(name => {
            const stage = vanillaMinigameKeyStage(name, awarded?.[name] ?? 0);
            const noKeys = MINIGAME_KEY_RESERVES[name]?.noKeys;
            const rate = stage.currentRate ?? 0;
            const note = !stage.capped && !minigameMissPaysFate(rate)
              ? `Misses give no Fate under ${MINIGAME_MISS_FATE_MIN_RATE}%.`
              : undefined;
            return (
              <VanillaBossRollCard
                key={name}
                name={name}
                displayRate={rate}
                style={TIER_STYLES.BLUE}
                stage={stage}
                note={note}
                cappedText={noKeys ?? MINIGAME_CAPPED_TEXT}
                onClick={(e) => onRoll({ kind: 'minigame', minigameName: name }, rate, e)}
              />
            );
          })}
        </div>
      )}
      {minigames.length === 0 ? (
        <div className="text-center text-gray-600 text-xs py-6">Unlock a minigame from the Minigames table to give it a Key stash.</div>
      ) : matches.length === 0 && (
        <div className="text-center text-gray-600 text-xs py-6">No minigames match “{query}”.</div>
      )}
    </div>
  );
};
