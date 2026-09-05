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
backup protection. The mobile cold-load measurement uses a 390x844 viewport,
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

The two existing mixed static/dynamic import warnings for GameContext and
AchievementsModal, and the existing 500 KB uncompressed chunk warning, are
explicitly recorded. A new or repeated build warning fails verification. These
accepted warnings remain performance debt; they are not silently removed or
claimed fixed. Changing a limit or accepted warning requires reviewing the
resulting build output and the user-visible performance tradeoff.
