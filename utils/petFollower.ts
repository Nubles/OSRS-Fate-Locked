import { STILL_PET_MODELS } from '../data/petModels';

/**
 * A claimed pet's 3D model, exported with its idle animation (scripts/export-models.mjs
 * --pets). The site is served under a sub-path, so the URL takes Vite's base.
 */
export const petModelUrl = (petId: number): string =>
  `${import.meta.env.BASE_URL || '/'}models/pets/${petId}.gltf`;

const STILL = new Set(STILL_PET_MODELS);

/** A pet whose model has no idle animation: the app bobs it gently instead. */
export const isStillPet = (petId: number): boolean => STILL.has(petId);

/** The player's follower choice for one run, kept in this browser. */
export interface FollowerPrefs {
  /** Off switch: the player hid the follower. */
  hidden?: boolean;
  /** The pet that follows; the most recently claimed one when unset or no longer claimed. */
  petId?: number;
}

const key = (runId: string) => `fate-locked:pet-follower:${runId}`;

export const readFollowerPrefs = (runId: string): FollowerPrefs => {
  try {
    const raw = localStorage.getItem(key(runId));
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...(parsed?.hidden === true ? { hidden: true } : {}),
      ...(Number.isSafeInteger(parsed?.petId) ? { petId: parsed.petId } : {}),
    };
  } catch {
    return {};
  }
};

export const writeFollowerPrefs = (runId: string, prefs: FollowerPrefs): void => {
  try {
    localStorage.setItem(key(runId), JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
};

/** The pet that follows: the chosen one if it's still claimed, else the most recently claimed. */
export const followerPetId = (claimed: readonly number[] | undefined, prefs: FollowerPrefs): number | null => {
  if (!claimed?.length) return null;
  return prefs.petId !== undefined && claimed.includes(prefs.petId) ? prefs.petId : claimed[claimed.length - 1];
};

/** The window event that opens the Your Pets panel from anywhere (the New Pet card). */
export const OPEN_PETS_EVENT = 'fate:open-pets';
