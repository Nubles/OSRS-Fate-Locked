import React, { useRef, useState } from 'react';
import { petById, PETS } from '../data/pets';
import { PET_SOURCES, petImageFile } from '../data/petSources';
import { useIsOsrsUi } from '../utils/uiStyle';
import { OsrsTitleBar } from './osrs/OsrsWindowChrome';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { isStillPet, petModelUrl } from '../utils/petFollower';
import { EntityModel } from './EntityModel';

interface PetsPanelProps {
  claimed: readonly number[] | undefined;
  /** The pet that follows, or null with none claimed. */
  followerId: number | null;
  /** Whether the follower shows: the off switch. */
  followerShown: boolean;
  /** Pets idle and turn only with animations on. */
  animationsEnabled: boolean;
  onFollow: (petId: number) => void;
  onShowFollower: (shown: boolean) => void;
  onClose: () => void;
}

/** Every pet the run has claimed, each in 3D with its idle animation, and the follower's settings. */
export const PetsPanel: React.FC<PetsPanelProps> = ({
  claimed,
  followerId,
  followerShown,
  animationsEnabled,
  onFollow,
  onShowFollower,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useEscapeKey(onClose, true);
  const pets = (claimed ?? []).map((id) => petById(id)).filter((pet) => pet !== undefined);
  const [selectedId, setSelectedId] = useState<number | null>(followerId ?? pets[0]?.id ?? null);
  const selected = selectedId === null ? undefined : petById(selectedId);
  const osrs = useIsOsrsUi();

  if (osrs) {
    // OSRS layout: every pet in a grid like the collection log's All Pets
    // page. Claimed pets show their picture; the rest are dark silhouettes of
    // the same picture. Picking a claimed pet previews it as before.
    const claimedIds = new Set(pets.map((pet) => pet.id));
    const selectedClaimed = selected !== undefined && claimedIds.has(selected.id);
    const following = selected !== undefined && selected.id === followerId && followerShown;
    return (
      <div className="fixed inset-0 z-[120] owb-pets-backdrop">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="your-pets-title"
          tabIndex={-1}
          className="osrs-win owb-win owb-pets"
        >
          <OsrsTitleBar id="your-pets-title" title="Your Pets" onClose={onClose} />
          <div className="owb-pets-body">
            <section className="osrs-inner owb-pets-log">
              <div className="owb-pets-head">
                <span className="owb-pets-heading">All Pets</span>
                <span>{pets.length} of {PETS.length} pets claimed</span>
              </div>
              <ul className="owb-pets-grid" aria-label="All pets">
                {PETS.map((pet) => {
                  const isClaimed = claimedIds.has(pet.id);
                  return (
                    <li key={pet.id}>
                      <button
                        type="button"
                        data-pet-slot={isClaimed ? 'claimed' : 'unclaimed'}
                        aria-pressed={pet.id === selectedId}
                        aria-label={isClaimed ? pet.name : `${pet.name} (not claimed)`}
                        onClick={() => setSelectedId(pet.id)}
                        className="owb-pet-slot"
                      >
                        <img
                          src={`https://oldschool.runescape.wiki/images/${petImageFile(pet)}`}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                          loading="lazy"
                          className={isClaimed ? 'owb-pet-img' : 'owb-pet-img is-locked'}
                          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                        />
                        <span className="osrs-tooltip owb-pet-tip" aria-hidden="true">{pet.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="osrs-inner owb-pets-view">
              {pets.length === 0 && (selected === undefined || !selectedClaimed) && (
                <p className="owb-pets-note">No pets yet. Claim one in Farm Keys → Activities when it drops.</p>
              )}
              {selected && (
                <>
                  <div className="owb-pets-name">{selected.name}</div>
                  {selectedClaimed ? (
                    <>
                      <div className={`owb-pets-model ${animationsEnabled && isStillPet(selected.id) ? 'animate-pet-bob' : ''}`}>
                        <EntityModel
                          key={selected.id}
                          src={petModelUrl(selected.id)}
                          alt={selected.name}
                          fill
                          interactive
                          autoRotate={animationsEnabled}
                          spin={false}
                          cameraOrbit="35deg 75deg auto"
                        />
                      </div>
                      <button
                        type="button"
                        className="osrs-btn owb-pets-follow"
                        disabled={following}
                        onClick={() => onFollow(selected.id)}
                      >
                        {following ? `${selected.name} is following` : 'Make follower'}
                      </button>
                    </>
                  ) : (
                    <div className="owb-pets-locked">
                      <span>Not claimed yet.</span>
                      {PET_SOURCES[selected.id] && <span className="owb-dim">From: {PET_SOURCES[selected.id].source}</span>}
                    </div>
                  )}
                </>
              )}
              <label className="owb-check owb-pets-show">
                <input
                  type="checkbox"
                  checked={followerShown}
                  onChange={(e) => onShowFollower(e.target.checked)}
                />
                <span className="box" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5l3 3 5-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                </span>
                Show a follower
              </label>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="your-pets-title"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#4c462a] bg-[#171717] shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/10 bg-[#1e1e1e] p-4">
          <div className="min-w-0 flex-1">
            <h2 id="your-pets-title" className="text-lg font-bold text-[#facc15]">Your Pets</h2>
            <p className="text-xs text-gray-500">{pets.length} of {PETS.length} pets claimed</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </header>
        {pets.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">
            No pets yet. Claim one in Farm Keys → Activities when it drops.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:flex-row">
            <ul className="flex flex-wrap gap-1.5 sm:w-48 sm:flex-col sm:flex-nowrap" aria-label="Claimed pets">
              {pets.map((pet) => (
                <li key={pet.id}>
                  <button
                    type="button"
                    aria-pressed={pet.id === selectedId}
                    onClick={() => setSelectedId(pet.id)}
                    className={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs ${
                      pet.id === selectedId
                        ? 'border-[#a16207] bg-[#262314] text-[#facc15]'
                        : 'border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {pet.name}
                    {pet.id === followerId && followerShown && <span className="ml-1 text-[10px] text-gray-500">following</span>}
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
                <div
                  className={`h-64 w-full max-w-sm rounded-lg bg-black/40 ${
                    animationsEnabled && isStillPet(selected.id) ? 'animate-pet-bob' : ''
                  }`}
                >
                  <EntityModel
                    key={selected.id}
                    src={petModelUrl(selected.id)}
                    alt={selected.name}
                    fill
                    interactive
                    autoRotate={animationsEnabled}
                    spin={false}
                    cameraOrbit="35deg 75deg auto"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={selected.id === followerId && followerShown}
                    onClick={() => onFollow(selected.id)}
                    className="rounded-md bg-[#a16207] px-3 py-1.5 text-xs font-bold text-white enabled:hover:bg-[#ca8a04] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selected.id === followerId && followerShown ? `${selected.name} is following` : 'Make follower'}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={followerShown}
                      onChange={(e) => onShowFollower(e.target.checked)}
                    />
                    Show a follower
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
