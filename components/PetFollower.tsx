import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { petById } from '../data/pets';
import {
  followerPetId,
  isStillPet,
  OPEN_PETS_EVENT,
  petModelUrl,
  readFollowerPrefs,
  writeFollowerPrefs,
  type FollowerPrefs,
} from '../utils/petFollower';
import { EntityModel } from './EntityModel';
import { lazyWithRetry } from '../utils/lazyRetry';

const PetsPanel = lazyWithRetry(() => import('./PetsPanel').then(m => ({ default: m.PetsPanel })));

interface PetFollowerViewProps {
  runId: string;
  claimed: readonly number[] | undefined;
  animationsEnabled: boolean;
}

/**
 * The follower: one claimed pet idling in the bottom-left corner, as in game. It has an
 * off switch (its own ×, and Show a follower in Your Pets), and with the tracker's
 * animations off it stands still. Clicks pass through it; its name tag opens Your Pets.
 */
export const PetFollowerView: React.FC<PetFollowerViewProps> = ({ runId, claimed, animationsEnabled }) => {
  const [prefs, setPrefs] = useState<FollowerPrefs>(() => readFollowerPrefs(runId));
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => { setPrefs(readFollowerPrefs(runId)); }, [runId]);
  useEffect(() => {
    const open = () => setPanelOpen(true);
    window.addEventListener(OPEN_PETS_EVENT, open);
    return () => window.removeEventListener(OPEN_PETS_EVENT, open);
  }, []);

  const save = (next: FollowerPrefs) => {
    setPrefs(next);
    writeFollowerPrefs(runId, next);
  };

  const petId = followerPetId(claimed, prefs);
  const pet = petId === null ? undefined : petById(petId);
  // As the boss models do, pets follow the tracker's own Animations setting.
  const moving = animationsEnabled;

  return (
    <>
      {pet && !prefs.hidden && (
        // Clicks pass through the pet to the page beneath; only its name tag takes them.
        <div className="pointer-events-none fixed bottom-2 left-2 z-40 flex w-24 flex-col items-center" data-testid="pet-follower">
          <div className={`h-16 w-16 sm:h-24 sm:w-24 ${moving && isStillPet(pet.id) ? 'animate-pet-bob' : ''}`}>
            <EntityModel
              src={petModelUrl(pet.id)}
              alt={pet.name}
              fill
              autoRotate={moving}
              spin={false}
              cameraOrbit="35deg 75deg auto"
            />
          </div>
          <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-gray-300">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label={`${pet.name}, your follower: open Your Pets`}
              className="truncate font-bold text-[#facc15] hover:underline"
            >
              {pet.name}
            </button>
            <button
              type="button"
              onClick={() => save({ ...prefs, hidden: true })}
              aria-label="Hide your follower"
              title="Hide your follower (Your Pets shows it again)"
              className="shrink-0 px-0.5 text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {panelOpen && (
        <React.Suspense fallback={null}>
          <PetsPanel
            claimed={claimed}
            followerId={petId}
            followerShown={!prefs.hidden}
            animationsEnabled={moving}
            onFollow={(id) => save({ ...prefs, petId: id, hidden: false })}
            onShowFollower={(shown) => save({ ...prefs, hidden: !shown })}
            onClose={() => setPanelOpen(false)}
          />
        </React.Suspense>
      )}
    </>
  );
};

/** The follower for the run in play. App mounts it lazily once the run has claimed a pet. */
export const PetFollower: React.FC = () => {
  const { runId, petsClaimed, animationsEnabled } = useGame();
  return <PetFollowerView runId={runId} claimed={petsClaimed} animationsEnabled={animationsEnabled !== false} />;
};

export default PetFollower;
