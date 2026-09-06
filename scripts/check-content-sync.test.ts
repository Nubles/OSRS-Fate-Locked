import { describe, it, expect } from 'vitest';
// scripts/ is excluded from tsc; vitest still runs this. Import the pure builder.
import { buildReport } from './check-content-sync.mjs';

const base = {
  quests: { app: 205, wiki: { total: 180, p2p: 156, f2p: 24, questPoints: 335 } },
  diaries: { app: { 'Ardougne Easy': 10, 'Ardougne Medium': 12 } },
};

describe('content-sync report builder', () => {
  it('flags a tier where the app is behind the wiki', () => {
    const { actions, markdown } = buildReport({
      ...base,
      cas: { app: { Easy: 35, Medium: 60 }, wiki: { Easy: 41, Medium: 60 } },
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatch(/Easy/);
    expect(actions[0]).toMatch(/app behind/);
    expect(markdown).toMatch(/\| Easy \| 41 \| 35 \| -6 \|/);
  });

  it('reports all-clear when counts line up', () => {
    const { actions, markdown } = buildReport({
      ...base,
      cas: { app: { Easy: 41 }, wiki: { Easy: 41 } },
    });
    expect(actions).toEqual([]);
    expect(markdown).toMatch(/Nothing — all tracked counts are consistent/);
  });

  it('degrades gracefully when wiki counts are unavailable', () => {
    const { markdown, actions, sourceUnavailable } = buildReport({
      quests: { app: 205, wiki: null },
      cas: { app: { Easy: 41 }, wiki: null },
      diaries: base.diaries,
    });
    expect(markdown).toMatch(/Wiki count unavailable/);
    expect(markdown).toMatch(/Wiki counts unavailable/);
    expect(actions).toHaveLength(2);
    expect(sourceUnavailable).toBe(true);
    expect(markdown).not.toContain('Nothing — all tracked counts are consistent');
  });

  it.each(['quests', 'cas'])('retains uncertainty when only %s is unavailable', missing => {
    const input = { ...base, cas: { app: { Easy: 41 }, wiki: { Easy: 41 } } };
    const result = buildReport({ ...input, [missing]: { ...input[missing as keyof typeof input], wiki: null } });
    expect(result.sourceUnavailable).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.markdown).not.toContain('Nothing — all tracked counts are consistent');
  });

  it('is deterministic (no timestamps) so git only diffs on real change', () => {
    const input = { ...base, cas: { app: { Easy: 41 }, wiki: { Easy: 41 } } };
    expect(buildReport(input).markdown).toBe(buildReport(input).markdown);
  });

  it('surfaces the quest watch line', () => {
    const { markdown } = buildReport({ ...base, cas: { app: {}, wiki: {} } });
    expect(markdown).toMatch(/Wiki: \*\*180\*\* quests/);
    expect(markdown).toMatch(/new quest was released/);
  });
});
