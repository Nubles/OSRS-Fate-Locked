# Fate Analytics Accuracy Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct Fate Analytics so pity, Luck, Greed, Omni, expectation, rewards, and legacy uncertainty are represented accurately, then expose the result through the approved visualization-rich responsive dashboard.

**Architecture:** `utils/fateAnalytics.ts` becomes the sole history-to-statistics choke point. `GameContext` records exact future-roll metadata, while `StatsModal` owns only query/tab/table state and a lazy `StatsChartsView` composes focused chart components from one immutable `FateAnalyticsResult`.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Recharts 2.12, Vitest 4, jsdom.

**Spec:** `docs/superpowers/specs/2026-08-20-fate-analytics-accuracy-dashboard-design.md`

## Global Constraints

- Do not change Key, Omni-Key, Chaos-Key, Fate, pity, Luck, or Greed gameplay rules.
- Do not rewrite existing history; all new `LogEntry.meta` fields are additive.
- A Pity entry is one attempt, zero genuine RNG wins, and one pity intervention.
- A Luck roll uses `1 - (1 - p) ** 2`; a Greed payout remains one RNG outcome even when it awards two Standard Keys.
- Standard and exact contextual rolls record draw resolutions of `1000` and `10000` units respectively.
- Never guess exact legacy Luck use or Greed payout; show coverage and legacy-estimate labels.
- Keep Recharts inside the existing lazy Stats chunk and add no chart dependency.
- Preserve seeded-run RNG order: metadata creation must consume no random draw.
- Keep the RuneLite plugin and relay protocol unchanged.
- Phone layouts stack full-width chart cards; charts must have text summaries and colour-independent labels.
- Run `npx vitest run`, `npx tsc --noEmit`, and `npx vite build` before completion.

## File Structure

### Calculation and history contract

- `types.ts` — exported `RollAnalyticsMeta` contract used by the reducer and analytics engine.
- `utils/fateAnalytics.ts` — roll normalization, `rollCategory`, filtering, coverage, summaries, source/category aggregation, and every chart dataset.
- `utils/fateAnalytics.test.ts` — pure statistical and filtering contract tests.
- `context/GameContext.tsx` — emits universal exact analytics metadata from the existing `ROLL_RESULT` transition.
- `context/gameReducer.test.ts` — pins metadata for normal, failure, pity, Luck, Greed, Omni, and exact contextual rolls.
- `utils/fateReport.ts` — compatibility adapter over `FateAnalyticsResult`, not an independent calculator.
- `utils/fateReport.test.ts` — pins corrected report semantics and dashboard/report parity.
- `utils/rollDistribution.ts` and `utils/rollDistribution.test.ts` — retain the legacy observed-bucket helper while exporting the shared bucket boundaries used by `fateAnalytics`.

### UI and chart composition

- `components/StatsModal.tsx` — modal shell, shared query state, tabs, breakdown table, and Fate Report rendering.
- `components/StatsModal.test.tsx` — removes the obsolete `buildStats` unit test and pins stable breakdown sorting helpers.
- `components/StatsModal.dom.test.tsx` — filter, tab, accessibility, coverage, table, and dashboard/report agreement tests.
- `components/StatsChartsView.tsx` — lazy dashboard composition only.
- `components/stats/AnalyticsControls.tsx` — time/source/exactness filters and data-quality summary.
- `components/stats/AnalyticsKpis.tsx` — the eight approved KPI cards and plain-language luck summary.
- `components/stats/AnalyticsChartCard.tsx` — shared title, subtitle, text summary, empty state, and chart frame.
- `components/stats/PrimaryAnalyticsCharts.tsx` — observed/expected, outcome composition, histogram, source performance, and streak timeline.
- `components/stats/SecondaryAnalyticsCharts.tsx` — calibration, Key acquisition, and activity calendar.
- `components/stats/NotableMoments.tsx` — the ninth visualization/panel with deterministic notable outcomes.
- `components/stats/chartData.ts` and `components/stats/chartData.test.ts` — render-only downsampling and calendar-grid helpers.
- `components/stats/AnalyticsDashboard.dom.test.tsx` — chart labels, summaries, empty states, reduced motion, and narrow-layout DOM tests with Recharts mocked.

---

### Task 1: Build the typed analytics choke point

**Files:**
- Modify: `types.ts:104-125`
- Create: `utils/fateAnalytics.ts`
- Create: `utils/fateAnalytics.test.ts`
- Modify: `utils/rollDistribution.ts:1-32`
- Modify: `utils/rollDistribution.test.ts:1-30`

**Interfaces:**
- Consumes: `LogEntry[]` and the existing `isRollEntry()` / `rollCategory()` semantics.
- Produces: `buildFateAnalytics(history: LogEntry[], query: FateAnalyticsQuery): FateAnalyticsResult`, `defaultFateAnalyticsQuery(now: number): FateAnalyticsQuery`, and shared typed chart datasets used by all later tasks.

- [ ] **Step 1: Add the shared metadata and analytics result types**

Add this exported history contract to `types.ts` after `LogEntry`:

```ts
export interface RollAnalyticsMeta {
  successProbability: number;
  luckApplied: boolean;
  drawResolution: 1000 | 10000;
  standardKeysAwarded: number;
  rewardKind: 'normal' | 'greed' | 'pity' | 'omni' | 'none';
}
```

Create `utils/fateAnalytics.ts` with these public query/result shapes:

```ts
export type AnalyticsRange = 'all' | 'last-30-days' | 'last-100';
export type AnalyticsScope =
  | { kind: 'all' }
  | { kind: 'category'; value: string }
  | { kind: 'source'; value: string };

export interface FateAnalyticsQuery {
  range: AnalyticsRange;
  scope: AnalyticsScope;
  includeLegacyEstimates: boolean;
  now: number;
}

export type AnalyticsOutcome = 'normal-win' | 'omni-win' | 'miss' | 'pity';
export type ProbabilityQuality = 'exact' | 'legacy-estimate' | 'unscoreable';

export interface AnalyticsCoverage {
  attempts: number;
  exactOutcomes: number;
  exactProbabilities: number;
  legacyEstimates: number;
  unscoreableProbabilities: number;
  exactRewardEvents: number;
  unverifiedRewardEvents: number;
  invalidTimestamps: number;
  unknownSources: number;
  inconsistentEntries: number;
}

export interface AnalyticsSummary {
  attempts: number;
  genuineWins: number;
  scoreableAttempts: number;
  scoreableWins: number;
  expectedWins: number;
  variance: number;
  delta: number;
  zScore: number | null;
  verdict: 'Building sample' | 'Blessed by Fate' | 'Running hot' | 'Fate is fair' | 'Running cold' | 'Forsaken by Fate' | null;
  pityInterventions: number;
  omniKeysAwarded: number;
  confirmedStandardKeys: number;
  rewardEvents: number;
  actualRate: number | null;
  expectedRate: number | null;
  currentDrought: number;
  longestDrought: number;
  longestHotStreak: number;
}

export interface TimelinePoint {
  index: number;
  timestamp: number;
  actual: number;
  expected: number;
  lower: number;
  upper: number;
  delta: number;
  outcome: AnalyticsOutcome;
}

export interface HistogramBucket {
  range: string;
  min: number;
  max: number;
  observed: number;
  expected: number | null;
  expectedCoverage: number;
}

export interface AnalyticsAggregate {
  kind: 'source' | 'category';
  label: string;
  attempts: number;
  genuineWins: number;
  scoreableAttempts: number;
  scoreableWins: number;
  expectedWins: number;
  variance: number;
  delta: number;
  zScore: number | null;
  pityInterventions: number;
  confirmedStandardKeys: number;
  probabilityCoverage: number;
  actualRate: number | null;
  expectedRate: number | null;
  sampleLabel: 'Limited sample' | 'Developing sample' | 'Established sample';
}

export interface CalibrationBin {
  range: string;
  attempts: number;
  meanPredictedRate: number;
  actualRate: number;
}

export interface StreakSegment {
  startIndex: number;
  endIndex: number;
  outcome: 'win' | 'miss' | 'pity';
  length: number;
}

export interface KeyAcquisitionPoint {
  date: string;
  normalStandard: number;
  greedStandard: number;
  pityStandard: number;
  omniStandard: number;
  omniKeys: number;
  unverifiedRewardEvents: number;
}

export interface ActivityDay {
  date: string;
  attempts: number;
}

export interface AnalyticsNotableRoll {
  source: string;
  probability: number;
  timestamp: number;
  historyIndex: number;
}

export interface AnalyticsNotables {
  luckiestSuccess: AnalyticsNotableRoll | null;
  cruelestMiss: AnalyticsNotableRoll | null;
  mostProductiveSource: string | null;
  mostActiveDay: ActivityDay | null;
}

export interface FateAnalyticsResult {
  query: FateAnalyticsQuery;
  summary: AnalyticsSummary;
  coverage: AnalyticsCoverage;
  timeline: TimelinePoint[];
  outcomeComposition: Array<{ outcome: AnalyticsOutcome; count: number }>;
  histogram: HistogramBucket[];
  sources: AnalyticsAggregate[];
  categories: AnalyticsAggregate[];
  streaks: StreakSegment[];
  calibration: CalibrationBin[];
  keyAcquisition: KeyAcquisitionPoint[];
  activityDays: ActivityDay[];
  notables: AnalyticsNotables;
  availableSources: string[];
  availableCategories: string[];
  exactOnlyAvailable: boolean;
}
```

- [ ] **Step 2: Write failing core-contract tests**

Create fixtures that deliberately preserve the current Pity representation (`result: 'SUCCESS'`) and assert the corrected meaning. Use a deterministic fixture counter instead of random IDs:

```ts
let fixtureId = 0;
const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: String(over.id ?? ++fixtureId),
  timestamp: over.timestamp ?? 1,
  type: over.type ?? 'ROLL_FAIL',
  message: over.message ?? '',
  result: over.result ?? 'FAIL',
  source: over.source ?? 'Quest (Novice)',
  rollValue: over.rollValue ?? 80,
  threshold: over.threshold ?? 20,
  meta: over.meta,
});

it('treats pity as a failed RNG attempt and separate intervention', () => {
  const result = buildFateAnalytics([
    entry({ type: 'PITY', result: 'SUCCESS', rollValue: 80, threshold: 20 }),
  ], defaultFateAnalyticsQuery(1));

  expect(result.summary).toMatchObject({
    attempts: 1,
    genuineWins: 0,
    pityInterventions: 1,
    currentDrought: 1,
    longestDrought: 1,
    longestHotStreak: 0,
  });
  expect(result.outcomeComposition).toContainEqual({ outcome: 'pity', count: 1 });
});

it('uses exact Luck probability without counting Greed twice', () => {
  const result = buildFateAnalytics([
    entry({
      type: 'ROLL_SUCCESS',
      result: 'SUCCESS',
      rollValue: 10,
      threshold: 20,
      meta: {
        successProbability: 0.36,
        luckApplied: true,
        drawResolution: 1000,
        standardKeysAwarded: 2,
        rewardKind: 'greed',
      },
    }),
  ], defaultFateAnalyticsQuery(1));

  expect(result.summary.genuineWins).toBe(1);
  expect(result.summary.expectedWins).toBeCloseTo(0.36);
  expect(result.summary.confirmedStandardKeys).toBe(2);
});
```

Add separate tests for Omni, zero variance, current/longest streaks, stable timestamp ties, invalid numeric metadata without threshold fallback, missing sources, exported `rollCategory` grouping, range-filtered pre-scope availability, Exact-only probability behavior, local-calendar 30-day boundaries across a DST change, and the sample-label boundaries 9/10/29/30. Include an unscoreable genuine win and prove it remains in `genuineWins` but not `scoreableWins` or delta; `delta` must always equal `scoreableWins - expectedWins`.

- [ ] **Step 3: Run the focused test and confirm the red state**

Run: `npx vitest run utils/fateAnalytics.test.ts`

Expected: FAIL because `utils/fateAnalytics.ts` and its exports do not exist.

- [ ] **Step 4: Implement roll normalization, filtering, coverage, summary, sources, and categories**

Use entry type as the authoritative outcome. Export `rollCategory()` from this file so `fateReport.ts` can re-export it later without a circular import. Accept exact probability only when `meta.successProbability` is finite and between 0 and 1. When that metadata field is absent, accept a finite threshold in `[0, 100]` as a legacy single-draw estimate. When the field is present but malformed, count a diagnostic and treat the entry as unscoreable rather than silently falling back to its threshold. Mark a roll inconsistent and exclude it from probability-derived figures when a valid `rollValue <= threshold` comparison disagrees with the authoritative type; keep the authoritative attempt/outcome count.

Use a copied stable sequence:

```ts
const ordered = history
  .map((entry, historyIndex) => ({
    entry,
    historyIndex,
    sortTimestamp: Number.isFinite(entry.timestamp) ? entry.timestamp : Number.POSITIVE_INFINITY,
  }))
  .filter(({ entry }) => isRollEntry(entry))
  .sort((a, b) => a.sortTimestamp - b.sortTimestamp || a.historyIndex - b.historyIndex);
```

Apply range first, then scope. `last-30-days` means today plus the previous 29 browser-local calendar days: clone `new Date(query.now)`, set local hours to `00:00:00.000`, then use `setDate(getDate() - 29)` and keep valid timestamps at or after that boundary. Do not subtract a fixed millisecond duration, which is wrong across daylight-saving transitions. `last-100` takes the final 100 ordered attempts. Invalid timestamps remain in `all` and are excluded from date ranges.

Derive `availableSources`, `availableCategories`, and `exactOnlyAvailable` after the range filter but before applying the current scope, so choosing one source/category does not remove the other valid choices from the control. Coverage describes the final filtered selection. `includeLegacyEstimates: false` is the Exact-only state: retain all authoritative attempts and outcomes, but exclude legacy estimates and unscoreable entries from probability-derived expectations, variance, z-score, calibration, and probability notables.

Keep overall and probability-cohort counts separate. `attempts` and `genuineWins` cover every authoritative filtered outcome. `scoreableAttempts` and `scoreableWins` cover exactly the entries contributing a probability under the current Exact-only setting. Compute expected wins, variance, delta, z-score, actual/expected comparison rates, the observed/expected timeline, calibration, and luckiest/cruellest probability notables from that same scoreable cohort; `delta` is always `scoreableWins - expectedWins`. Outcome composition, streaks, activity, and reward totals continue to use all authoritative filtered attempts.

Compute z-score only when variance is greater than zero. When variance is zero, return `zScore: null` and `verdict: null`. Otherwise return `Building sample` for fewer than 10 scoreable rolls, then apply the existing verdict boundaries `2`, `1`, `-1`, and `-2`.

- [ ] **Step 5: Export shared five-point roll buckets**

Change `utils/rollDistribution.ts` to export exact two-decimal-compatible bucket boundaries and keep the current compatibility wrapper:

```ts
export const ROLL_BUCKETS = Array.from({ length: 20 }, (_, index) => ({
  min: index === 0 ? 0.01 : index * 5 + 0.01,
  max: (index + 1) * 5,
  range: `${(index === 0 ? 0.01 : index * 5 + 0.01).toFixed(2)}–${((index + 1) * 5).toFixed(2)}`,
}));
```

Update the existing boundary test to assert ranges `0.01–5.00` and `95.01–100.00`, place exact values `0.01`, `5.00`, `5.01`, and `100.00` correctly, and retain legacy integer counts.

- [ ] **Step 6: Run core analytics tests**

Run: `npx vitest run utils/fateAnalytics.test.ts utils/rollDistribution.test.ts`

Expected: PASS with Pity counted as a miss/intervention and Greed counted as one win/two confirmed Keys.

- [ ] **Step 7: Commit the analytics contract**

Create `/tmp/fate-analytics-task-1.txt` with:

```text
feat: centralize Fate Analytics calculations

Define one typed history-to-statistics contract that separates RNG outcomes,
pity interventions, rewards, coverage, filtering, streaks, and aggregates.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

Stage only and commit from that message file:

```bash
git add -- types.ts utils/fateAnalytics.ts utils/fateAnalytics.test.ts utils/rollDistribution.ts utils/rollDistribution.test.ts
git commit -F /tmp/fate-analytics-task-1.txt
```

### Task 2: Persist exact roll analytics metadata

**Files:**
- Modify: `context/GameContext.tsx:796-970`
- Modify: `context/gameReducer.test.ts:53-290`

**Interfaces:**
- Consumes: `RollAnalyticsMeta` from `types.ts` and the existing prepared `ROLL_RESULT` payload.
- Produces: every new roll entry carries exact `successProbability`, `luckApplied`, `drawResolution`, `standardKeysAwarded`, and `rewardKind` metadata.

- [ ] **Step 1: Write failing reducer metadata tests**

Add one table-driven test for normal success, failure, pity, Omni, and Greed, plus dedicated Luck and exact-context tests:

```ts
it.each([
  ['normal', base(), roll({ success: true }), { rewardKind: 'normal', standardKeysAwarded: 1 }],
  ['none', base(), roll({ success: false }), { rewardKind: 'none', standardKeysAwarded: 0 }],
  ['pity', { ...base(), fatePoints: 49 }, roll({ pity: true }), { rewardKind: 'pity', standardKeysAwarded: 1 }],
  ['omni', base(), roll({ success: true, omni: true }), { rewardKind: 'omni', standardKeysAwarded: 1 }],
  ['greed', { ...base(), activeBuff: 'GREED' as const }, roll({ success: true }), { rewardKind: 'greed', standardKeysAwarded: 2 }],
])('records universal %s metadata', (_label, state, action, expected) => {
  const result = gameReducer(state, action);
  expect(result.history.at(-1)?.meta).toMatchObject({
    successProbability: 0.5,
    luckApplied: false,
    drawResolution: 1000,
    ...expected,
  });
});

it('records the two-draw Luck probability before clearing the buff', () => {
  const result = gameReducer(
    { ...base(), activeBuff: 'LUCK' as const },
    roll({ success: true, threshold: 20, baseThreshold: 20, roll: 10 }),
  );
  expect(result.history.at(-1)?.meta).toMatchObject({
    luckApplied: true,
    successProbability: 0.36,
    drawResolution: 1000,
  });
});
```

For a Vanilla `KeyRollContext`, expect `drawResolution: 10000` and verify existing `bossName`, `remainingReserve`, and `outcome` metadata still exist.

- [ ] **Step 2: Run the reducer tests and confirm the red state**

Run: `npx vitest run context/gameReducer.test.ts`

Expected: FAIL because the five universal analytics fields are absent for ordinary roll entries.

- [ ] **Step 3: Compute metadata from existing transition state**

In the `ROLL_RESULT` branch, capture pre-reset buffs and build one authoritative object after `standardKeysAwarded` is known:

```ts
const luckApplied = state.activeBuff === 'LUCK';
const isGreed = state.activeBuff === 'GREED';
const singleDrawProbability = Math.max(0, Math.min(1, threshold / 100));
const successProbability = luckApplied
  ? 1 - (1 - singleDrawProbability) ** 2
  : singleDrawProbability;
const rewardKind: RollAnalyticsMeta['rewardKind'] = success
  ? omni ? 'omni' : isGreed ? 'greed' : 'normal'
  : pity ? 'pity' : 'none';
const analyticsMeta: RollAnalyticsMeta = {
  successProbability,
  luckApplied,
  drawResolution: vanillaBossContext || vanillaClueContext ? 10000 : 1000,
  standardKeysAwarded,
  rewardKind,
};
```

Spread `analyticsMeta` last in `entryMeta()` and `eventMeta` so detected-event metadata cannot overwrite the contract. This code must not call `nextFloat`, `nextDice`, or `Math.random`.

- [ ] **Step 4: Run reducer and seeded-RNG regression tests**

Run: `npx vitest run context/gameReducer.test.ts utils/seededRng.test.ts context/GameContext.test.tsx`

Expected: PASS; existing seeded fixtures remain unchanged and new metadata tests pass.

- [ ] **Step 5: Commit exact metadata emission**

Create `/tmp/fate-analytics-task-2.txt` with:

```text
fix: record exact roll analytics metadata

Persist probability, Luck, draw resolution, Standard Key payout, and reward
kind from the existing deterministic roll transition without consuming RNG.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```bash
git add -- context/GameContext.tsx context/gameReducer.test.ts
git commit -F /tmp/fate-analytics-task-2.txt
```

### Task 3: Complete chart datasets and migrate Fate Report

**Files:**
- Modify: `utils/fateAnalytics.ts`
- Modify: `utils/fateAnalytics.test.ts`
- Modify: `utils/fateReport.ts:1-126`
- Modify: `utils/fateReport.test.ts:1-90`

**Interfaces:**
- Consumes: normalized rolls and core summary from Task 1.
- Produces: complete `timeline`, `histogram`, `streaks`, `calibration`, `keyAcquisition`, `activityDays`, and `notables`; `fateReportFromAnalytics(analytics)` adapts an existing result, while `buildFateReport(history, query?)` remains the compatibility wrapper.

- [ ] **Step 1: Write failing chart-dataset tests**

Add deterministic fixtures for each dataset:

```ts
it('builds calibration bins from genuine outcomes and predicted probability', () => {
  const result = buildFateAnalytics([
    exactRoll('a', 1, 'ROLL_SUCCESS', 0.15),
    exactRoll('b', 2, 'ROLL_FAIL', 0.15),
    exactRoll('c', 3, 'ROLL_SUCCESS', 0.65),
  ], defaultFateAnalyticsQuery(3));

  expect(result.calibration).toEqual([
    { range: '10–20%', attempts: 2, meanPredictedRate: 15, actualRate: 50 },
    { range: '60–70%', attempts: 1, meanPredictedRate: 65, actualRate: 100 },
  ]);
});

it('uses known draw models for histogram expectation and excludes legacy models', () => {
  const result = buildFateAnalytics([
    exactRoll('single', 1, 'ROLL_FAIL', 0.2, { luckApplied: false, drawResolution: 1000 }),
    exactRoll('luck', 2, 'ROLL_FAIL', 0.36, { luckApplied: true, drawResolution: 1000 }),
    legacyRoll('legacy', 3, 'ROLL_FAIL', 20),
  ], defaultFateAnalyticsQuery(3));

  expect(result.histogram[0].expectedCoverage).toBe(2);
  expect(result.histogram.reduce((sum, bucket) => sum + (bucket.expected ?? 0), 0)).toBeCloseTo(2);
});
```

Add tests for the cumulative `expected ± 2√variance` bounds, streak segments with pity separate from miss, exact reward-day grouping, invalid timestamp exclusion, most-active-day ties, and luckiest/cruellest ties.

- [ ] **Step 2: Run dataset tests and confirm failure**

Run: `npx vitest run utils/fateAnalytics.test.ts`

Expected: FAIL because advanced datasets are still empty or incomplete.

- [ ] **Step 3: Implement every chart dataset in the shared engine**

For each exact histogram roll, calculate discrete cumulative probability for one or two draws. With `units` equal to `1000` or `10000`, the one-draw CDF at percentage `x` is `floor(clamp(x, 0, 100) / 100 * units) / units`; the Luck-minimum CDF is `1 - (1 - cdf) ** 2`. Bucket probability is `cdf(max) - cdf(previousMax)`. Sum that probability across known models.

Group calibration by ten percentage-point bins using the recorded probability, not `threshold`. Group reward and activity timelines by local `YYYY-MM-DD` generated from `new Date(timestamp)` components. Maintain stable source/day tie-breaking by first appearance.

For reward timelines, keep Standard-Key and Omni-Key units distinct. `normalStandard`, `greedStandard`, `pityStandard`, and `omniStandard` sum recorded `standardKeysAwarded` by reward kind; `omniKeys` counts the separately awarded Omni-Key. `confirmedStandardKeys` includes all four Standard-Key series. Never add `omniKeys` to that KPI.

- [ ] **Step 4: Replace Fate Report's independent calculator with an adapter**

Re-export `rollCategory` from `fateAnalytics.ts`. Change `FateReport.zScore` to `number | null` and `FateReport.verdict` to `string | null`. Add `totalAttempts` and `genuineWins` for the complete authoritative selection; retain `rolls` and `actual` as the scoreable attempt/win cohort so `delta === actual - expected` remains mathematically honest. Extend `CategoryLuck` with total attempts, genuine wins, scoreable rolls/wins, `probabilityCoverage`, and `sampleLabel` so the existing Fate Report category cards disclose which cohort contributed to expectation. Construct the report through an adapter that can consume the already-built analytics result:

```ts
export function buildFateReport(
  history: LogEntry[],
  query = defaultFateAnalyticsQuery(Date.now()),
): FateReport | null {
  return fateReportFromAnalytics(buildFateAnalytics(history, query));
}

export function fateReportFromAnalytics(
  analytics: FateAnalyticsResult,
): FateReport | null {
  if (analytics.summary.attempts === 0) return null;
  return {
    totalAttempts: analytics.summary.attempts,
    genuineWins: analytics.summary.genuineWins,
    rolls: analytics.summary.scoreableAttempts,
    expected: analytics.summary.expectedWins,
    actual: analytics.summary.scoreableWins,
    delta: analytics.summary.delta,
    zScore: analytics.summary.zScore,
    verdict: analytics.summary.verdict,
    luckiest: toReportRoll(analytics.notables.luckiestSuccess),
    cruelest: toReportRoll(analytics.notables.cruelestMiss),
    longestDrought: analytics.summary.longestDrought,
    longestHotStreak: analytics.summary.longestHotStreak,
    categories: analytics.categories.map(toCategoryLuck),
  };
}

export { rollCategory } from './fateAnalytics';
```

Update tests so a `PITY` fixture with `result: 'SUCCESS'` produces `actual: 0`, `longestDrought: 1`, and no luckiest success. Add zero-variance coverage that expects both z-score and verdict to be null, plus a category assertion that exposes total and scoreable counts. Add an unscoreable genuine win and assert it increments report `genuineWins` but not `actual` or `delta`.

- [ ] **Step 5: Run analytics and Fate Report tests**

Run: `npx vitest run utils/fateAnalytics.test.ts utils/fateReport.test.ts`

Expected: PASS with identical summary figures in the analytics result and Fate Report adapter.

- [ ] **Step 6: Commit complete analytics datasets**

Create `/tmp/fate-analytics-task-3.txt` with:

```text
feat: derive Fate Analytics chart datasets

Build every dashboard dataset from the shared analytics result and make the
Fate Report a compatibility adapter over the same corrected figures.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```bash
git add -- utils/fateAnalytics.ts utils/fateAnalytics.test.ts utils/fateReport.ts utils/fateReport.test.ts
git commit -F /tmp/fate-analytics-task-3.txt
```

### Task 4: Replace the modal calculator with shared controls, KPIs, and table

**Files:**
- Create: `components/stats/AnalyticsControls.tsx`
- Create: `components/stats/AnalyticsKpis.tsx`
- Modify: `components/StatsModal.tsx:1-380`
- Modify: `components/StatsModal.test.tsx:1-34`
- Create: `components/StatsModal.dom.test.tsx`

**Interfaces:**
- Consumes: `FateAnalyticsQuery`, `FateAnalyticsResult`, `buildFateAnalytics`, and `fateReportFromAnalytics` from Tasks 1–3.
- Produces: one query/result shared by Dashboard, Activity Breakdown, and Fate Report; accessible filter controls and sortable source rows.

- [ ] **Step 1: Write failing modal DOM tests with the game hook mocked**

Use the repository's `createRoot`/`act` jsdom pattern and mock `useGame()` with one success, one failure, and one Pity entry. Mock `StatsChartsView` to render the supplied summary without loading Recharts:

```ts
vi.mock('./StatsChartsView', () => ({
  default: ({ analytics }: { analytics: FateAnalyticsResult }) => (
    <div data-testid="dashboard-result">
      {analytics.summary.attempts}/{analytics.summary.genuineWins}/{analytics.summary.pityInterventions}
    </div>
  ),
}));

it('opens on Dashboard and separates RNG wins from pity', async () => {
  const { host } = await mount(<StatsModal onClose={() => undefined} />);
  expect(host.querySelector('[aria-selected="true"]')?.textContent).toContain('Dashboard');
  expect(host.textContent).toContain('Genuine RNG wins');
  expect(host.textContent).toContain('Pity interventions');
  expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('3/1/1');
});
```

Add tests that `Last 100`, `Last 30 days`, category/source scope, and `Exact only` update the mocked dashboard and the table from the same result; assert `aria-sort` changes when a header is clicked.

- [ ] **Step 2: Run modal tests and confirm failure**

Run: `npx vitest run components/StatsModal.test.tsx components/StatsModal.dom.test.tsx`

Expected: FAIL because the current modal exports `buildStats`, opens on Overview, and has no shared query controls or corrected labels.

- [ ] **Step 3: Implement controls and quality summary**

`AnalyticsControls` receives exact controlled props:

```ts
interface AnalyticsControlsProps {
  query: FateAnalyticsQuery;
  onChange: (query: FateAnalyticsQuery) => void;
  coverage: AnalyticsCoverage;
  availableSources: string[];
  availableCategories: string[];
  exactOnlyAvailable: boolean;
}
```

Render labelled native selects/buttons for range and scope, plus an Exact-only checkbox. Disable it only when it is currently unchecked and `exactOnlyAvailable` is false; a checked control always remains enabled so the user can return to legacy-inclusive figures. Render the full coverage sentence in an `aria-live="polite"` region.

Map the checkbox inversely to the query field: checked means `includeLegacyEstimates: false`. Source/category options come from the range-filtered pre-scope availability lists, so the current selection never makes its alternatives disappear.

- [ ] **Step 4: Implement corrected KPI cards**

`AnalyticsKpis` renders attempts, genuine wins, expected wins with `scoreableAttempts/attempts` coverage, z-score/delta, pity, Omni, confirmed Standard Keys with `exactRewardEvents/rewardEvents`, and current/longest drought. A null z-score renders `—`; fewer than 10 scoreable rolls render `Building sample`. Label delta and expected figures as the scoreable cohort so overall genuine wins are never implicitly compared with partial expectation.

- [ ] **Step 5: Rebuild `StatsModal` around one analytics result**

Remove `buildStats`, unused imports, the Overview/Visualizations split, and raw-history calculations. Use tabs `dashboard | breakdown | fate`, default `dashboard`, and this memoized contract:

```ts
const [query, setQuery] = useState(() => defaultFateAnalyticsQuery(Date.now()));
const analytics = useMemo(() => buildFateAnalytics(history, query), [history, query]);
const fateReport = useMemo(() => fateReportFromAnalytics(analytics), [analytics]);
```

Pass `analytics` to lazy `StatsChartsView`. Render `AnalyticsControls` above tab content so the same filter applies everywhere. Expand the table to the approved columns and make each sortable header a real button with `aria-sort` on its `<th>`. Stable sorting uses original array index as the final comparator.

Render `AnalyticsKpis` in the Dashboard panel before the lazy chart boundary, so core figures appear while Recharts loads and the DOM test does not depend on chart internals. Handle the nullable Fate Report z-score explicitly (`—` with no hot/cold verdict when unavailable) instead of comparing or formatting `null`.

Preserve the existing `KeyEconomyEvidenceExport` and its `completionPercent(unlocks)` input in the Fate Report tab. It remains intentionally based on full, unfiltered run history plus game mode and overall completion; analytics range/scope controls must not truncate evidence intended for export. In the Fate Report summary, show overall attempts/genuine wins separately from scoreable rolls/wins used for expected, delta, and z-score. Add category probability-coverage and sample labels from `CategoryLuck` to the existing report table.

Give the modal `role="dialog"` and `aria-modal="true"`; label the close control `aria-label="Close Fate Analytics"`. On open, focus the close button or active tab; trap Tab/Shift+Tab within the dialog, close on Escape, and return focus to the previously focused element. Implement the tab strip with `role="tablist"`, tab buttons with `role="tab"`, `aria-selected`, and `aria-controls`, and labelled `role="tabpanel"` panels. The narrow breakdown uses an accessible horizontal scroll region and a sticky Source column.

- [ ] **Step 6: Replace the obsolete pure modal test**

Remove assertions against `StatsModal.buildStats`. Keep the sub-1% regression in `utils/fateAnalytics.test.ts`, and make `StatsModal.test.tsx` test the exported stable row sorter with unavailable z-score/reward values sorted after available values in both directions.

- [ ] **Step 7: Run modal and analytics tests**

Run: `npx vitest run components/StatsModal.test.tsx components/StatsModal.dom.test.tsx utils/fateAnalytics.test.ts utils/fateReport.test.ts`

Expected: PASS; all modal surfaces show the corrected shared figures.

- [ ] **Step 8: Commit the modal shell**

Create `/tmp/fate-analytics-task-4.txt` with:

```text
feat: rebuild Fate Analytics modal shell

Use one filtered analytics result for the dashboard, accessible breakdown
table, data-quality controls, KPIs, and Fate Report.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```bash
git add -- components/StatsModal.tsx components/StatsModal.test.tsx components/StatsModal.dom.test.tsx components/stats/AnalyticsControls.tsx components/stats/AnalyticsKpis.tsx
git commit -F /tmp/fate-analytics-task-4.txt
```

### Task 5: Implement the five primary visualizations

**Files:**
- Create: `components/stats/AnalyticsChartCard.tsx`
- Create: `components/stats/PrimaryAnalyticsCharts.tsx`
- Create: `components/stats/chartData.ts`
- Create: `components/stats/chartData.test.ts`
- Modify: `components/StatsChartsView.tsx:1-115`
- Create: `components/stats/AnalyticsDashboard.dom.test.tsx`

**Interfaces:**
- Consumes: `FateAnalyticsResult.timeline`, `outcomeComposition`, `histogram`, `categories`, and `streaks`.
- Produces: observed/expected, outcome donut, histogram, source bars, and streak timeline with accessible summaries; `downsampleTimeline(points, maxPoints)` for drawing only.

- [ ] **Step 1: Write failing render-helper and dashboard tests**

Test downsampling preserves first/last points and never exceeds the cap:

```ts
it('downsamples render data without changing endpoints', () => {
  const points = Array.from({ length: 1000 }, (_, index) => ({ index } as TimelinePoint));
  const sampled = downsampleTimeline(points, 400);
  expect(sampled).toHaveLength(400);
  expect(sampled[0]).toBe(points[0]);
  expect(sampled.at(-1)).toBe(points.at(-1));
});
```

In the DOM test, mock Recharts primitives as semantic wrappers that preserve children and assert all five headings plus neighbouring text summaries:

```ts
for (const heading of [
  'Observed vs expected',
  'Outcome composition',
  'Roll distribution',
  'Source performance',
  'Streak timeline',
]) {
  expect(host.textContent).toContain(heading);
}
expect(host.querySelectorAll('[data-chart-summary]').length).toBeGreaterThanOrEqual(5);
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run components/stats/chartData.test.ts components/stats/AnalyticsDashboard.dom.test.tsx`

Expected: FAIL because chart helpers and primary chart components do not exist.

- [ ] **Step 3: Implement the shared chart frame**

`AnalyticsChartCard` accepts `title`, `subtitle`, `summary`, `empty`, and children. It renders an `<article aria-label={title}>`, visible title/subtitle, a `data-chart-summary` paragraph, and either the chart or a specific empty-state message. Do not render empty axes.

- [ ] **Step 4: Implement render-only downsampling**

`downsampleTimeline` returns the original array when at or below the cap. Otherwise select evenly spaced indices including `0` and `length - 1`; deduplicate rounded indices. The analytics result itself remains unchanged.

- [ ] **Step 5: Implement primary Recharts views**

Use:

- `ComposedChart` with actual/expected lines, lower/upper area, and pity markers;
- `PieChart` with four labelled outcome slices;
- `BarChart` with observed bars and optional expected line/second bar plus coverage label;
- horizontal diverging `BarChart` for category delta with attempt/sample tooltips; and
- a compact full-width segmented streak band using ordinary DOM blocks so miss, pity, and win remain patterned/labelled without relying on colour.

Every custom tooltip states actual numerator/attempt denominator, expected value, and probability coverage. Set animation props from `window.matchMedia('(prefers-reduced-motion: reduce)')` via a small `useReducedMotion()` helper local to the chart module.

- [ ] **Step 6: Make `StatsChartsView` the dashboard composition boundary**

Change its props from `stats: any` to:

```ts
interface Props {
  analytics: FateAnalyticsResult;
}
```

Render `PrimaryAnalyticsCharts` and a temporary empty container reserved for Task 6's secondary charts; `AnalyticsKpis` already renders outside the Suspense boundary in `StatsModal`. Do not restore any calculation inside the chart component.

- [ ] **Step 7: Run chart and modal tests**

Run: `npx vitest run components/stats/chartData.test.ts components/stats/AnalyticsDashboard.dom.test.tsx components/StatsModal.dom.test.tsx`

Expected: PASS with five chart frames, summaries, and no `any` analytics prop.

- [ ] **Step 8: Commit primary visualizations**

Create `/tmp/fate-analytics-task-5.txt` with:

```text
feat: add primary Fate Analytics visualizations

Visualize observed versus expected outcomes, outcome composition, roll
distribution, source performance, and streaks with accessible summaries.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```bash
git add -- components/StatsChartsView.tsx components/stats/AnalyticsChartCard.tsx components/stats/PrimaryAnalyticsCharts.tsx components/stats/chartData.ts components/stats/chartData.test.ts components/stats/AnalyticsDashboard.dom.test.tsx
git commit -F /tmp/fate-analytics-task-5.txt
```

### Task 6: Add calibration, rewards, activity heatmap, and notable moments

**Files:**
- Create: `components/stats/SecondaryAnalyticsCharts.tsx`
- Create: `components/stats/NotableMoments.tsx`
- Modify: `components/stats/chartData.ts`
- Modify: `components/stats/chartData.test.ts`
- Modify: `components/StatsChartsView.tsx`
- Modify: `components/stats/AnalyticsDashboard.dom.test.tsx`

**Interfaces:**
- Consumes: `calibration`, `keyAcquisition`, `activityDays`, and `notables` from `FateAnalyticsResult`.
- Produces: the remaining four approved visual sections and `buildCalendarGrid(days, endDate)` for a continuous local-day heatmap.

- [ ] **Step 1: Write failing calendar and secondary-chart tests**

Pin local-day filling and all approved headings:

```ts
it('fills missing local calendar days with zero attempts', () => {
  const grid = buildCalendarGrid([
    { date: '2026-08-18', attempts: 2 },
    { date: '2026-08-20', attempts: 1 },
  ], '2026-08-20', 3);
  expect(grid).toEqual([
    { date: '2026-08-18', attempts: 2 },
    { date: '2026-08-19', attempts: 0 },
    { date: '2026-08-20', attempts: 1 },
  ]);
});
```

Assert Dashboard text contains `Probability calibration`, `Key acquisition`, `Activity calendar`, and `Notable moments`, bringing `data-chart-summary` count to at least nine.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run components/stats/chartData.test.ts components/stats/AnalyticsDashboard.dom.test.tsx`

Expected: FAIL because calendar grid and secondary charts do not exist.

- [ ] **Step 3: Implement calibration and Key acquisition charts**

Use a `ComposedChart` for calibration with predicted and actual rates on the same 0–100% axis; tooltips show bin attempts and mean predicted rate. Use a stacked `BarChart` for exact `normalStandard`, `greedStandard`, `pityStandard`, and `omniStandard` rewards, plus a separate line or adjacent series for `omniKeys`. Render unverified legacy reward-event count as a patterned separate series or an adjacent labelled badge, never as an exact Key count. Labels and tooltips must say whether a mark is a Standard Key or an Omni-Key.

- [ ] **Step 4: Implement the activity calendar**

`buildCalendarGrid` works with local date strings and returns a continuous requested day window. Render a 7-row CSS grid of focusable `<span tabIndex={0} role="img">` cells with `aria-label="20 August 2026: 3 roll attempts"`; include a numeric legend and ensure zero-attempt cells remain visible without being announced as successes/failures.

- [ ] **Step 5: Implement notable moments**

Render deterministic cards for luckiest genuine success, cruellest underlying miss, longest drought, hottest streak, most productive source, and most active day. Null notables use precise copy such as `No scoreable genuine success in this selection` rather than `0%`.

- [ ] **Step 6: Compose all nine sections**

Add `SecondaryAnalyticsCharts` and `NotableMoments` beneath the primary grid in `StatsChartsView`. Use `grid-cols-1`, `lg:grid-cols-2`, and `xl:grid-cols-3`; the observed/expected chart spans two columns only at `lg` and above.

- [ ] **Step 7: Run dashboard tests**

Run: `npx vitest run components/stats/chartData.test.ts components/stats/AnalyticsDashboard.dom.test.tsx components/StatsModal.dom.test.tsx`

Expected: PASS with nine accessible titled sections and nine text summaries.

- [ ] **Step 8: Commit secondary visualizations**

Create `/tmp/fate-analytics-task-6.txt` with:

```text
feat: complete Fate Analytics dashboard

Add probability calibration, verified reward history, the activity calendar,
and deterministic notable moments to complete the approved dashboard.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```bash
git add -- components/StatsChartsView.tsx components/stats/SecondaryAnalyticsCharts.tsx components/stats/NotableMoments.tsx components/stats/chartData.ts components/stats/chartData.test.ts components/stats/AnalyticsDashboard.dom.test.tsx
git commit -F /tmp/fate-analytics-task-6.txt
```

### Task 7: Verify agreement, accessibility, responsive behavior, and release safety

**Files:**
- Modify: `components/StatsModal.dom.test.tsx`
- Modify: `components/stats/AnalyticsDashboard.dom.test.tsx`
- Modify: `utils/fateAnalytics.test.ts`
- Modify: `components/StatsModal.tsx`
- Modify: `components/stats/*.tsx` only where verification exposes a defect

**Interfaces:**
- Consumes: the completed shared analytics engine and dashboard.
- Produces: end-to-end confidence that all views agree, legacy states are honest, phone rendering is readable, and the production bundle retains lazy loading.

- [ ] **Step 1: Add the dashboard/report agreement regression test**

Mount the modal with a fixture containing normal success, Omni, failure, Pity, Luck metadata, Greed metadata, a legacy threshold-only roll, and an unscoreable genuine win. Read visible Dashboard values, switch to Fate Report, and assert overall attempts/genuine wins plus scoreable attempts/wins, expected wins, delta, current drought, and longest drought equal the appropriate fields returned by `buildFateAnalytics` for the same query. Assert the unscoreable win does not inflate scoreable delta.

- [ ] **Step 2: Add sparse and malformed-data DOM tests**

Cover these exact states:

- no attempts: `No roll attempts in this selection`;
- zero variance: z-score `—` and no “Blessed/Forsaken” verdict;
- legacy-only probability: visible `Legacy estimates included` and enabled useful charts;
- exact records present: enabled Exact-only control;
- malformed probability/timestamp: diagnostics count it and valid KPIs remain rendered;
- unverified reward events: `confirmed` wording rather than an exact total claim.

- [ ] **Step 3: Add accessibility assertions**

Assert:

- dialog has `aria-modal="true"` and an accessible close button;
- Tab/Shift+Tab wrap within the dialog, Escape closes it, and close restores focus;
- selected tab uses `aria-selected="true"` and tab panels are labelled;
- every chart article has an accessible name and summary;
- table sort headers expose `aria-sort`;
- filters have associated labels;
- activity cells have date-and-attempt accessible names; and
- reduced-motion matching disables Recharts animation props in the mock.

- [ ] **Step 4: Run the complete automated suite**

Run: `npx vitest run`

Expected: all tests PASS. Record the exact test-file and test counts for the completion report.

- [ ] **Step 5: Run the type check**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no TypeScript errors and no `any` analytics props.

- [ ] **Step 6: Build production and inspect chunking**

Run: `npx vite build`

Expected: exit code 0. Confirm the eager `index-*.js` gzip size remains near the documented 130 kB budget and Recharts/analytics charts remain in a lazy chunk. If the eager chunk exceeds the budget, inspect imports and move chart-only imports behind `lazyWithRetry`; do not increase the budget.

- [ ] **Step 7: Verify desktop and phone flows in a fresh browser profile**

Run `npm run dev`, clear local storage, reload, complete onboarding (`Next` four times → `Enter The Void` → `Apply mode`), then create/import a deterministic fixture run. Verify:

1. Dashboard opens first and every KPI matches the fixture.
2. Pity is shown as a miss/intervention, never an RNG win.
3. All nine visual sections render with readable labels at desktop width.
4. At a 412×915 viewport, cards stack in one column, filters and tabs remain usable, no KPI or chart title clips, and the breakdown table scrolls horizontally with Source visible.
5. Exact-only and range/source filters update Dashboard, table, and Fate Report together.
6. Keyboard Tab order reaches close, filters, tabs, sortable headers, and focusable heatmap cells.
7. Reduced-motion emulation removes chart transitions.

Capture screenshots and normalized visible text for desktop and phone verification.

- [ ] **Step 8: Inspect the final diff and commit verification fixes**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Create `/tmp/fate-analytics-task-7.txt` with:

```text
test: verify Fate Analytics dashboard

Pin dashboard and report agreement, sparse and legacy states, accessibility,
responsive behavior, reduced motion, type safety, and production chunking.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

Stage only Fate Analytics files changed by verification, then commit:

```bash
git add -- components/StatsModal.tsx components/StatsModal.dom.test.tsx components/stats/AnalyticsControls.tsx components/stats/AnalyticsKpis.tsx components/stats/AnalyticsChartCard.tsx components/stats/PrimaryAnalyticsCharts.tsx components/stats/SecondaryAnalyticsCharts.tsx components/stats/NotableMoments.tsx components/stats/AnalyticsDashboard.dom.test.tsx components/stats/chartData.ts components/stats/chartData.test.ts utils/fateAnalytics.test.ts
git commit -F /tmp/fate-analytics-task-7.txt
```

- [ ] **Step 9: Prepare the handoff without publishing**

Report the branch name, local commit SHAs, exact verification outputs, build chunk sizes, desktop/phone findings, and any legacy-data limitation that remains. Do not push, create a PR, merge, or deploy without separate explicit authorization.
