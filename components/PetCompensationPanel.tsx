import React, { useState } from 'react';
import { petById, unclaimedPets, type Pet } from '../data/pets';
import type { PetCompensationChoice, PetCompensationState } from '../types';

/** A row's value for a roll that was not a new pet: a duplicate, a mistake, or one the player can't remember. */
const NOT_A_PET = 'none';

interface PetCompensationPanelProps {
  offer: PetCompensationState;
  /** Pets the run has claimed already, by id: they can't be named again. */
  claimed: readonly number[] | undefined;
  /** The Fate the 'gamble' choice gives for each Key it gives up: the mode's Void Gambit stake. */
  gambitStake: number;
  /** When each earlier roll was made, oldest first, to help the player tell them apart. */
  rollTimes?: { keyOnly: readonly number[]; omni: readonly number[] };
  onResolve: (choice: PetCompensationChoice, keyOnly: Array<Pet | null>, omni: Array<Pet | null>) => void;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const dateOf = (timestamp: number | undefined): string | null =>
  timestamp === undefined ? null : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(timestamp);

/**
 * The one-time offer for a run that logged pets before a pet gave an Omni-Key.
 * The player says what each earlier roll was, a pet or not a new pet, so each
 * pet counts once; then, if any roll that paid only a Key was a new pet, picks
 * how to even out the Key it paid. Every row can be "not a new pet", so the
 * offer can always be settled and What's New never traps the player.
 */
export const PetCompensationPanel: React.FC<PetCompensationPanelProps> = ({
  offer,
  claimed,
  gambitStake,
  rollTimes,
  onResolve,
}) => {
  const total = offer.keyOnlyPets + offer.omniPets;
  const [rows, setRows] = useState<string[]>(() => Array.from({ length: total }, () => ''));
  const available = unclaimedPets(claimed);
  const complete = rows.every((value) => value !== '');
  const pick = (value: string): Pet | null => (value === NOT_A_PET ? null : petById(Number(value)) ?? null);
  const keyOnly = rows.slice(0, offer.keyOnlyPets).map(pick);
  const omni = rows.slice(offer.keyOnlyPets).map(pick);
  const earned = keyOnly.filter((pet) => pet !== null).length;
  const times = rollTimes
    && rollTimes.keyOnly.length === offer.keyOnlyPets
    && rollTimes.omni.length === offer.omniPets
    ? [...rollTimes.keyOnly, ...rollTimes.omni]
    : [];
  const omniKeys = plural(earned, 'Omni-Key');
  const nextKeys = earned === 1 ? 'your next Standard Key goes' : `your next ${earned} Standard Keys go`;

  const choose = (choice: PetCompensationChoice) => {
    if (complete) onResolve(choice, keyOnly, omni);
  };

  const row = (index: number) => {
    const value = rows[index];
    const date = dateOf(times[index]);
    const brought = index < offer.keyOnlyPets ? 'paid a Key' : 'paid a Key and an Omni-Key';
    return (
      <label key={index} className="flex flex-col gap-1 text-xs text-gray-400">
        <span>Pet roll {index + 1}{date ? `, ${date}` : ''}: {brought}</span>
        <select
          aria-label={`Earlier pet ${index + 1}`}
          value={value}
          onChange={(e) => setRows((current) => current.map((old, i) => (i === index ? e.target.value : old)))}
          className="w-full rounded-md border border-white/10 bg-black/70 px-2 py-1.5 text-[11px] text-gray-200"
        >
          <option value="" disabled>Choose the pet…</option>
          <option value={NOT_A_PET}>Not a new pet (a duplicate, a mistake, or I can’t remember)</option>
          {available
            .filter((pet) => String(pet.id) === value || !rows.includes(String(pet.id)))
            .map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name}</option>
            ))}
        </select>
      </label>
    );
  };

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-3">
      <h4 className="text-sm font-bold text-amber-200">Pets now give an Omni-Key</h4>
      <p className="mt-1 text-sm text-gray-300">
        Your run logged {plural(total, 'pet roll')} before this change. Say which pet each was, so it counts
        once. Choose “Not a new pet” for a duplicate, a mistake, or one you can’t remember: it keeps its Key and
        earns nothing more.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((_, index) => row(index))}
      </div>
      {complete && earned > 0 ? (
        <>
          <p className="mt-2 text-xs text-gray-300">
            {earned === 1
              ? '1 roll paid a Key for a new pet, with no Omni-Key. It earns an Omni-Key now. Choose what is fair for how you play:'
              : `${earned} rolls paid a Key for a new pet, with no Omni-Key. Each earns an Omni-Key now. Choose what is fair for how you play:`}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => choose('owe')}
              className="rounded-md border border-white/15 px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/5"
            >
              <span className="block font-semibold">Give up my next {earned === 1 ? 'Key' : 'Keys'}</span>
              <span className="mt-0.5 block text-[11px] text-gray-400">{omniKeys} now, and {nextKeys} to this.</span>
            </button>
            <button
              type="button"
              onClick={() => choose('gamble')}
              className="rounded-md border border-cyan-400/30 bg-cyan-950/30 px-3 py-2 text-left text-xs text-cyan-100 hover:bg-cyan-900/30"
            >
              <span className="block font-semibold">Give up my next {earned === 1 ? 'Key' : 'Keys'} for Fate</span>
              <span className="mt-0.5 block text-[11px] text-cyan-200/70">
                {omniKeys} and {gambitStake * earned} Fate for a Void Gambit now, and {nextKeys} to this.
                A won roll resets Fate, so gamble before your next win.
              </span>
            </button>
            <button
              type="button"
              onClick={() => choose('free')}
              className="rounded-md bg-amber-600 px-3 py-2 text-left text-xs text-white hover:bg-amber-500"
            >
              <span className="block font-bold">Just the {earned === 1 ? 'Omni-Key' : 'Omni-Keys'}</span>
              <span className="mt-0.5 block text-[11px] text-amber-50/80">{omniKeys}, and nothing else changes.</span>
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!complete}
            onClick={() => choose('free')}
            className="rounded-md bg-amber-600 px-3 py-2 text-xs font-bold text-white enabled:hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save my pets
          </button>
          {!complete && (
            <span className="text-xs text-gray-400">
              {offer.keyOnlyPets > 0
                ? 'Answer each pet roll, then choose how to even it out.'
                : 'Answer each pet roll.'}
            </span>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">This choice is permanent and cannot be changed later.</p>
    </div>
  );
};
