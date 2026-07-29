# RuneProof performance and solver decision

Measured on 2026-07-29 on a Windows development machine (24 logical
processors), Node 25.6.1, npm 11.9.0, and Vitest 4.1.6. Each row is 20
sequential runs. The table uses nearest-rank median and 95th percentile
measurements from `utils/runeproof/performance.test.ts`.

## Audited corpus and method

The benchmark compiles the complete checked-in raw source input and verifies
that it produces the same corpus size as `public/runeproof-sources.json`:
162 exact acquisition rules and 19,039 unresolved sources. Query cases always
retain all 162 checked-in exact rules. The recursive production, alternative
quest, and bounded blocker fixtures add deterministic rules at the audited
starting location instead of replacing the real graph.

Cold queries construct a new engine. Cached queries use the app-facing
`RuneProofService` after one warm evaluation. The recursive fixture has
14 production edges plus its direct base source. The blocker fixture has the
maximum supported 16 current-route gates. The export case rechecks and emits
20 distinct pinned positive proof summaries, including certificate hashes.

| Case | Median | p95 | Acceptance |
| --- | ---: | ---: | --- |
| Cold source compilation | 3718.304 ms | 4492.116 ms | Recorded; offline source-build work |
| Cold ordinary direct-item query | 0.514 ms | 1.131 ms | Under 250 ms |
| Cached ordinary direct-item query | 0.011 ms | 0.051 ms | Under 50 ms |
| Deep recursive production goal | 2.358 ms | 3.986 ms | Exact 15-step witness |
| Quest with alternatives | 3.261 ms | 4.949 ms | Exact current alternative selected |
| Worst checked-in blocker fixture | 0.214 ms | 0.286 ms | Under 1 second |
| 20 pinned proof exports | 1.470 ms | 2.134 ms | 20 hashes rechecked and emitted |
| One-time worker source initialization clone | 52.347 ms | 56.808 ms | Paid once per worker |
| Subsequent worker request clone | 0.007 ms | 0.014 ms | Under 10 ms |

The raw compiler timing is intentionally separate from interactive solving.
It processes more than 19,000 unresolved evidence records and runs during
source generation/audit, not when a player asks RuneProof a question.

## Bounds and responsiveness

The checked-in test forces both classes of safety breach:

- `maxRoutes: 0` returns `UNKNOWN`, removes partial routes and blockers, and
  sets `routesComplete: false`.
- A 17-gate blocker expression exceeds `maxSetSize: 16` and returns the same
  fail-closed report. The diagnostic names the breached bound.

No measured fixture silently reached the default 10,000-route,
1,000-iteration, 128-blocker-set, or 16-blocker-size limits.

Browser solving stays off the React call stack. The worker receives the 23 MB
source corpus once at initialization. Every subsequent uncached request sends
only its query and current-run snapshot; its structured-clone p95 is 0.014 ms.
The two-query protocol regression proves there is exactly one initialization,
neither query resends `sources`, and each request remains unsettled until its
worker response. The one-time source clone is visible separately in the table
instead of being hidden inside the query measurements.

Worker construction or one-time initialization failure selects the
deterministic in-process fallback. Later worker errors replay pending requests
through that same fallback, so the optimization does not weaken result or run
freshness behavior.

## SAT / pseudo-Boolean decision

Do not add a SAT or pseudo-Boolean dependency now.

The selective fixed-point and bounded hypergraph implementation produced every
required exact result. Interactive p95 timings are below their budgets by wide
margins, and no checked-in fixture needs incomplete route or blocker
enumeration. A SAT layer would add bundle size, a second encoding to audit, and
more proof-replay surface without resolving the only comparatively expensive
operation: offline raw-source compilation.

Revisit an `AlternativeSolver` only when checked-in evidence demonstrates at
least one of these conditions:

1. an exact supported goal breaches a configured route or blocker bound;
2. a supported exact result cannot be represented by the hypergraph evaluator;
3. cold, cached, or blocker p95 exceeds its acceptance budget after profiling.

The fixed-point evaluator and proof replay remain authoritative even if that
threshold is reached.

## Reproduce

```powershell
npm test -- --run utils/runeproof/performance.test.ts --disableConsoleIntercept
npm run build
```
