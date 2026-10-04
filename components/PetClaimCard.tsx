import React, { useMemo, useState } from 'react';
import { PETS, unclaimedPets, type Pet } from '../data/pets';
import { PET_SOURCES, petImageFile } from '../data/petSources';
import { OPEN_PETS_EVENT } from '../utils/petFollower';
import { PetPicker } from './PetPicker';
import { WikiIcon } from './WikiIcon';

const WIKI_IMG = 'https://oldschool.runescape.wiki/images/';

interface PetClaimCardProps {
  /** Pets the run has claimed already, by id. */
  claimed: readonly number[] | undefined;
  onClaim: (pet: Pet, e: React.MouseEvent) => void;
}

/**
 * A new pet: the player picks which one, and it gives an Omni-Key, once per
 * pet. It isn't a roll, so there's no chance to show and nothing to wait for.
 * Each pet counts once, so the claim asks the player to check the pet first.
 */
export const PetClaimCard: React.FC<PetClaimCardProps> = ({ claimed, onClaim }) => {
  const left = useMemo(() => unclaimedPets(claimed), [claimed]);
  const [chosen, setChosen] = useState('');
  const [confirming, setConfirming] = useState(false);
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
        ) : confirming && pet ? (
          <div role="group" aria-label="Check your pet" className="flex flex-col gap-1.5 rounded-md border border-[#a16207]/60 bg-black/60 p-2">
            <div className="flex items-center gap-2">
              <WikiIcon file={petImageFile(pet)} alt="" size={36} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-100">Claim an Omni-Key for {pet.name}?</p>
                {PET_SOURCES[pet.id] && <p className="text-[10px] text-gray-400">From {PET_SOURCES[pet.id].source}</p>}
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Each pet counts once, so check it’s the one you got.</p>
            <button
              type="button"
              onClick={(e) => {
                onClaim(pet, e);
                setChosen('');
                setConfirming(false);
              }}
              className="w-full rounded-md bg-[#a16207] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#ca8a04]"
            >
              Yes, I got {pet.name}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="w-full rounded-md px-3 py-1 text-[11px] text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Back
            </button>
          </div>
        ) : (
          // Stacked, so the picker keeps its width in the narrow two-column layout.
          <div className="flex flex-col gap-1.5">
            <PetPicker pets={left} value={pet ? chosen : ''} onChange={setChosen} label="The pet you got" />
            <button
              type="button"
              disabled={!pet}
              onClick={() => { if (pet) setConfirming(true); }}
              className="w-full rounded-md bg-[#a16207] px-3 py-1.5 text-[11px] font-bold text-white enabled:hover:bg-[#ca8a04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Claim Omni-Key
            </button>
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] text-gray-500">
            {PETS.length - left.length} of {PETS.length} pets claimed
          </p>
          {left.length < PETS.length && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_PETS_EVENT))}
              className="text-[10px] font-bold text-[#facc15] hover:underline"
            >
              Your pets
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
