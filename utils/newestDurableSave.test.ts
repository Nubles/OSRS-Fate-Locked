import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { serializeCurrent } from './gamePersistence';
import { createLifecycleMark, profileLifecycleMarkKey } from './lifecycleMark';
import { readNewestDurableSave } from './newestDurableSave';
import type { RecoveryCheckpoint, RecoveryHead } from './recoveryTypes';
import { checksumSave } from './saveIntegrity';
import { profileMirrorMetadataKey } from './storageRecovery';

const PROFILE = 'newest-save';
const KEY = `FATE_PROFILE_${PROFILE}`;
const defaults = createFreshState();
const run = (note: string) => ({ ...structuredClone(defaults), userNotes: { goal: note } });

const headFor = async (note: string, persistenceRevision: number): Promise<RecoveryHead> => {
  const state = run(note);
  const data = serializeCurrent(state);
  return {
    profileId: PROFILE,
    persistenceRevision,
    runId: state.runId,
    runRevision: state.runRevision,
    capturedAt: persistenceRevision * 100,
    checksum: await checksumSave(data),
    data,
  };
};

/** The browser's copy of a journal record: the save and its sidecar. */
const browserCopy = (record: RecoveryHead, sidecar = true): Map<string, string> => {
  const values = new Map<string, string>([[KEY, record.data]]);
  if (sidecar) {
    values.set(profileMirrorMetadataKey(KEY), JSON.stringify({
      version: 1,
      persistenceRevision: record.persistenceRevision,
      capturedAt: record.capturedAt,
      checksum: record.checksum,
    }));
  }
  return values;
};

const read = (
  values: Map<string, string>,
  head: RecoveryHead | null,
  checkpoints: RecoveryCheckpoint[] = [],
) => readNewestDurableSave({
  profileId: PROFILE,
  storageKey: KEY,
  storage: { getItem: key => values.get(key) ?? null },
  repository: {
    getHead: async () => head,
    listCheckpoints: async () => checkpoints,
  },
  defaults,
});

describe('the newest saved progress, read while the app is running', () => {
  it('is the journal\'s when the browser save is an older copy', async () => {
    // A crash lost the browser's last writes, or its storage was full.
    const older = await headFor('older copy', 5);
    const newest = await headFor('newest', 8);

    const result = await read(browserCopy(older), newest);

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.state.userNotes.goal).toBe('newest');
    expect(result.storesAgree).toBe(false);
  });

  it('is the journal\'s when the browser save is gone', async () => {
    const result = await read(new Map(), await headFor('only in the journal', 3));

    expect(result).toMatchObject({ kind: 'ready', storesAgree: false });
    expect(result.kind === 'ready' && result.state.userNotes.goal).toBe('only in the journal');
  });

  it('reports the copies as agreeing when they hold the same save', async () => {
    const saved = await headFor('saved', 4);

    const result = await read(browserCopy(saved), saved);

    expect(result).toMatchObject({ kind: 'ready', storesAgree: true });
    expect(result.kind === 'ready' && result.state.userNotes.goal).toBe('saved');
  });

  it('is the browser save when leaving the page wrote it after the journal', async () => {
    const journal = await headFor('last full save', 6);
    const leaving = serializeCurrent(run('changed just before leaving'));
    const values = browserCopy(journal);
    values.set(KEY, leaving);
    values.set(profileLifecycleMarkKey(KEY), createLifecycleMark(leaving));

    const result = await read(values, journal);

    expect(result).toMatchObject({ kind: 'ready', storesAgree: false });
    expect(result.kind === 'ready' && result.state.userNotes.goal).toBe('changed just before leaving');
  });

  it('is the browser save when there is no journal to order it', async () => {
    const saved = await headFor('browser only', 2);

    const result = await read(browserCopy(saved), null);

    expect(result).toMatchObject({ kind: 'ready', storesAgree: false });
    expect(result.kind === 'ready' && result.state.userNotes.goal).toBe('browser only');
  });

  it('leaves a browser save it cannot place against the journal to the player', async () => {
    // Different from the journal, with nothing to say which came first.
    const journal = await headFor('journal', 6);
    const unplaced = await headFor('written by something else', 6);

    expect(await read(browserCopy(unplaced, false), journal)).toEqual({ kind: 'undecided' });
  });

  it('is empty when nothing was ever saved', async () => {
    expect(await read(new Map(), null)).toEqual({ kind: 'empty' });
  });
});
