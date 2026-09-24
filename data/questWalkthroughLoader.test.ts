import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadQuestStrategyCatalogue,
  loadQuestStrategyFor,
  loadQuestWalkthroughFor,
} from './questWalkthroughLoader';
import { publicQuestWalkthroughReleaseFor } from './questWalkthroughPublicRelease';
import { questWalkthroughReleaseFor } from './questWalkthroughRelease';

// Each guide catalogue is its own production chunk. These mocks fail a
// catalogue's next loads the way a dropped fetch or a mid-deploy 404 does.
const chunks = vi.hoisted(() => {
  const failures = new Map<string, number>();
  const attempts = new Map<string, number>();
  return {
    failures,
    attempts,
    load: async <T>(id: string, importOriginal: () => Promise<T>): Promise<T> => {
      attempts.set(id, (attempts.get(id) ?? 0) + 1);
      const remaining = failures.get(id) ?? 0;
      if (remaining > 0) {
        failures.set(id, remaining - 1);
        throw new TypeError(`Failed to fetch dynamically imported module: /assets/${id}-stale.js`);
      }
      return importOriginal();
    },
  };
});

/** Registers fresh catalogue mocks so every test fetches its chunks again. */
const mockCatalogueChunks = () => {
  vi.doMock('./questWalkthroughs.public', importOriginal => (
    chunks.load('questWalkthroughs.public', importOriginal)
  ));
  vi.doMock('./questWalkthroughs.preview-boundary', importOriginal => (
    chunks.load('questWalkthroughs.preview-boundary', importOriginal)
  ));
  vi.doMock('./questWalkthroughs', importOriginal => (
    chunks.load('questWalkthroughs', importOriginal)
  ));
};

// Captured before fake timers are installed so module loading keeps its real I/O.
const realSetTimeout = globalThis.setTimeout;

/** Skips importWithRetry's back-off waits. */
const settle = async <T>(pending: Promise<T>): Promise<T> => {
  let settled = false;
  pending.then(() => { settled = true; }, () => { settled = true; });
  while (!settled) {
    await new Promise(resolve => realSetTimeout(resolve, 0));
    if (vi.getTimerCount() > 0) await vi.advanceTimersToNextTimerAsync();
  }
  return pending;
};

const publicCookRelease = publicQuestWalkthroughReleaseFor("Cook's Assistant")!;
const previewCookRelease = questWalkthroughReleaseFor("Cook's Assistant")!;

beforeEach(() => {
  vi.resetModules();
  mockCatalogueChunks();
  chunks.failures.clear();
  chunks.attempts.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('quest walkthrough loader chunk failures', () => {
  it.each([
    ['public strategy catalogue', 'questWalkthroughs.public', () => loadQuestStrategyCatalogue('PUBLIC')],
    ['public walkthrough', 'questWalkthroughs.public', () => loadQuestWalkthroughFor('PUBLIC', publicCookRelease)],
    ['public strategy', 'questWalkthroughs.public', () => loadQuestStrategyFor('PUBLIC', publicCookRelease)],
    ['preview strategy catalogue', 'questWalkthroughs.preview-boundary', () => loadQuestStrategyCatalogue('PREVIEW')],
    ['preview walkthrough', 'questWalkthroughs.preview-boundary', () => loadQuestWalkthroughFor('PREVIEW', publicCookRelease)],
    ['preview strategy', 'questWalkthroughs.preview-boundary', () => loadQuestStrategyFor('PREVIEW', publicCookRelease)],
    ['exact-revision preview walkthrough', 'questWalkthroughs', () => loadQuestWalkthroughFor('PREVIEW', previewCookRelease)],
  ] as const)('retries a transient %s chunk failure instead of losing the guides', async (_name, chunk, load) => {
    chunks.failures.set(chunk, 2);

    const loaded = await settle<unknown>(load());

    expect(loaded).toBeTruthy();
    expect(Array.isArray(loaded) ? loaded.map(strategy => strategy.questId) : [(loaded as { questId: string }).questId])
      .toContain("Cook's Assistant");
    expect(chunks.attempts.get(chunk)).toBe(3);
  });

  it('rejects once every retry has failed so the planner can offer another attempt', async () => {
    chunks.failures.set('questWalkthroughs.public', Number.POSITIVE_INFINITY);

    await expect(settle(loadQuestStrategyCatalogue('PUBLIC'))).rejects.toThrow();
    expect(chunks.attempts.get('questWalkthroughs.public')).toBe(3);
  });
});
