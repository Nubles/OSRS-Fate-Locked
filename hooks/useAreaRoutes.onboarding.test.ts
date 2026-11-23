// Panels that mount on the first screen must not start loading the router and
// chunk-content.json (about 295 kB gzip) behind the first-visit onboarding
// (PERF-4, commit db159d3). Each passes an `enabled` flag to the hook, and
// while it is off the routes are null, so owning an area is enough, as before.
import { describe, expect, it } from 'vitest';
import dashboard from '../components/Dashboard.tsx?raw';
import farmKeys from '../components/osrs/OsrsFarmKeys.tsx?raw';
import skills from '../components/osrs/OsrsSkills.tsx?raw';
import worldList from '../components/osrs/OsrsWorldList.tsx?raw';
import summaryCard from '../components/JournalSummaryCard.tsx?raw';

const calls = (source: string): string[] => [...(source.match(/useAreaRoutes(?:State)?\([^)]*\)/g) ?? [])];

describe('area routes wait for the onboarding on first-screen panels', () => {
  it.each([
    ['Dashboard', dashboard, 'useAreaRoutes(unlocks, gameModeId, hasSeenOnboarding)'],
    ['OsrsFarmKeys', farmKeys, 'useAreaRoutes(unlocks, gameModeId, hasSeenOnboarding)'],
    ['OsrsSkills', skills, 'useAreaRoutes(unlocks, gameModeId, advisorsEnabled && checking)'],
    ['OsrsWorldList', worldList, 'useAreaRoutesState(unlocks, gameModeId, !chunked && advisorsEnabled && hasSeenOnboarding)'],
    ['JournalSummaryCard', summaryCard, 'useAreaRoutesState(unlocks, gameModeId, hasSeenOnboarding)'],
  ])('%s gates the hook', (_name, source, expected) => {
    expect(calls(source)).toEqual([expected]);
  });
});
