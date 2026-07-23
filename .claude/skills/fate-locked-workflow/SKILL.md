---
name: fate-locked-workflow
description: How to work on the Fate Locked Ironman project (web app + RuneLite plugin + relay) — problem breakdown, verification discipline, known traps, and output format. Load at the start of any session touching this project.
---

# Working the Fate Locked project

You are working on a two-repo project: the web app (`Nubles/OSRS-Fate-Locked`,
React/TS/Vite, deployed to GitHub Pages on every push to main) and a RuneLite
plugin (`Nubles/RS3-Fate-Locked-Runelite`, Java, compiled ONLY by its GitHub
Actions CI). `runelite-plugin/` in the web repo is a byte-for-byte CRLF mirror
of the plugin repo — never the source of truth.

## Before anything else

1. Read `ROADMAP.md` at the web repo root. It is the canonical handoff:
   current state, conventions, and every gotcha that cost real debugging
   time. Do not rediscover what it already documents.
2. The user's local `flitest-main` download is NOT a git repo. Clone the
   GitHub repo into your session scratchpad to commit or push. Stored git
   credentials work from PowerShell; no `gh` CLI is installed.
3. Check `docs/superpowers/specs/` and `docs/superpowers/plans/` for prior
   design decisions before proposing new ones.

## How to break problems down

- **Find the choke point first.** This codebase routes every important
  question through one function, and the correct change is almost always
  there, not at the call site:
  - "is this named area open" → `utils/reachability.ts::isAreaReachable`
    (map-tint variant: `isRegionUnlocked`, same file)
  - "is this bank usable" → `isBankReachable` / `bankLocksActive`
  - gameplay randomness → `GameContext.nextFloat(purpose)` — NEVER
    `Math.random` for outcomes (breaks seeded determinism); visual jitter
    is exempt
  - which surfaces are visible → `utils/featureGates.ts::visibleFeatures`
    (retired to always-open, but still the choke point)
  - lazy imports → `utils/lazyRetry.ts::lazyWithRetry`, never bare `lazy()`
  If a diff touches many call sites for a semantic change, you picked the
  wrong layer — stop and find the choke point.
- **For features:** write a short spec (what/non-goals/components/tests) in
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, get it approved,
  then implement smallest-testable-unit first: pure function + unit test →
  UI driver → wiring. Pure logic goes in `utils/` where vitest can pin it;
  components stay thin.
- **For bugs:** reproduce before fixing. Build a real failing scenario (the
  browser preview can simulate a broken deploy by renaming a dist chunk, a
  fresh profile by clearing localStorage, etc.). Read the error path in the
  code before proposing the fix; the first plausible cause is often wrong —
  confirm with network/console evidence, not intuition.
- **For cross-boundary work (web ↔ plugin):** the bundle
  (`utils/runeliteBundle.ts` ↔ `FateLockedBundle.java`) is the contract.
  Any semantic that exists on both sides must be pinned by
  `utils/runelitePluginParity.test.ts` — a TS simulation of the Java
  resolution run against real built bundles. If you change either side,
  update the simulation in the same commit or the test is lying.

## What to verify before answering "done"

Run ALL of these for web changes, in this order, and paste real output:

```
npx vitest run        # every test green (count grows over time; never skip)
npx tsc --noEmit
npx vite build        # eager index-*.js chunk stays ≈128 kB gzip
```

Then, if the change is user-visible, drive it in the browser preview from a
**fresh profile** (`localStorage.clear(); location.reload()`), walk the
onboarding wizard ("Next" ×4 → "Enter The Void" → "Apply mode"), and check
the actual DOM/text — screenshots or innerText assertions, not assumptions.
State persists per-origin, so a stale run from an earlier check can mask
fresh-profile bugs. When comparing "before" behavior, build the prior commit
(`git stash -u; git checkout <sha>; npx vite build; git checkout main;
git stash pop`) instead of trusting a stale baseline number.

For plugin changes: there is NO local build. Push small commits and poll
`https://api.github.com/repos/Nubles/RS3-Fate-Locked-Runelite/actions/runs?per_page=1`
(unauthenticated, ~15s interval is fine) until `conclusion: success` before
claiming anything compiles. Only after CI is green: copy changed files into
the web repo's `runelite-plugin/` converting LF→CRLF, and commit the mirror.

For data changes: the test suite is the contract. Run the documented sync
scripts (`npm run content:sync`, `node scripts/sync-chunk-content.mjs`,
`node scripts/gen-banks.mjs`, `npx tsx scripts/buildSourceEnrichment.ts`)
and let the integrity tests tell you what curation is missing. When a test
fails after a resync, the fix is usually completing the curation cascade
(new boss → BOSSES_LIST + BOSS_TIERS + ACTIVITY_REGIONS + collection-log
audited counts), not loosening the test.

## Mistakes to avoid (each of these actually happened)

- **PowerShell `git commit -m` with quotes/multiline** silently splits into
  bogus pathspecs. Always write the message to a file and `git commit -F`.
- **Text matching in browser automation:** `textContent` concatenates child
  nodes with NO separators and includes stray whitespace. Normalize with
  `s.replace(/\s+/g,' ').trim()` and expect `"1Skills+10 Level Cap1/24Roll"`,
  not `"Skills +10 Level Cap"`. Anchor regexes accordingly; a loose
  `/BEGIN/` once matched "Burthorpe (Beginner)".
- **Hidden DOM targets measure 0×0** — inactive-tab content stays mounted.
  Check `rect.width > 0` before spotlighting/asserting positions.
- **Escape doesn't close every menu**; toggle the opening button instead.
  Blind coordinate clicks open random modals — never click "somewhere empty".
- **React.lazy caches rejections forever** and Chrome caches failed module
  fetches (retries reject with a mangled `undefined`-module TypeError, which
  breaks `isChunkLoadError` matching). All lazy imports go through
  `lazyWithRetry`; error paths must rethrow the FIRST chunk-load error.
- **Don't add a `vite:preloadError` reload handler** — it fires before the
  retry wrapper gets a chance and turns every blip into a full reload.
- **Don't hand-edit generated files** (`data/resourceEnrichment.ts`,
  `data/caTasks.ts`, `data/banks.ts`, `data/chunkContentLite.ts`); fix the
  generator in `scripts/` and re-run it, so the fix survives the next sync.
- **Wiki API responses start with a BOM** — strip it before `JSON.parse`.
  The wiki blocks Node `fetch`; shell out to `curl` with a desktop UA.
- **RuneLite API imports from memory are wrong often enough to break CI**
  (`LootReceived` lives in `client.plugins.loottracker`, not
  `client.events`). Verify against existing imports in the file or the live
  javadocs before using a new type.
- **Bundle fields degrade gracefully or not at all:** older plugins must
  ignore new bundle fields, and the plugin must keep a fallback when a field
  is absent (see `freeAreas`). Never repurpose an existing field.
- **Webhook URLs and relay write-tokens never travel with GameState** —
  exports/sync codes must not leak them. New persistent secrets go in
  per-profile localStorage OUTSIDE GameState.
- **The web deploy ships on every push to main.** Nothing lands there
  un-verified; there is no staging.

## How to structure output

- Lead with the outcome in one or two sentences ("X is done and pushed as
  `<sha>`; CI is green"), then supporting detail. Never end a turn on a plan
  or promise — do the work first.
- Report failures verbatim (test names, error text), including ones you
  caused and then fixed — say what broke, why, and what proved the fix.
- When you find something mid-task that changes the picture (a second bug, a
  stale doc number), state it explicitly rather than silently absorbing it;
  flag follow-ups you deliberately did not do and why.
- Commits: imperative subject, body explains the why and the contract
  (which test pins it), `Co-Authored-By: Claude <model> <noreply@anthropic.com>`
  trailer. Small commits for the plugin (CI is the only compile check).
- Link commits/PRs as URLs, file references as `path:line`.
- When the user asks for an audit ("ensure X is accurate"), the deliverable
  is: what was already correct (verified how), what drifted (fixed how), and
  what guarantees future drift gets caught (usually a new pinned test) —
  plus an honest statement of what the audit does NOT cover.
