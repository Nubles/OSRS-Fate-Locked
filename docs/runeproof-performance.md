# RuneProof performance and solver decision

Measured on 2026-07-29 on a Windows development machine (24 logical
processors), Node 25.6.1, npm 11.9.0, and Vitest 4.1.6. Each row is 20
sequential runs. The table uses nearest-rank median and 95th percentile
measurements from `utils/runeproof/performance.test.ts`.

## Audited corpus and method

The compiler benchmark rebuilds the complete checked-in raw input and checks
the exact generated source versions, rule and unresolved counts, and all 3,833
trusted acquisition-source identities against the checked-in catalogs. Each
iteration retains only two short version fingerprints, not the twenty compiled
documents.

Queries use the production source document and the source audit returned by
`loadRuneProofSourceAudit()`. Deterministic recursive, alternative-quest, and
blocker fixtures add rules to that graph rather than replacing it. Cold queries
construct an engine; cached queries use `RuneProofService` after one warm
evaluation.

The recursive fixture has 14 production edges plus its base source. The exact
blocker case is a real Cartesian frontier: an `ALL` of seven binary `ANY`
branches yields all 128 minimal size-seven blocker sets. The export case selects
20 distinct positive proofs and authoritatively calls `engine.evaluate` for
every summary (400 replay evaluations across the 20 benchmark iterations).

| Case | Median | p95 | Acceptance |
| --- | ---: | ---: | --- |
| Cold source compilation | 3344.143 ms | 3678.165 ms | Recorded; offline source-build work |
| Cold ordinary direct-item query | 0.419 ms | 1.052 ms | Under 250 ms |
| Cached ordinary direct-item query | 0.005 ms | 0.030 ms | Under 50 ms |
| Deep recursive production goal | 2.402 ms | 3.669 ms | Exact 15-step witness |
| Quest with alternatives | 2.761 ms | 3.479 ms | Exact current alternative selected |
| Exact 128-set blocker frontier | 1.211 ms | 1.725 ms | Under 1 second |
| 20 pinned proofs with engine replay | 8.199 ms | 12.386 ms | 20 hashes replayed and emitted |
| Production worker initialization clone | 0.012 ms | 0.021 ms | Under 10 ms |
| Subsequent worker request clone | 0.028 ms | 0.040 ms | Under 10 ms |

The raw compiler processes more than 19,000 unresolved evidence records. It is
offline source-generation/audit work, not part of an interactive question.

## Bounds and worker behavior

The checked-in tests force every relevant safety breach:

- `maxRoutes: 0` returns `UNKNOWN`, removes partial routes and blockers, and
  sets `routesComplete: false`.
- Eight binary blocker branches would produce 256 sets, so the exact analysis
  returns `UNKNOWN` at `maxBlockerSets: 128`.
- An `ALL` of 17 distinct gates needs one 17-fact blocker set, so analysis
  returns `UNKNOWN` at `maxSetSize: 16`.

Production initialization posts only the versioned same-origin acquisition
URL, source audit, source version, and location graph. The worker owns a single
initialization promise and fetches/parses the large acquisition document before
evaluating queued requests. It runs the same complete structural and
cross-reference validator as the pure engine, recomputes the exact canonical
SHA-256 while excluding only `sourceVersion`, requires both declared versions
to match that digest, and freezes the accepted document. The full-source
initialization message remains available for fixtures.

HTTP, JSON parsing, payload-shape, cross-origin, source-version, and canonical
integrity failures are fatal worker initialization errors. The adapter
terminates the worker, replays pending requests through the same pure engine,
and permanently sends future requests to that fallback. Disposal terminates the
worker and rejects pending and future work with `AbortError`; modal-owned
services dispose on unmount while injected services remain caller-owned.

The structured-clone rows are protocol-cost proxies, not a real-browser React
responsiveness or rendering benchmark. They establish that production no
longer clones the large acquisition corpus on the main thread and that ordinary
request messages stay small.

## SAT / pseudo-Boolean decision

Do not add a SAT or pseudo-Boolean dependency now.

The current bounded hypergraph solver enumerates the actual 128-way Cartesian
blocker frontier exactly in 1.725 ms p95 and fails closed before the 256-way
case. Cold, cached, recursive, alternative, and proof-replay timings are also
well below their acceptance budgets. A SAT layer would add bundle size, a
second encoding to audit, and more certificate surface without improving the
comparatively expensive offline source compilation.

Revisit an `AlternativeSolver` only when checked-in evidence demonstrates at
least one of these conditions:

1. an exact supported goal breaches a configured route or blocker bound;
2. a supported exact result cannot be represented by the hypergraph evaluator;
3. cold, cached, blocker, or export p95 exceeds its acceptance budget after
   profiling.

The fixed-point evaluator and proof replay remain authoritative even if that
threshold is reached.

## Reproduce

```powershell
npm test -- --run utils/runeproof/performance.test.ts --disableConsoleIntercept
npm run build
```
