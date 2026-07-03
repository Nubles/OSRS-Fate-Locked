import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// relaySync must be mocked before suggestSync imports it — suggestSync reads
// relaySync.enabled/base()/code on every poll().
vi.mock('./relaySync', () => ({
  relaySync: { enabled: true, base: () => 'https://relay.test', code: 'ABCD1234' },
}));

describe('suggestSync', () => {
  const localStorageData: Record<string, string> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const k of Object.keys(localStorageData)) delete localStorageData[k];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => localStorageData[k] ?? null,
      setItem: (k: string, v: string) => { localStorageData[k] = v; },
      removeItem: (k: string) => { delete localStorageData[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mockRelayPayload = (items: { source: string; label: string; ts: number }[]) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, payload: JSON.stringify(items) }),
    }));
  };

  it('rollSatisfiesSuggestion: Boss/Raid sources match exactly, Collection Log matches by prefix', async () => {
    const { rollSatisfiesSuggestion } = await import('./suggestSync');
    expect(rollSatisfiesSuggestion('Boss (Mid)', 'Boss (Mid)')).toBe(true);
    expect(rollSatisfiesSuggestion('Boss (Mid)', 'Boss (Low)')).toBe(false);
    expect(rollSatisfiesSuggestion('Collection Log', 'Col. Log: Vorki')).toBe(true);
    expect(rollSatisfiesSuggestion('Collection Log', 'Boss (Mid)')).toBe(false);
  });

  it('rollSatisfiesSuggestion: bare plugin categories match any tier of the rolled DropSource', async () => {
    // The plugin pushes bare categories ("Quest"); the app's roll history
    // records the tiered DropSource string ("Quest (Novice)"). Any tier of
    // the category satisfies the suggestion — but not other categories.
    const { rollSatisfiesSuggestion } = await import('./suggestSync');
    expect(rollSatisfiesSuggestion('Quest', 'Quest (Novice)')).toBe(true);
    expect(rollSatisfiesSuggestion('Quest', 'Quest (Grandmaster)')).toBe(true);
    expect(rollSatisfiesSuggestion('Quest', 'Diary (Easy)')).toBe(false);
    expect(rollSatisfiesSuggestion('Diary', 'Diary (Elite)')).toBe(true);
    expect(rollSatisfiesSuggestion('Combat Achievement', 'Combat Achievement (Master)')).toBe(true);
    expect(rollSatisfiesSuggestion('Combat Achievement', 'Quest (Master)')).toBe(false);
  });

  it('suggestionNav routes each category to its tab and drops the generic fallback label', async () => {
    const { suggestionNav } = await import('./suggestSync');
    expect(suggestionNav({ source: 'Quest', label: 'Dragon Slayer II', ts: 1 }))
      .toEqual({ target: 'tab:JOURNAL/QUESTS', query: 'Dragon Slayer II' });
    // "Quest complete" is the plugin's fallback when name extraction failed —
    // pre-filling the search with it would filter the quest list to nothing.
    expect(suggestionNav({ source: 'Quest', label: 'Quest complete', ts: 1 }))
      .toEqual({ target: 'tab:JOURNAL/QUESTS', query: undefined });
    expect(suggestionNav({ source: 'Diary', label: 'Diary complete', ts: 1 }).target).toBe('tab:JOURNAL/DIARIES');
    expect(suggestionNav({ source: 'Combat Achievement', label: 'X', ts: 1 }).target).toBe('tab:JOURNAL/CA');
    expect(suggestionNav({ source: 'Collection Log', label: 'Vorki', ts: 1 }))
      .toEqual({ target: 'tab:COLLECTION', query: 'Vorki' });
    expect(suggestionNav({ source: 'Boss (Mid)', label: 'Vorkath', ts: 1 }).target).toBe('ctrl:FARM');
  });

  it('poll() adds new relay items to the persistent pending list', async () => {
    mockRelayPayload([{ source: 'Boss (Mid)', label: 'Vorkath', ts: 1000 }]);
    const { suggestSync } = await import('./suggestSync');
    await (suggestSync as any).poll();
    expect(suggestSync.getPending()).toEqual([{ source: 'Boss (Mid)', label: 'Vorkath', ts: 1000 }]);
  });

  it('removePending clears the item AND survives a later poll of the same stale relay data', async () => {
    // This is the exact bug found during live verification: the relay is a
    // dumb store the plugin doesn't clear on our behalf, so a later poll
    // returning the SAME payload must not resurrect a cleared suggestion.
    mockRelayPayload([{ source: 'Boss (Mid)', label: 'Vorkath', ts: 1000 }]);
    const { suggestSync } = await import('./suggestSync');
    await (suggestSync as any).poll();
    expect(suggestSync.getPending()).toHaveLength(1);

    suggestSync.removePending({ source: 'Boss (Mid)', label: 'Vorkath', ts: 1000 });
    expect(suggestSync.getPending()).toHaveLength(0);

    // Relay still has the same stale item (plugin hasn't overwritten it) —
    // polling again must not bring it back.
    await (suggestSync as any).poll();
    expect(suggestSync.getPending()).toHaveLength(0);
  });

  it('clearPendingForRoll removes every pending item whose category matches the rolled source', async () => {
    mockRelayPayload([
      { source: 'Boss (Mid)', label: 'Vorkath', ts: 1000 },
      { source: 'Collection Log', label: 'Vorki', ts: 2000 },
    ]);
    const { suggestSync } = await import('./suggestSync');
    await (suggestSync as any).poll();
    expect(suggestSync.getPending()).toHaveLength(2);

    suggestSync.clearPendingForRoll('Col. Log: Vorki');
    const remaining = suggestSync.getPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].source).toBe('Boss (Mid)');

    // And a re-poll of the same stale relay data doesn't resurrect the cleared one.
    await (suggestSync as any).poll();
    expect(suggestSync.getPending()).toHaveLength(1);
  });

  it('the cleared set persists across service instances (survives a page reload)', async () => {
    mockRelayPayload([{ source: 'Raid', label: 'Chambers of Xeric', ts: 1000 }]);
    const mod1 = await import('./suggestSync');
    await (mod1.suggestSync as any).poll();
    mod1.suggestSync.removePending({ source: 'Raid', label: 'Chambers of Xeric', ts: 1000 });

    // Simulate a fresh page load: new module instance, same localStorage.
    vi.resetModules();
    const mod2 = await import('./suggestSync');
    await (mod2.suggestSync as any).poll();
    expect(mod2.suggestSync.getPending()).toHaveLength(0);
  });
});
