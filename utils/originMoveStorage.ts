import type { Profile, ProfileMetadata } from '../types';
import { PROFILES_KEY, parseProfileMetadata } from './profileMetadata';
import {
  initializeProfileMetadata,
  mutateProfileMetadata,
  type ProfileTransactionDependencies,
} from './profileMetadataTransaction';
import { profileBaseKey, profileOwnedKeys } from './profileStorage';
import type { SaveRecoveryDecision, SaveRecoveryInput } from './saveRecovery';
import type { RecoveryRepository } from './recoveryTypes';
import type { GameState } from '../types';
import {
  copyName,
  unmovedOutcome,
  type ExistingRun,
  type MoveOutcome,
  type MovePlanItem,
  type MoveProfile,
  type MoveSkipped,
} from './originMove';

/**
 * The storage half of the address move (utils/originMove.ts has the
 * protocol): reading every run on the old address, and adding the chosen ones
 * on the new address through the normal profile transactions.
 */

/** How the old address reads a profile's save: the same pieces startup reads (components/SaveBootstrap.tsx). */
export interface MoveCollectDependencies {
  createFreshState: () => GameState;
  readPending: (storageKey: string) => string | null;
  readPrimary: (storageKey: string) => string | null;
  readMirrorMetadata: (storageKey: string) => string | null;
  readLifecycleMark?: (storageKey: string) => string | null;
  openRepository: (profileId: string) => RecoveryRepository | PromiseLike<RecoveryRepository>;
  resolveSaveRecovery: (input: SaveRecoveryInput) => SaveRecoveryDecision | PromiseLike<SaveRecoveryDecision>;
}

/**
 * Every profile's current save, decided the way startup decides it. The open
 * profile sends what is on screen (`activeData`). A profile whose save needs
 * the player to choose (the recovery screen) is not sent: the player opens it
 * once here, then moves again.
 */
export const collectMoveProfiles = async (
  profiles: readonly Profile[],
  activeProfileId: string,
  activeData: string | null,
  deps: MoveCollectDependencies,
): Promise<{ profiles: MoveProfile[]; skipped: MoveSkipped[] }> => {
  const sent: MoveProfile[] = [];
  const skipped: MoveSkipped[] = [];
  for (const profile of profiles) {
    const base = { id: profile.id, name: profile.name };
    const active = profile.id === activeProfileId;
    if (active && activeData !== null) {
      sent.push({ ...base, createdAt: profile.createdAt, active, data: activeData });
      continue;
    }
    const storageKey = profileBaseKey(profile.id);
    let repository: RecoveryRepository | null = null;
    try {
      repository = await deps.openRepository(profile.id);
      const [head, checkpoints] = await Promise.all([
        repository.getHead(profile.id),
        repository.listCheckpoints(profile.id),
      ]);
      const decision = await deps.resolveSaveRecovery({
        profileId: profile.id,
        pendingRaw: deps.readPending(storageKey),
        primaryRaw: deps.readPrimary(storageKey),
        mirrorMetadataRaw: deps.readMirrorMetadata(storageKey),
        lifecycleMarkRaw: deps.readLifecycleMark?.(storageKey) ?? null,
        head,
        checkpoints,
        defaults: deps.createFreshState(),
      });
      if (decision.kind === 'ready') sent.push({ ...base, createdAt: profile.createdAt, active, data: decision.data });
      else if (decision.kind === 'empty') skipped.push({ ...base, reason: 'empty' });
      else skipped.push({ ...base, reason: decision.kind === 'unsupported' ? 'unsupported' : 'needs_recovery' });
    } catch {
      skipped.push({ ...base, reason: 'unreadable' });
    } finally {
      try {
        repository?.close();
      } catch {
        // Closing is best-effort.
      }
    }
  }
  return { profiles: sent, skipped };
};

type StorageReader = Pick<Storage, 'getItem'>;

/** The runs the new address already has, from each profile's browser save. */
export const readExistingRuns = (
  storage: StorageReader,
  runIdOf: (data: string) => string | null,
): ExistingRun[] => {
  let raw: string | null;
  try {
    raw = storage.getItem(PROFILES_KEY);
  } catch {
    return [];
  }
  const parsed = parseProfileMetadata(raw);
  if (parsed.status !== 'current' && parsed.status !== 'legacy') return [];
  return parsed.metadata.profiles.map(profile => {
    let data: string | null = null;
    try {
      data = storage.getItem(profileBaseKey(profile.id));
    } catch {
      data = null;
    }
    return { profileId: profile.id, name: profile.name, runId: data === null ? null : runIdOf(data) };
  });
};

const hasAnyOwnedKey = (storage: ProfileTransactionDependencies['storage'], profileId: string): boolean =>
  profileOwnedKeys(profileId).some(key => storage.getItem(key) !== null);

const removeIfOurs = (storage: ProfileTransactionDependencies['storage'], key: string, data: string): void => {
  try {
    if (storage.getItem(key) === data) storage.removeItem(key);
  } catch {
    // Left behind, the save shows up as a recovered profile: nothing is lost.
  }
};

/** Removes the empty profile the registry made for a fresh address. Best-effort: at worst it stays. */
const removeStarter = async (
  deps: ProfileTransactionDependencies,
  starterId: string,
): Promise<ProfileMetadata | null> => {
  try {
    if (deps.storage.getItem(profileBaseKey(starterId)) !== null) return null;
    const removed = await mutateProfileMetadata(deps, { type: 'delete', profileId: starterId });
    return removed.ok ? removed.metadata : null;
  } catch {
    return null;
  }
};

/**
 * Adds the chosen runs on the new address. Each save is written to a profile
 * id nothing here uses, then the profile is registered with the normal
 * transaction (locks, revisions, verification). Nothing already here is
 * written over. If this address had no profiles before, the empty starter
 * profile the registry creates is removed again so the moved runs keep every
 * slot. The profile that was open on the old address opens here.
 */
export const applyMovePlan = async (
  deps: ProfileTransactionDependencies,
  items: readonly MovePlanItem[],
): Promise<MoveOutcome[]> => {
  const { storage } = deps;
  let fresh = false;
  try {
    fresh = storage.getItem(PROFILES_KEY) === null
      && Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .every(key => key === null || !key.startsWith('FATE_PROFILE_'));
  } catch {
    fresh = false;
  }
  const init = await initializeProfileMetadata(deps);
  if (!init.ok) return items.map(item => ({ sourceId: item.source.id, outcome: item.choice === 'skip' ? unmovedOutcome(item) : 'failed' }));
  let starterId = fresh && init.metadata.profiles.length === 1 ? init.metadata.activeProfileId : null;
  let metadata = init.metadata;

  const outcomes: MoveOutcome[] = [];
  let activeTarget: string | null = null;
  let firstTarget: string | null = null;
  for (const item of items) {
    const sourceId = item.source.id;
    if (item.status === 'invalid' || item.choice === 'skip' || !item.choices.includes(item.choice)) {
      outcomes.push({ sourceId, outcome: unmovedOutcome(item) });
      continue;
    }
    const taken = (id: string) => metadata.profiles.some(profile => profile.id === id)
      || metadata.deletions.some(deletion => deletion.profileId === id)
      || hasAnyOwnedKey(storage, id);
    let targetId = sourceId;
    try {
      for (let attempt = 0; taken(targetId); attempt += 1) {
        if (attempt >= 5) throw new Error('no free profile id');
        targetId = deps.createProfileId();
      }
    } catch {
      outcomes.push({ sourceId, outcome: 'failed' });
      continue;
    }
    const key = profileBaseKey(targetId);
    try {
      storage.setItem(key, item.source.data);
    } catch {
      outcomes.push({ sourceId, outcome: 'failed' });
      continue;
    }
    const profile: Profile = {
      id: targetId,
      name: item.choice === 'copy' ? copyName(item.source.name) : item.source.name,
      createdAt: item.source.createdAt,
    };
    const created = await mutateProfileMetadata(deps, { type: 'create', profile });
    if (!created.ok) {
      removeIfOurs(storage, key, item.source.data);
      outcomes.push({ sourceId, outcome: 'failed' });
      continue;
    }
    metadata = created.metadata;
    outcomes.push({ sourceId, outcome: item.choice === 'copy' ? 'kept_both' : 'moved' });
    firstTarget ??= targetId;
    if (item.source.active) activeTarget = targetId;
    // The starter goes as soon as a moved run is open instead, so it never takes a slot.
    if (starterId !== null) {
      metadata = await removeStarter(deps, starterId) ?? metadata;
      starterId = null;
    }
  }

  const open = activeTarget ?? firstTarget;
  if (open !== null) {
    const selected = await mutateProfileMetadata(deps, { type: 'select', profileId: open });
    if (selected.ok) metadata = selected.metadata;
  }
  return outcomes;
};
