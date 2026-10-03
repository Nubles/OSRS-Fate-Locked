import React, { useState } from 'react';
import { petById, unclaimedPets, type Pet } from '../data/pets';
import type { PetCompensationChoice, PetCompensationState } from '../types';

interface PetCompensationPanelProps {
  offer: PetCompensationState;
  /** Pets the run has claimed already, by id: they can't be named again. */
  claimed: readonly number[] | undefined;
  /** The Fate the 'gamble' choice gives for each Key it gives up: the mode's Void Gambit stake. */
  gambitStake: number;
  onResolve: (choice: PetCompensationChoice, pets: Pet[]) => void;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The one-time offer for a run that logged pets before a pet gave an Omni-Key.
 * The player names each earlier pet, so it counts once, then picks how to even
 * out the Standard Key each Key-only pet roll paid.
 */
export const PetCompensationPanel: React.FC<PetCompensationPanelProps> = ({
  offer,
  claimed,
  gambitStake,
  onResolve,
}) => {
  const total = offer.keyOnlyPets + offer.omniPets;
  const [named, setNamed] = useState<string[]>(() => Array.from({ length: total }, () => ''));
  const available = unclaimedPets(claimed);
  const complete = named.every((value) => value !== '');
  const pets = named.map((value) => petById(Number(value))).filter((pet): pet is Pet => pet !== undefined);
  const owed = offer.keyOnlyPets;
  const omniKeys = plural(owed, 'Omni-Key');
  const nextKeys = owed === 1 ? 'your next Standard Key goes' : `your next ${owed} Standard Keys go`;

  const choose = (choice: PetCompensationChoice) => {
    if (complete) onResolve(choice, pets);
  };

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-3">
      <h4 className="text-sm font-bold text-amber-200">Pets now give an Omni-Key</h4>
      <p className="mt-1 text-sm text-gray-300">
        Your run logged {plural(total, 'pet')} before this change. Name each one, so it counts once.
      </p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {named.map((value, index) => (
          <label key={index} className="flex items-center gap-2 text-xs text-gray-400">
            <span className="shrink-0">Pet {index + 1}</span>
            <select
              aria-label={`Earlier pet ${index + 1}`}
              value={value}
              onChange={(e) => setNamed((current) => current.map((old, i) => (i === index ? e.target.value : old)))}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/70 px-2 py-1.5 text-[11px] text-gray-200"
            >
              <option value="" disabled>Choose the pet…</option>
              {available
                .filter((pet) => String(pet.id) === value || !named.includes(String(pet.id)))
                .map((pet) => (
                  <option key={pet.id} value={pet.id}>{pet.name}</option>
                ))}
            </select>
          </label>
        ))}
      </div>
      {offer.omniPets > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          {offer.omniPets === 1
            ? '1 of them already brought an Omni-Key, so it needs nothing more.'
            : `${offer.omniPets} of them already brought an Omni-Key, so they need nothing more.`}
        </p>
      )}
      {owed > 0 ? (
        <>
          <p className="mt-2 text-xs text-gray-300">
            {owed === 1
              ? '1 of them paid a Standard Key and no Omni-Key. It earns an Omni-Key now. Choose what is fair for how you play:'
              : `${owed} of them paid a Standard Key and no Omni-Key. Each earns an Omni-Key now. Choose what is fair for how you play:`}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={!complete}
              onClick={() => choose('owe')}
              className="rounded-md border border-white/15 px-3 py-2 text-left text-xs text-gray-200 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="block font-semibold">Give up my next {owed === 1 ? 'Key' : 'Keys'}</span>
              <span className="mt-0.5 block text-[11px] text-gray-400">{omniKeys} now, and {nextKeys} to this.</span>
            </button>
            <button
              type="button"
              disabled={!complete}
              onClick={() => choose('gamble')}
              className="rounded-md border border-cyan-400/30 bg-cyan-950/30 px-3 py-2 text-left text-xs text-cyan-100 enabled:hover:bg-cyan-900/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="block font-semibold">Give up my next {owed === 1 ? 'Key' : 'Keys'} for Fate</span>
              <span className="mt-0.5 block text-[11px] text-cyan-200/70">
                {omniKeys} and {gambitStake * owed} Fate for a Void Gambit now, and {nextKeys} to this.
                A won roll resets Fate, so gamble before your next win.
              </span>
            </button>
            <button
              type="button"
              disabled={!complete}
              onClick={() => choose('free')}
              className="rounded-md bg-amber-600 px-3 py-2 text-left text-xs text-white enabled:hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="block font-bold">Just the {owed === 1 ? 'Omni-Key' : 'Omni-Keys'}</span>
              <span className="mt-0.5 block text-[11px] text-amber-50/80">{omniKeys}, and nothing else changes.</span>
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            disabled={!complete}
            onClick={() => choose('free')}
            className="rounded-md bg-amber-600 px-3 py-2 text-xs font-bold text-white enabled:hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save my pets
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">This choice is permanent and cannot be changed later.</p>
    </div>
  );
};
