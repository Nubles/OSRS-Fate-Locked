# Roadmap & Maintainer Handoff

Everything in flight, everything planned, and every gotcha learned the hard
way — written so the project can keep moving without any particular
contributor. Last updated: September 2026.

---

## 1. RuneLite Plugin Hub release (shipped)

The Plugin Hub entry
[`plugins/fate-locked-ironman`](https://github.com/runelite/plugin-hub/blob/master/plugins/fate-locked-ironman)
builds commit `874b9d106cad72c1a0d03addcd25237d2e1220e3` of
[Nubles/OSRS-Fate-Locked-Runelite](https://github.com/Nubles/OSRS-Fate-Locked-Runelite)
(the Stage 0 safety release, 25 September 2026,
[runelite/plugin-hub#17110](https://github.com/runelite/plugin-hub/pull/17110)),
not that repository's `main`; check the entry for the current pin.

Plugin changes reach players only through a Plugin Hub pull request that
bumps `commit=`. The plugin repository's CONTRIBUTING.md has the steps and
the in-game checklist to run first. Stage 1 is in progress
([plugin PR #19](https://github.com/Nubles/OSRS-Fate-Locked-Runelite/pull/19)).
Plugin releases are built and published only from
`OSRS-Fate-Locked-Runelite`.

## 1b. Shipped — July 2026 sprint (onboarding, safety, community)

Four features landed together; each has unit tests and follows the existing
always-mounted-driver / choke-point conventions.

1. **Progressive disclosure onboarding** (`utils/featureGates.ts`,
   `hooks/useFeatureGates.ts`, `components/FeatureRevealDriver.tsx`).
   A fresh run shows only Farm/Spend + the Character tab; every other
   dashboard tab and header tool reveals at a run milestone (first roll →
   History + Journal, first Fate Point → Altar, first boss/minigame →
   Collection Log, …), each with a history-length fallback so nothing hides
   forever. Gates derive purely from game state, so mature runs and imports
   auto-graduate silently (the driver seeds its per-profile seen-set on
   first sight). Escape hatches: "Reveal all features" in the gear menu
   (persisted `revealAllFeatures`), the ⌘K palette (never gated), and
   navigation-to-a-hidden-tab shows it (navigation = intent).

2. **Auto-backup + export nag** (`utils/backupNag.ts`,
   `components/BackupNagBanner.tsx`). GameContext drops one "Session start"
   snapshot into the backup ring per profile mount (ring grown 5 → 8 so
   session snapshots can't evict every pre-overwrite one). A dismissible
   banner under the header nags when a run with 10+ events has no .fate
   export in 7 days; Export downloads in place, dismiss snoozes 7 days.
   Only real file downloads call `markExported` — sync codes don't count
   (24h relay TTL is not durable storage).

3. **Discord webhook announcements** (`utils/discordWebhook.ts`,
   `components/DiscordSyncDriver.tsx`, `components/DiscordSettingsModal.tsx`,
   gear menu → Discord notifications). Posts an embed per unlock. The
   webhook URL lives in per-profile localStorage OUTSIDE GameState — it must
   never travel with exports/sync codes (a leaked webhook lets anyone post).
   The sender only accepts real discord.com webhook URLs, batches to the
   10-embed limit, retries once on 429. Cursor advances before sending, so
   failures drop announcements but can never double-post; enabling seeds
   the cursor to "now" so the back-catalogue never floods.

4. **Seeded runs / weekly seed** (`utils/seededRng.ts`, seed section in
   GameModePicker, `GameState.rngSeed`). Every gameplay outcome draws
   `hash(seed, newest history hash, purpose, index)` — same seed + same
   decisions = the same fate, and every roll is recomputable from a
   verified bundle. Seed is chosen at run start (weekly `FATE-YYYY-WNN`,
   custom phrase, or random), locks at the first history entry, travels
   with the save. Unseeded runs keep classic Math.random.
   **New choke point:** ALL gameplay randomness must go through
   `GameContext.nextFloat(purpose)` — never `Math.random` directly (that
   would silently break seeded determinism). Visual-only randomness is
   exempt. Current call sites: rollForKey (roll/advantage/omni), GachaSection
   table + chaos picks, Gambit, level-up chaos roll, Cartographer offers.

Follow-ups from the sprint: SET_SEED lock-rule test in gameReducer.test.ts;
seed chip on the share card + stream overlay; check GuidedTour skips its
altar step gracefully on a fresh (gated) run; CoachStrip hints could avoid
referencing still-hidden surfaces.

## 2. Product roadmap — RuneProof flagship

The product direction is the complete A–E programme: progression intelligence,
challenge mechanics, RuneLite automation, and community competition. RuneProof
is the shared foundation because every later system needs the same answers:
what the player can do now, what blocks them, what evidence proves progress,
and what action is best next.

Nothing in this section is release-approved merely because it is implemented.
Every milestone must first pass automated checks and then a local visual/play
review by the maintainer. Preview-only work must not enter the public bundle,
changelog, Pages deployment, or RuneLite release until that review is explicitly
accepted.

### P0 — RuneProof Wave 1 release candidate (in progress)

**Current testing scope (maintainer direction, 23 September 2026): Vanilla only.**
Chunked mode is experimental and is not currently official. Use Vanilla for
ongoing feature verification and release evidence; earlier Chunked test results
do not establish Vanilla readiness. The local preview now uses the separate
`Vanilla Preview` profile, preserving the earlier profile. Cook's Assistant and
The Restless Ghost were checked there: their walking routes are available under
Vanilla's area permissions, while the ghostspeak amulet still requires Neck T1.

The approved 23 September guide simplification is available locally: one readiness
message and a numbered walkthrough, with items, locations, map links, and unmet
requirements beside the affected steps. Walking details and quest reference
material are collapsed. Vanilla verification and limitations are recorded in
`docs/reviews/2026-09-23-runeproof-simple-guide-verification.md`.
The follow-up adds a compact Still needed summary above progress, with deduplicated
requirements and links to their affected steps. It updates with account unlocks;
unknown conditions remain labelled Needs checking. Vanilla verification is in
`docs/reviews/2026-09-23-runeproof-still-needed-verification.md`.
Requirement cards now include the canonical slot, skill, quest, or item artwork,
plus local map crops for known missing chunks. Unknown locations keep a generic
checking visual. See `docs/reviews/2026-09-23-runeproof-requirement-images-verification.md`.
The local Vanilla preview now contains all 24 F2P quests (227 steps), with 19 new
source-pinned packs behind the preview build boundary. The roster includes Learning
the Ropes and The Ides of Milk and excludes members-only Daddy's Home. QP gates,
step-specific equipment/Mining checks and manual Shield of Arrav partner checks are
covered by 115 focused checks; all 24 guides opened in the browser. New walking
connections still need review; Shield uses the Phoenix route and Tutorial Island
is a reference. No public deployment. See
`docs/reviews/2026-09-23-runeproof-all-f2p-preview-verification.md`.

The 24 September Vanilla follow-up repairs Diary equipment and travel gates,
guide backup/restore durability, equipment permission provenance, and legal
weapon attack choices. Verification and remaining coverage are recorded in
`docs/reviews/2026-09-24-vanilla-follow-up-repairs.md`. This remains a local
preview; the public guide roster and deployment boundary are unchanged.

A second local Vanilla review aligns quest doability with the Journal, corrects
completion and Quest Cape accounting, and repairs share-card presentation and
history status. Evidence and remaining review gaps are recorded in
`docs/reviews/2026-09-24-vanilla-presentation-audit.md`.

Community report fixes (23 September) now align White Knight gear with black at T2,
gate Draynor rooftops on Agility and shop diary tasks on merchant unlocks, and
separate Sheep Shearer's Crafting method from pre-obtained wool. Journal readiness
and guide action checks agree; owned supplies can skip preparation with undo.
See `docs/reviews/2026-09-23-community-report-fixes.md` for decisions and evidence.

- Five independently reviewed F2P guides: Cook's Assistant, Sheep Shearer,
  The Restless Ghost, Rune Mysteries, and Imp Catcher.
- Exact obtainable-item chains, ranked alternatives, blockers, requirement
  confirmations, quest walkthrough actions, route maps, and World-map handoff.
- The normal build exposes only the independently authored public pack. Daddy's
  Home, Doric's Quest, Elemental Workshop I, and future unfinished guides remain
  private to the explicit `runeproof-preview` build mode.
- Guide confirmations are isolated by run and remain separate from Journal
  completion, Keys, Fate rolls, and rewards. They now travel with canonical
  profile saves, exports, and recovery checkpoints; writer ownership and
  pending-save recovery also apply to guide edits.
- Exit gate: pass the complete release verifier, serve the production build
  locally, obtain the maintainer's final visual/play approval, and only then make
  a separate push, merge, deployment, and announcement decision.

### P1 — Progression intelligence quick wins

1. Expand reviewed RuneProof coverage from the four pilots to the full F2P quest
   set, then add members quests in small source-reviewed batches.
2. Add an objective picker that can route to quests, diaries, bosses, items,
   skills, regions, and collection goals through one explanation model.
3. Surface blocker explanations and the next three useful actions on Dashboard,
   Journal, and World without duplicating solver logic.
4. Add route freshness/provenance badges and a maintainer audit queue for
   incomplete or ambiguous evidence.
5. Release only batches that remain useful when chunk data, map imagery, or a
   remote source is unavailable.

### P2 — RuneLite capture and enforcement foundation

1. Define a versioned evidence envelope for detected quest, diary, CA, item,
   skill, region, bank, and boss progress. Preserve raw evidence and confidence.
2. Add advisory warnings for high-confidence rule violations before adding any
   blocking behavior. Every warning needs a reason, rule source, and dismissal.
3. Reconcile plugin evidence with the web run through an inbox: preview changes,
   accept or reject them, and retain an audit trail. Never silently rewrite a run.
4. Add detection coverage dashboards and replayable fixtures in the standalone
   RuneLite repository before widening enforcement.
5. Gate strict enforcement per mode and per detector only after local RuneLite
   gameplay testing demonstrates low false-positive and false-negative rates.

### P3 — More entertaining challenge mechanics

1. Ship contracts as deterministic, shareable objective bundles built on
   RuneProof eligibility and completion evidence.
2. Add opt-in run modifiers with explicit scoring effects and compatibility
   rules; start with small modifiers before economy-wide changes.
3. Turn Rival Fate into an event-driven opponent that reacts to verified run
   milestones without changing the player's outcomes.
4. Add short events with previewed rewards, expiry, recovery rules, and seeded
   determinism so interrupted runs remain valid.
5. Prototype new modes only as versioned rulebooks; saves must retain the exact
   ruleset used when the run began.

### P4 — Community and competition

1. Upgrade weekly seeds into signed challenge definitions with fixed mode,
   modifiers, start time, end time, and scoring revision.
2. Add privacy-safe run comparison: shared milestones, route divergence,
   completion pace, and verified/unverified evidence labels.
3. Add asynchronous races and shareable challenge links before real-time racing;
   they are cheaper to operate and easier to moderate.
4. Introduce leaderboards only after deterministic scoring, duplicate-run rules,
   evidence grades, reporting, removal, and season archival are implemented.
5. Keep unverified/local-only submissions visible in friendly contexts but
   separate from enforcement-backed competitive standings.

### P5 — Seasons and major expansions

- Versioned seasonal rules, contracts, modifiers, scoring, rewards, and archive.
- Curated official challenges plus community-authored challenges with validation
  and moderation boundaries.
- Live race rooms and spectator surfaces only after asynchronous races prove the
  scoring and integrity model.
- Broader RuneProof objectives and recommendation quality work driven by actual
  route failures and player choices, not raw catalogue size alone.

### Delivery order and non-negotiable gates

The dependency order is P0 → P1/P2 → P3 → P4 → P5. P1 and P2 may proceed in
parallel once their evidence contracts agree; competitive scoring must not lead
the evidence system. Every feature follows the same ladder: deterministic unit
tests, integration tests, separate local preview, maintainer visual/play test,
explicit approval, then release verification and deployment. A passing build is
not visual acceptance, and visual acceptance is not permission to publish.

## 2b. Existing near-term follow-ups (in rough value order)

1. ~~Map: tint the top-ranked frontier chunks~~ — done: top-5 by `sortScore`
   render cyan (`HOT_FRONTIER_FILL` in RegionMap). The plugin's world map
   also tints the Chunked frontier amber with a "rollable next" tooltip.
2. **Frontier Advisor tuning.** Current weights: bank 3, shops ≤3, quest
   steps ≤3, monsters ≤1, all quartered so content stays below the flat +3
   per new-area foothold (see `frontierAdvisor.ts`, all in one place). Tune
   with real play feedback; the unit tests pin the *rules*, not the constants.
3. **Diary/CA suggestion deep links.** Plugin diary suggestions carry
   "Ardougne Elite"-style labels; the Journal's diary search may not match
   that exact string. Check `suggestionNav()` query behavior against the
   DiaryLog search and adjust the label → query mapping if jumps land on
   empty filters.
4. **Streamer overlay** — done: `#/overlay?code=<pairing code>` renders a
   transparent OBS-browser-source badge bar (keys/fate/territory/buff/goal +
   "NEW UNLOCK" pops) polling the relay bundle with ETags; copy-URL button
   lives in the Connect RuneLite card. `components/StreamOverlay.tsx`,
   lazy-loaded via the hash gate in `index.tsx`.
5. **Plugin-side chunk-content in the side panel** is already done for the
   current chunk; a "nearest locked bank/shop" line in the HUD would be the
   next in-game QoL win (all from `FateLockedBundle.contentAt`, no network).

## 2b. Bank unlocks (shipped — web side) & follow-ups

The bank pool contains 127 physical canonical bank/deposit chunks plus 1 virtual Forestry unlock.
All 128 are individual `TableType.BANKS` entries in `unlocks.banks[]`: the 127 physical entries are keyed by
canonical chunk id cx*256+cy, while the virtual Forestry unlock is tracked separately,
mirroring the STORAGE table pattern. Data: `data/banks.ts` (regen with
`node scripts/gen-banks.mjs` from public/chunk-content.json's `banks`).
Labels come from `data/sources/bank-locations.json` when it has one (`locations`
or `labelOverrides`, each with Wiki evidence) and otherwise from the chunk's
Chunk Picker nickname, which can name a landmark instead of the bank (10292 was
"Chaos Druid Tower"). Correct a label with a `labelOverrides` entry; never change
the id, which saves store.

Gated by a per-mode `bankLocks` rule (config/gameModes.ts), **on in every
built-in mode**; Custom mode can toggle it off.
Reachability choke point: `utils/reachability.ts::isBankReachable(cx, cy,
unlocks, gameModeId, customMode)` and `bankLocksActive(...)` — every consumer
must read through these, same discipline as isAreaReachable.

Follow-ups:
- ~~Flip Chunked to default-on~~ — done: Chunked mode has `bankLocks: true`,
  so banks show in Spend Keys, the Activities & Utility tab (browsable named
  grid, Omni-unlockable), and the map chunk panel.
- ~~Chunk-panel bank lock display~~ — done: ChunkActivityPanel shows the
  standing chunk's bank as unlocked (green) or locked (red "roll it in Spend
  Keys") via isBankReachable, when bankLocks is on. A map-level bank tint on
  RegionMap is still open if wanted.
- ~~Physical-bank plugin integration~~ — done: the bundle exports `bankLocks` +
  `unlockedBanks`, and the plugin warns on physical bank/deposit-box access by
  canonical chunk id (warnLockedBank toggle; widget groups 12 / 192).
- **Virtual Forestry plugin enforcement** — web tracking and export are shipped;
  event-specific Woodcutting Leprechaun detection remains a companion-plugin
  follow-up because the current warning path is chunk-based.
- ~~Completion/stats~~ — done: banks counted in completion % (denominator +
  points), Share card tile, and the copy summary.
- **Browsable owned-banks list** in the Dashboard (Spend card only shows X/128).

## 3. Architecture cheat-sheet

- **Reachability choke point:** `utils/reachability.ts::isAreaReachable(name,
  unlocks, gameModeId)`. EVERY "is this named area open" check must go
  through it — that's how Chunked mode works app-wide. If a new surface
  reads `unlocks.regions.includes(...)` directly, it's a bug (this exact
  bug was found twice: World tab grid, ShareModal mastery).
- **Gameplay RNG choke point:** `GameContext.nextFloat(purpose)` — every
  gameplay outcome (rolls, table picks, gambles) draws through it so seeded
  runs stay deterministic and verifiable. A new surface calling
  `Math.random` for a gameplay outcome is a bug, same discipline as
  isAreaReachable. Visual randomness (particles, jitter) is exempt.
- **Impact engine:** `utils/unlockImpact.ts::computeUnlockImpact(base,
  simulated, gameModeId)` — shared by Quest, Region and Frontier advisors.
  Chunk-aware via gameModeId.
- **Current RuneLite relay:** the browser publishes the current app-authored
  v4 profile with `POST /r/:code`; RuneLite retrieves and validates it with
  `GET /r/:code` and optional ETag caching. The plugin does not write to the
  relay, and the browser receives no import receipt. Disconnect marks the
  code gone, which the plugin's `GET` then reports (`404 {"gone":true}`).
  Full contract in `docs/online-relay.md`. Deployed at
  `fate-relay.fatelocked.workers.dev`; redeploy with `wrangler deploy` from
  `workers/fate-relay/` (KV id is committed in wrangler.toml).
- **Legacy relay compatibility only:** the Worker temporarily retains
  `/r/:code/state`, `/r/:code/events`, `/r/:code/acks`, and
  `/r/:code/suggest` for older installed clients. They are not part of the
  current Hub candidate's connection and must not be presented as current
  product behavior.
- **Plugin boundary:** [Nubles/OSRS-Fate-Locked-Runelite](https://github.com/Nubles/OSRS-Fate-Locked-Runelite)
  owns the plugin source, builds, releases, and local detection history. The
  app exports rules bundles but contains no Java plugin or download pipeline.

## 3b. Contracts with the RuneLite plugin

Java and Gradle stay out of this repository
(`scripts/runeliteRepositoryBoundary.test.ts`), so the app and the plugin
share test files instead of code:

- **Golden bundles** (`contracts/golden-bundles/`): for a fixed set of runs
  across the game modes, the bundle exactly as the relay path makes it and
  the app's own answers for it: every land and ocean chunk
  (`chunkUnlocked`), every named area (`isAreaReachable`), every bank
  (`isBankReachable`) and the Chunked frontier. With them come account-name
  pairs (`normalizeAccountName`) and the bundles an import must refuse or
  read the same (`cases.json`). `scripts/goldenBundles.test.ts` fails when
  the files no longer match the app.
- **Relay replies** (`contracts/relay/relay-get.json`): each reply the
  worker gives the plugin's `GET /r/<code>`, and what the plugin must make
  of it. `workers/fate-relay/relayContract.test.ts` checks that the worker
  gives them.

The plugin copies both at a pinned commit of this repository (its
`scripts/pin-web-contracts.sh`, which records the commit in
`src/test/resources/contracts/PINNED`). Its CI checks the copy against that
commit and runs the real Java codec and rules against them. They replaced
a TypeScript copy of the plugin's rules, which had drifted from the Java.

To change land rules, banks, account matching, the bundle or the relay's
replies on purpose: run `npm run goldens:write` (the relay file is edited
by hand), review the diff, where the `.expect.json` files show exactly which
decisions changed, and merge. Then re-pin the plugin to the merged commit
and make it agree before its next Plugin Hub release; until then, players
on the Hub build get the old answers.

## 4. Gotchas that cost real debugging time

- **RuneLite API imports:** verify against the live javadocs
  (static.runelite.net), not memory. `LootReceived` lives in
  `net.runelite.client.plugins.loottracker`, NOT `client.events` — a wrong
  guess here broke CI once. Same class of bug: `CircleCheck` doesn't exist
  in this lucide-react version (it's `CheckCircle2`).
- **Relay write-tokens must be persisted.** The worker's first-writer model
  means an in-memory browser token dies with the page and can cause later
  writes to fail for the record's TTL. The web app persists the current
  main-channel token in `fate_relay_session_v1`. Current RuneLite builds
  perform no relay writes and own no relay write-token.
- **Quest reward scroll wording varies:** usually "You have completed The
  Corsair Curse!" with NO trailing "quest" — regexes must handle both forms
  (see `QUEST_COMPLETE_SUFFIXED` / `_BARE`).
- **Diary varbits & login baselines:** a tier varbit that's 0 at login never
  fires VarbitChanged, so pure event-filtering misses its completion, and a
  login's first events can arrive before every tier has synced. From Stage 1
  the plugin reads all 48 at the session's first game tick and remembers
  each account's finished tiers, so a tier counts once: when it flips in
  play, or at the next login if it was finished with RuneLite closed. It
  then filters by `ev.getVarbitId()`. (The Stage 0 Hub build baselines on
  the first event after LOGGED_IN.)
- **Plugin verification belongs in the standalone repository.** In the
  standalone checkout, run `gradle clean check --no-daemon`; plugin CI,
  releases, and Plugin Hub work also occur there, never in the companion app.
- **Dataset fetch cool-downs:** GearService/MonsterService fast-fail for 60s
  after a failed load (`init(force)` bypasses for Retry buttons). Without
  this, the relay driver re-fetched on every state change while offline.

## 5. Web release handoff

Use the [release verification checklist](docs/RELEASE_CHECKLIST.md) for the
single authoritative command order, generated-data review, and GitHub handoff.
The required GitHub check is `CI / quality`; enabling it in branch protection
is a manual repository-maintainer setting after the workflow first appears.

Build-size watch: `npm run build` fails when the eager entry chunk (the
`dist/assets/index-*.js` that `index.html` loads) grows past its gzip budget
in `scripts/check-entry-budget.mjs` (225 kB; about 217 kB after the 24 Sept
2026 review moved on-demand screens and the release notes out of it). An
overrun usually means something that should load through `lazyWithRetry` was
imported eagerly. Inspect the built file for content markers rather than
relying only on the import graph, and raise the budget only on purpose.


## Equipment catalogue corrections — 23 September 2026 (local Vanilla preview)

Fixed elemental staves split across T1/T4, imported magic damage at ten times its
percentage, dropped exact item IDs, cosmetic/material name collisions and
same-family armour/cape/ammunition inconsistencies. GearService now retains all
5,436 source IDs while keeping 2,405 combat picker rows; v3 migrates both older
cache versions and participates in quota recovery. Reviewed/material rules cover
1,512 picker names; the remaining 893 display Est. beside their tier. These are
Fate placements, not official OSRS equipment tiers. Equipment Lab labels now
match the Codex, and the gear dialog escapes dashboard clipping.

See [the equipment audit](docs/reviews/2026-09-23-equipment-catalogue-audit.md)
for sources, exact scope, policy choices and regression evidence. Changes are
local only; no public deployment or plugin release was performed.
