import type { GameState } from '../types';
import { profileLifecycleMarkKey } from './lifecycleMark';
import type { RecoveryRepository } from './recoveryTypes';
import { resolveSaveRecovery } from './saveRecovery';
import { profileMirrorMetadataKey } from './storageRecovery';

/**
 * The newest saved progress for a profile, read while the app is running.
 *
 * The browser save (localStorage) is not always the newest copy. Browsers
 * commit it to disk lazily, so a crash loses its last writes, and once its
 * storage is full it stops updating altogether. The recovery journal keeps
 * every save in order, so this asks the same question startup asks
 * (utils/saveRecovery.ts) instead of trusting the browser save by itself.
 */
export type NewestDurableSave =
  | {
      kind: 'ready';
      state: GameState;
      /** False when the journal or the browser save is behind the other. */
      storesAgree: boolean;
    }
  /** Nothing has been saved for this profile. */
  | { kind: 'empty' }
  /** The copies disagree in a way startup would hand to the player. */
  | { kind: 'undecided' };

export interface NewestDurableSaveInput {
  profileId: string;
  storageKey: string;
  storage: Pick<Storage, 'getItem'>;
  repository: Pick<RecoveryRepository, 'getHead' | 'listCheckpoints'>;
  defaults: GameState;
}

export const readNewestDurableSave = async (
  input: NewestDurableSaveInput,
): Promise<NewestDurableSave> => {
  // The browser save first: the journal is always written before it, so a
  // save landing between these reads can only make the journal look newer.
  const primaryRaw = input.storage.getItem(input.storageKey);
  const mirrorMetadataRaw = input.storage.getItem(profileMirrorMetadataKey(input.storageKey));
  const lifecycleMarkRaw = input.storage.getItem(profileLifecycleMarkKey(input.storageKey));
  const [head, checkpoints] = await Promise.all([
    input.repository.getHead(input.profileId),
    input.repository.listCheckpoints(input.profileId),
  ]);
  const decision = await resolveSaveRecovery({
    profileId: input.profileId,
    // Unsaved changes in this tab are the caller's to weigh, not a saved copy.
    pendingRaw: null,
    primaryRaw,
    mirrorMetadataRaw,
    lifecycleMarkRaw,
    head,
    checkpoints,
    defaults: input.defaults,
  });
  if (decision.kind === 'empty') return { kind: 'empty' };
  if (decision.kind !== 'ready') return { kind: 'undecided' };
  return {
    kind: 'ready',
    state: decision.state,
    storesAgree: decision.source !== 'journal' && !decision.needsJournalImport,
  };
};
