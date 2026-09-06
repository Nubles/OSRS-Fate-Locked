# Browser and build regression gates

Install dependencies with `npm ci`, then install the isolated browser once with
`npx playwright install chromium` (`--with-deps` on Linux CI).
Run `npm run build:verify` followed by `npm run test:browser`.
Both CI and Pages deployment run these gates before uploading the site.
For a project subpath, set the same `VITE_BASE` for both commands.

Browser tests use a new disposable profile for each test. They exercise the
production build, not a test-only app. External artwork and online services are
fulfilled with empty successful responses to isolate the local tracker contract.
All local requests remain real. Every console error, uncaught exception and
unexpected error-boundary screen fails the test; there is no runtime-error allowlist.

Coverage includes onboarding and a first random skill unlock, persisted reload,
sync export/import, backup restore, a version-3 migration with attained levels
above method tiers, a manual diary requirement, mobile navigation, RuneProof
rendering, localStorage quota exhaustion with IndexedDB fallback, and retrying
backup protection. A further import flow verifies conditional quest advice exposes
pending checks and imported legacy history stays marked for review in Timelapse.
The mobile cold-load measurement uses a 390x844 viewport,
4x CPU slowdown, 1.6 Mbps download and 150ms latency, with cache disabled. Its
JSON measurement is attached to the test report. This is a repeatable simulated
mobile profile, not a physical-device performance claim.

Limits: these tests do not inject malformed internal RuneProof analysis into a
production component (that input boundary is covered by component tests), do not
exhaustively compare every geographical route across every screen, and do not
simulate simultaneous loss of both browser storage backends. Existing persistence
and consistency tests cover those logic boundaries separately.

`scripts/build-budgets.json` records gzip byte limits based on the reviewed
September 5 build, with modest headroom. The initial budget includes HTML-linked
JS, modulepreloads and CSS. Separate per-chunk budgets prevent hiding growth by
moving it to a specialist chunk. Statistics, model viewer and the goal planner
must retain separate lazy chunks and stay out of the initial HTML asset set.
The original baseline was approximately 384 KB initial gzip, 223 KB app JS,
89 KB game data, 300 KB model viewer, 122 KB statistics and 45 KB planner.
Adding source-backed operational conditions for all 210 quests first raised the
initial payload to 441 KB and app JS to 275 KB; the gate rejected that build.
Full provenance/raw source data was then removed from production imports and
compiled to a compact 24 KB gzip requirements artifact. The measured result is
417 KB initial and 251 KB app JS. A reviewed 25 KB allowance for this added
correctness data raises the initial limit from 405 to 430 KB and the app limit
from 240 to 265 KB. A separate 25 KB gzip artifact limit protects that allowance;
the original 441 KB raw-source regression still fails the revised gate.

The September 5 exact-location review adds fixed destination requirements for
99 further quests. Audit explanations remain in the offline source manifest,
not production imports. The measured build is 427,730 bytes initial gzip and
103,810 bytes game-data gzip. The initial 430,000-byte limit remains unchanged;
the game-data limit increases from 100,000 to 105,000 bytes for this reviewed
catalogue expansion. No other chunk limit or warning exception changes.

The two existing mixed static/dynamic import warnings for GameContext and
AchievementsModal, and the existing 500 KB uncompressed chunk warning, are
explicitly recorded. A new or repeated build warning fails verification. These
accepted warnings remain performance debt; they are not silently removed or
claimed fixed. Changing a limit or accepted warning requires reviewing the
resulting build output and the user-visible performance tradeoff.

The remaining 48 quest models add 249 fixed destinations, 13 route groups, and
compact uncertainty labels. Source explanations stay offline. The measured
initial gzip is 435,436 bytes (7,706 above the 99-quest phase), with game-data at
110,725 bytes. The corresponding limits are 438,000 and 112,000 bytes. This
reviewed data expansion adds roughly 1.8% to the initial compressed download;
all other limits, lazy-module checks, and warning checks remain unchanged.

The follow-up RuneProof reconciliation adds 27 corrected or expanded Chunked
models, including typed route permissions. Measured initial gzip is 438,478
bytes (3,042 bytes above the previous phase); game-data is 113,621 bytes. The
reviewed limits become 440,000 and 114,000 bytes. The complete item-clause
interpretations load only with QuestAccessPanel (93,532 bytes gzip); that module
now has its own 105,000-byte limit and must remain lazy. Candidate source lists
are expanded on demand and shown in batches of twelve. This retains the small
startup increase while allowing all 210 quests to expose their source evidence.


2026-09-06: Shared automatic item-source predicates and compact acquisition routes add about 9 KB compressed to initial loading (measured 447,994 bytes total). Initial limit is 450,000 bytes; per-chunk and lazy-loading limits are unchanged. Source interpretations and maps remain lazy.


### Private RuneProof redesign boundary (September 6)

The standard production build uses Goal Planner for dashboard, command-palette,
and journal goal actions. The unfinished RuneProof workspace is only included in
explicit `runeproof-preview` builds (and unit-test mode). An inherited
`VITE_RUNEPROOF_PREVIEW` environment variable does not enable it in production.
Production output excludes the entire `public/runeproof` payload; the source
files and shared quest requirement predicates are retained.

Run `npm run build` and `npm run test:browser` for public release checks.
`npx vitest run scripts/runeproof-public-bundle.test.ts` builds both variants and
checks the emitted workspace and private assets, including an inherited-flag case.
For private UI checks, run `npm run build:runeproof-preview`, then in PowerShell:

```powershell
$env:RUNEPROOF_BROWSER_PREVIEW = '1'
npx playwright test browser-tests/runeproof-source.spec.ts
Remove-Item Env:RUNEPROOF_BROWSER_PREVIEW
```

Private preview browser tests serve `dist-runeproof-preview`; default browser
checks serve `dist` and exclude RuneProof-only scenarios.
