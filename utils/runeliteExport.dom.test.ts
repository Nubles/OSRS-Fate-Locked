// @vitest-environment jsdom
// What the RuneLite export tells the player: "copied" only when the clipboard
// took the bundle, the downloaded file and its next step when it did not, and
// a message (never a dead click) when the bundle cannot be built.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toasts: [] as string[],
  startArea: true,
  buildBundle: vi.fn(async () => ({ v: 4 })),
}));

vi.mock('./toast', () => ({ showToast: (message: string) => { mocks.toasts.push(message); } }));
vi.mock('./freeAreas', () => ({ isStartAreaFor: () => mocks.startArea }));
vi.mock('../services/GearService', () => ({ gearService: { init: async () => {}, ready: false } }));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: { init: async () => {}, ready: false },
}));
vi.mock('./runeliteRulesManifest', () => ({ buildRuneliteRulesManifest: async () => ({}) }));
vi.mock('./runeliteBundle', () => ({
  buildRuneliteBundle: mocks.buildBundle,
  CONTENT_VERSION: 1,
  DETECTOR_CONTRACT_VERSION: 1,
  RULES_VERSION: 'test',
}));
vi.mock('./relayPublishFingerprint', () => ({ relayFingerprint: async () => 'fp' }));

import { exportRuneliteBundle, type RuneliteRunInput } from './runeliteExport';

const RUN = { runId: 'run', runRevision: 1, gameModeId: 'vanilla' } as RuneliteRunInput;
const UNLOCKS = { regions: [], equipment: [] } as never;
const COPIED = 'RuneLite bundle copied + downloaded';
const NOT_COPIED = 'RuneLite bundle downloaded, but the browser wouldn\'t copy it. '
  + 'Move the file into your .runelite/fate-locked folder, then select Load newest backup file in the plugin.';

let downloads: string[] = [];

const setClipboard = (clipboard: unknown) => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
};

describe('exportRuneliteBundle', () => {
  beforeEach(() => {
    mocks.toasts.length = 0;
    mocks.startArea = true;
    mocks.buildBundle.mockImplementation(async () => ({ v: 4 }));
    downloads = [];
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:bundle';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setClipboard(undefined);
  });

  it('says copied + downloaded only when the clipboard took the bundle', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });

    await exportRuneliteBundle(UNLOCKS, RUN);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(downloads).toHaveLength(1);
    expect(mocks.toasts).toEqual([COPIED]);
  });

  it('says the file was downloaded and what to do with it when the clipboard refuses the write', async () => {
    setClipboard({
      writeText: vi.fn(() => Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError'))),
    });

    await exportRuneliteBundle(UNLOCKS, RUN);

    expect(downloads).toEqual([expect.stringMatching(/^fate-locked-bundle-\d{4}-\d{2}-\d{2}\.json$/)]);
    expect(mocks.toasts).toEqual([NOT_COPIED]);
  });

  it('says the same when the browser has no clipboard to write to', async () => {
    setClipboard(undefined);

    await exportRuneliteBundle(UNLOCKS, RUN);

    expect(downloads).toHaveLength(1);
    expect(mocks.toasts).toEqual([NOT_COPIED]);
  });

  it('tells the player when the bundle cannot be built, and neither copies nor downloads', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    mocks.buildBundle.mockImplementation(async () => { throw new Error('offline'); });

    await expect(exportRuneliteBundle(UNLOCKS, RUN)).resolves.toBeUndefined();

    expect(writeText).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
    expect(mocks.toasts).toEqual(['Couldn\'t export for RuneLite. Reload the page and try again.']);
  });

  it('asks for a fresh export when the run changed while it was being built', async () => {
    setClipboard({ writeText: vi.fn(() => Promise.resolve()) });
    mocks.startArea = false;

    await exportRuneliteBundle(UNLOCKS, RUN);

    expect(downloads).toEqual([]);
    expect(mocks.toasts).toEqual([
      'The run changed while its RuneLite bundle was being built. Export it again.',
    ]);
  });
});
