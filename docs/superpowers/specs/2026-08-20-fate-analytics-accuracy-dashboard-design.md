# Fate Analytics Accuracy Dashboard Design

**Date:** 2026-08-20
**Status:** Approved design, awaiting implementation planning

## Goal

Replace Fate Analytics' duplicated and partly incorrect calculations with one
auditable analytics engine, then present the results as a visualization-rich,
mobile-friendly dashboard.

The dashboard must distinguish random success from reward mechanics. In
particular, a Pity Key is a failed underlying RNG roll followed by a pity
intervention; it must never inflate genuine RNG wins, luck deviation, source
success rates, or hot streaks.

## Confirmed Current Defect

The reducer stores a Pity entry with `type: 'PITY'` and `result: 'SUCCESS'`.
`isRollEntry()` correctly includes it because it is still a roll attempt, but
both `StatsModal.buildStats()` and `buildFateReport()` currently use
`result === 'SUCCESS'` as the random outcome. That causes one Pity entry to be
counted as all of the following:

- a roll attempt;
- a genuine RNG success;
- a Pity Key; and
- a success in luck, source-rate, and streak calculations.

The revised contract keeps the first and third meanings and removes the false
second and fourth meanings.

## Scope

This change covers:

- a single typed analytics engine for every Fate Analytics surface;
- corrected outcome, expectation, streak, source, and reward calculations;
- exact metadata on newly generated roll history entries;
- honest coverage labels for legacy history;
- the selected **Analytics Dashboard** layout;
- shared filters and accessible chart explanations;
- the sortable activity breakdown and Fate Report migration; and
- focused unit, component, accessibility, and production-build verification.

## Non-goals

- Changing Key, Omni-Key, Chaos-Key, Fate, pity, Luck, or Greed gameplay rules.
- Rewriting or mutating existing history entries.
- Guessing whether Luck was active on a legacy roll when the history did not
  record it.
- Pretending to know exact Greed payouts for legacy entries that did not record
  `standardKeysAwarded`.
- Uploading analytics or comparing a player with a community cohort.
- Adding a backend, telemetry, tracking, or a new chart dependency.
- Changing the standalone RuneLite plugin or relay protocol.

## Statistical Contract

### Roll classification

Every `ROLL_SUCCESS`, `ROLL_OMNI`, `ROLL_FAIL`, or `PITY` entry is one roll
attempt.

| Entry type | Genuine RNG success | Pity intervention | Omni reward |
| --- | ---: | ---: | ---: |
| `ROLL_SUCCESS` | Yes | No | No |
| `ROLL_OMNI` | Yes | No | Yes |
| `ROLL_FAIL` | No | No | No |
| `PITY` | No | Yes | No |

The entry type is authoritative for the displayed outcome. When `rollValue`
and `threshold` are both valid, the analytics engine also checks that the raw
comparison agrees. A disagreement is reported through data-quality diagnostics
and excluded from probability-derived figures rather than silently repaired.

### Expected genuine successes

Each scoreable roll contributes its genuine success probability `p`:

```text
expected successes = Σp
variance = Σ p(1 − p)
delta = genuine RNG successes − expected successes
z-score = delta / √variance
```

When variance is zero, the z-score is unavailable. It is not forced finite by
an arbitrary denominator. The numeric z-score is available whenever variance
is non-zero, but narrative verdict text is withheld until the selection has at
least 10 scoreable rolls; smaller selections show “Building sample.”

For a normal single-draw roll:

```text
p = effectiveThreshold / 100
```

For a Luck roll that selects the lower of two independent draws:

```text
p = 1 − (1 − effectiveThreshold / 100)²
```

Both formulas use the clamped effective threshold recorded by the roll engine,
so decimal skill odds and exact Vanilla boss/clue odds retain their real
precision.

The cumulative chart displays observed genuine successes, cumulative expected
successes, and an expected corridor of `expected ± 2√variance`, bounded to the
possible range `[0, attempts]`. The corridor is labelled “±2 standard
deviations”; it is not described as an exact confidence interval.

### Reward accounting

Random performance and currency rewards are separate measures:

- `genuineRngWins` counts `ROLL_SUCCESS` and `ROLL_OMNI` events.
- `pityInterventions` counts `PITY` events.
- `omniKeysAwarded` counts `ROLL_OMNI` events.
- `standardKeysAwarded` sums exact per-entry metadata when present.
- Greed may award two Standard Keys from one genuine RNG win.
- An Omni event remains one genuine RNG win and awards its separately tracked
  Omni-Key plus the recorded Standard Key payout.
- A Pity event remains a failed RNG roll and awards its recorded Standard Key.

Exact Standard Key totals are shown only for entries that record the payout.
When a selected range mixes exact and legacy reward entries, the UI reports the
confirmed subtotal and its coverage, for example “42 confirmed · 61/74 reward
events recorded.” It does not infer an exact total from message text.

### Streaks and notable events

Hot streaks use only consecutive genuine RNG successes. Droughts count every
consecutive underlying RNG failure, including a failure that triggered pity.
A pity intervention is marked on the drought timeline but does not turn the
underlying failure into a hot-streak event.

- **Luckiest success:** genuine success with the lowest exact `p`.
- **Cruellest miss:** RNG failure with the highest exact `p`, including pity
  failures.
- **Current drought:** failures since the latest genuine RNG success.
- **Longest drought:** longest consecutive failure sequence.
- **Longest hot streak:** longest consecutive genuine-success sequence.

Ties use the earliest timestamp and then stable history order, making results
deterministic even when imported entries share a timestamp.

### Source and category aggregation

Raw source labels remain visible in the activity table. Higher-level charts use
the existing `rollCategory()` policy so labels such as `Quest (Master)` group
under `Quest` and collection-log rolls group under `Collection Log`.

Each aggregate includes attempts, genuine wins, expected wins, delta, variance,
z-score when available, pity interventions, actual success rate, expected
success rate, and probability-coverage counts. Sample-size labels are descriptive
only:

- fewer than 10 scoreable rolls: limited sample;
- 10–29: developing sample;
- 30 or more: established sample.

The UI never presents those labels as statistical significance.

## New Roll Metadata

New roll history entries record the following fields inside `meta` for every
mode and activity, not only contextual Vanilla boss/clue rolls:

```ts
interface RollAnalyticsMeta {
  successProbability: number; // 0..1 after Luck advantage
  luckApplied: boolean;
  drawResolution: 1000 | 10000; // standard or exact contextual roll units
  standardKeysAwarded: number; // integer 0..2
  rewardKind: 'normal' | 'greed' | 'pity' | 'omni' | 'none';
}
```

The reducer computes these values from the same prepared roll result and
pre-reset buff state that determine gameplay. Analytics never performs a new
random draw and never changes deterministic seeded-run ordering.

Existing contextual fields such as boss name, clue tier, effective rate,
reserve, and `outcome` remain intact. The new universal fields supplement them;
they do not repurpose an existing field.

No save migration rewrites history. `LogEntry.meta` is already extensible, so
new fields are additive and old exports remain valid.

## Legacy History and Data Quality

Legacy entries fall into explicit coverage classes:

1. **Exact outcome:** entry type reliably distinguishes RNG success, failure,
   pity, and Omni.
2. **Exact probability:** `meta.successProbability` exists and is finite.
3. **Estimated probability:** a valid threshold exists but Luck metadata does
   not. The estimate uses the single-draw threshold and is labelled legacy.
4. **Unscoreable:** probability data is absent, malformed, or internally
   inconsistent.
5. **Exact reward:** `meta.standardKeysAwarded` exists and is valid.
6. **Unverified reward:** the event predates universal reward metadata.

The dashboard displays a compact data-quality summary such as:

```text
Outcomes verified: 248/248 · Probabilities exact: 37/248 ·
Legacy estimates: 209 · Unscoreable: 2 · Rewards exact: 41/45
```

Probability-based charts include legacy estimates by default so an established
run remains useful, with the coverage warning always visible. An **Exact only**
toggle is available whenever exact records exist; selecting it excludes legacy
estimates and unscoreable entries from probability-derived figures.

Overall attempts, genuine outcomes, pity, streaks, activity, and rewards remain
visible when Exact only is selected. Expected wins, observed wins used for the
luck delta, variance, z-score, calibration, probability notables, and the
observed/expected timeline all use the identical scoreable cohort. The UI shows
that cohort's numerator and coverage so unscoreable wins can never inflate a
partial-expectation comparison.

## Filters

One filter state applies to KPI cards, charts, notable moments, and the activity
table:

- all time;
- last 30 days;
- last 100 roll attempts; and
- one source/category or all sources.

Date boundaries use the browser's local calendar and the entry timestamps.
“Last 100” selects the latest 100 attempts after chronological ordering. Charts
rebase cumulative values to zero for the filtered subset and state that in the
chart subtitle.

Changing a filter never mutates saved data. Empty selections produce an
explanation and a clear reset control.

## Dashboard Information Architecture

Opening Fate Analytics lands on the selected **Analytics Dashboard**. The
modal retains secondary **Activity Breakdown** and **Fate Report** tabs. The
old separate overview and visualizations tabs are consolidated so the main
screen communicates the whole run at a glance.

### KPI cards

- roll attempts;
- genuine RNG wins;
- expected wins;
- standardized luck z-score and plain-language delta;
- pity interventions;
- Omni-Keys awarded;
- confirmed Standard Keys awarded with coverage; and
- current and longest dry streak.

### Visualizations

1. **Observed vs expected timeline** — cumulative actual and expected genuine
   successes with the ±2-standard-deviation corridor and pity markers.
2. **Outcome composition donut** — genuine normal wins, Omni wins, misses, and
   pity interventions as mutually exclusive attempt outcomes.
3. **Roll distribution histogram** — observed roll values in exact five-point
   buckets (`0.01–5.00`, `5.01–10.00`, through `95.01–100.00`) so two-decimal
   Vanilla rolls are labelled honestly. An expected overlay appears only for
   entries whose one-draw/two-draw model and draw resolution are known; its
   coverage is shown beside the legend.
4. **Source performance diverging bars** — category delta from expectation,
   with attempts and sample label in the tooltip.
5. **Streak timeline** — compact chronological bands for genuine wins, misses,
   and pity interventions, with the current selection highlighted.
6. **Probability calibration chart** — attempts grouped by predicted chance,
   comparing mean predicted rate with actual genuine-win rate. Empty bins are
   omitted and small samples are labelled.
7. **Key acquisition timeline** — exact recorded normal, pity-derived, Greed,
   and Omni-derived Standard Keys over time, with the separately awarded
   Omni-Key shown as its own series. Legacy-unverified rewards are visibly
   hatched or listed separately rather than guessed.
8. **Activity calendar heatmap** — roll-attempt count per local calendar day,
   independent of whether the roll succeeded.
9. **Notable moments panel** — luckiest success, cruellest miss, longest
   drought, hottest streak, most productive source, and most active day.

Every tooltip states the numerator, denominator, expectation, and coverage
needed to interpret the mark. Colour is never the only distinction: outcomes
also use labels, icons, line styles, or patterns.

## Activity Breakdown

The sortable table contains:

- source;
- attempts;
- genuine RNG wins;
- expected wins;
- delta;
- actual and expected success rates;
- pity interventions;
- confirmed Standard Key rewards;
- probability coverage; and
- sample label.

Sorting handles unavailable values explicitly and remains stable. On narrow
screens the source column remains visible while numeric columns use an
accessible horizontal scroll region.

## Fate Report

`buildFateReport()` delegates to the shared analytics result instead of
recomputing rolls independently. Existing narrative verdicts and category
cards remain, but they consume corrected genuine outcomes and exact/estimated
coverage. The report displays total attempts/genuine wins separately from the
scoreable rolls/wins used for expectation and luck delta. This guarantees that
the dashboard, table, and Fate Report cannot disagree about overall or
scoreable counts, expected wins, delta, streaks, or notable rolls.

The existing Key Economy evidence export remains based on full run history,
game mode, and overall completion rather than the dashboard's temporary
analytics filters, so exported evidence is never silently truncated.

## Architecture

### Analytics choke point

Add `utils/fateAnalytics.ts` as the only place that interprets roll history for
statistics. It exposes typed input filters, coverage diagnostics, summary
metrics, source/category aggregates, and chart-ready datasets.

`StatsModal.tsx` becomes a thin state and presentation shell. It owns filters,
tab navigation, and the accessible activity table, but contains no probability
formula or roll classification.

`StatsChartsView.tsx` remains the lazy Recharts boundary and composes focused
chart components under `components/stats/`. Shared chart cards, legends,
tooltips, empty states, and patterns prevent nine charts from becoming one
unmaintainable component.

`utils/fateReport.ts` becomes an adapter over `fateAnalytics.ts` or is replaced
by a compatibility export with the same public function name. Existing callers
do not retain a separate statistics implementation.

`utils/rollDistribution.ts` either delegates to the analytics histogram builder
or remains a low-level bucket helper with no outcome interpretation.

### Data flow

```text
GameContext roll transition
  → persisted LogEntry + exact analytics metadata
  → buildFateAnalytics(history, filters)
  → one immutable analytics result
  → Dashboard / Activity Breakdown / Fate Report
```

The builder sorts a copied array and never mutates `history`. Stable history
order breaks timestamp ties.

### Performance

The Stats modal remains lazy-loaded from `App.tsx`. Recharts and chart
components remain in a secondary lazy chunk. Analytics uses one memoized pass
over the filtered history plus bounded aggregation passes; no chart rescans the
raw history independently.

Large timelines are downsampled only for drawing, never for KPI calculations or
tooltips. The full roll count remains visible.

## Responsive and Accessible Behaviour

- Desktop uses the selected dashboard grid: KPI row, wide primary timeline,
  and supporting two- or three-column chart cards.
- Phones use one column with full-width cards and readable fixed minimum chart
  heights. Charts never shrink into illegible thumbnails.
- Filter and tab rows may scroll horizontally but retain keyboard focus and
  visible labels.
- Range-filtered source/category choices remain available while one scope is
  selected; the active scope does not collapse its own option list.
- Every chart has a neighbouring concise text summary and an accessible name.
- Tables use real headers and `aria-sort`.
- Interactive controls are keyboard operable with visible focus.
- Calendar heatmap cells are focusable and announce their local date and
  attempt count even though they do not act as filters.
- Reduced-motion users receive no animated chart transitions.
- Empty, sparse, exact-only, legacy-estimate, and unscoreable states each have
  specific copy rather than a generic zero.

## Error Handling

- Malformed numeric metadata is excluded from derived calculations and counted
  in diagnostics.
- Invalid timestamps remain available to all-time numeric statistics but are
  excluded from date filters and the calendar heatmap.
- A source-less roll is grouped under `Unknown source` and reported in quality
  diagnostics.
- A zero-variance selection shows delta and expectation but no z-score/verdict.
- A chart with insufficient scoreable data renders its explanation and coverage
  rather than an empty axis.
- Rendering one unavailable metric does not hide valid KPIs from the same
  selection.

## Testing

### Pure analytics tests

- Pity is one attempt, one RNG failure, one pity intervention, and zero genuine
  wins.
- A Pity entry extends a drought and cannot extend a hot streak.
- Normal and Omni entries count as genuine wins; Omni is separately counted.
- Greed can award two Standard Keys from one genuine win.
- Contextual caps that reduce Greed to one Key use the recorded payout.
- A single-draw roll uses `threshold / 100`.
- Luck uses `1 − (1 − p)²`, including 0% and 100% boundaries.
- Standard and exact contextual rolls record 1,000 and 10,000 draw units
  respectively, allowing an exact histogram expectation.
- Decimal skill and exact Vanilla contextual rates preserve their precision.
- Expected wins, variance, delta, and z-score match hand-calculated fixtures.
- Zero variance produces an unavailable z-score, not a clamped value.
- Luckiest, cruellest, current drought, longest drought, and hot streak use the
  corrected outcome model.
- Category grouping and raw-source aggregation remain deterministic.
- Each filter produces the correct ordered subset.
- Invalid timestamps do not corrupt all-time statistics.
- Exact, legacy-estimated, unscoreable, exact-reward, and unverified-reward
  coverage totals are correct.
- Histogram expectation accounts for known Luck advantage and never claims an
  expected overlay for unknown legacy draw models.
- Calibration bins omit empty bins and retain their real sample counts.

### Transition and compatibility tests

- Every new normal, Greed, pity, and Omni history entry records the universal
  analytics metadata.
- `successProbability` comes from the effective threshold and pre-reset Luck
  state.
- Adding metadata consumes no extra RNG draw and leaves seeded outcomes stable.
- Existing contextual Vanilla metadata remains present.
- Existing exports without the new metadata still load unchanged.

### Component tests

- Dashboard KPI labels distinguish RNG wins, pity, Omni, and confirmed Standard
  Key rewards.
- Filters update every visible dashboard section from the same result.
- Data-quality coverage and legacy-estimate controls are visible when relevant.
- Empty and zero-variance states use the approved explanatory copy.
- Activity table sorting is stable and exposes `aria-sort`.
- The modal traps focus, closes correctly, and remains keyboard navigable.
- Mobile-width rendering stacks cards without clipping chart labels or KPI
  values.
- Dashboard and Fate Report display identical attempts, expectation, actual,
  delta, and streak figures for the same fixture.

### Full verification

Run the repository-required sequence:

```text
npx vitest run
npx tsc --noEmit
npx vite build
```

Then open a browser preview from a fresh profile, complete onboarding, generate
normal, failed, pity, Greed, Luck, and Omni fixtures where practical, and verify
the actual desktop and phone-width DOM. Confirm that the eager index chunk
remains near the repository's documented gzip budget and that Recharts remains
outside it.

## Acceptance Criteria

- Pity never counts as a genuine RNG success anywhere in Fate Analytics.
- Dashboard, Activity Breakdown, and Fate Report read one shared analytics
  result and cannot disagree on core figures.
- Luck expectation uses its real two-draw probability for newly recorded rolls.
- Greed rewards are counted as Keys, not additional RNG wins.
- Legacy uncertainty is visible and no unavailable fact is silently guessed.
- The selected dashboard provides all nine approved visual sections and remains
  readable on a phone.
- Charts have accessible labels, text summaries, keyboard-accessible filters,
  and colour-independent distinctions.
- Existing saves and seeded-run determinism remain intact.
- The complete test suite, type check, production build, and fresh-profile
  browser verification pass before any release to `main`.
