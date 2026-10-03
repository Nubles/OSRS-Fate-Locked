import React, { useMemo, useState } from 'react';
import { PETS, unclaimedPets, type Pet } from '../data/pets';

const WIKI_IMG = 'https://oldschool.runescape.wiki/images/';

interface PetClaimCardProps {
  /** Pets the run has claimed already, by id. */
  claimed: readonly number[] | undefined;
  onClaim: (pet: Pet, e: React.MouseEvent) => void;
}

/**
 * A new pet: the player picks which one, and it gives an Omni-Key, once per
 * pet. It isn't a roll, so there's no chance to show and nothing to wait for.
 */
export const PetClaimCard: React.FC<PetClaimCardProps> = ({ claimed, onClaim }) => {
  const left = useMemo(() => unclaimedPets(claimed), [claimed]);
  const [chosen, setChosen] = useState('');
  const pet = left.find((candidate) => String(candidate.id) === chosen);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border-2 border-[#4c462a] bg-[#262314] p-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
      <img
        src={`${WIKI_IMG}Vorki.png`}
        alt=""
        className="pointer-events-none absolute -right-2 -bottom-2 h-[90%] w-auto object-contain opacity-30 grayscale"
      />
      <div className="relative z-10">
        <h3 className="text-base font-black uppercase tracking-wider text-[#facc15] drop-shadow-md">New Pet</h3>
        <p className="mb-2 text-[10px] font-mono text-gray-400">An Omni-Key for each new pet, once per pet.</p>
        {left.length === 0 ? (
          <p className="text-[11px] text-[#facc15]/80">Every pet is claimed.</p>
        ) : (
          // Stacked, so the list keeps its width in the narrow two-column layout.
          <div className="flex flex-col gap-1.5">
            <select
              aria-label="The pet you got"
              value={pet ? chosen : ''}
              onChange={(e) => setChosen(e.target.value)}
              className="w-full rounded-md border border-[#4c462a] bg-black/70 px-2 py-1.5 text-[11px] text-gray-200"
            >
              <option value="" disabled>Choose the pet you got…</option>
              {left.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!pet}
              onClick={(e) => {
                if (!pet) return;
                onClaim(pet, e);
                setChosen('');
              }}
              className="w-full rounded-md bg-[#a16207] px-3 py-1.5 text-[11px] font-bold text-white enabled:hover:bg-[#ca8a04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Claim Omni-Key
            </button>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-gray-500">
          {PETS.length - left.length} of {PETS.length} pets claimed
        </p>
      </div>
    </div>
  );
};
