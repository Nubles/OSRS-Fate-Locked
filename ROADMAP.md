# Roadmap & Maintainer Handoff

Everything in flight, everything planned, and every gotcha learned the hard
way — written so the project can keep moving without any particular
contributor. Last updated: August 2026.

---

## 1. RuneLite Plugin Hub release (shipped)

The Plugin Hub entry for
[Nubles/OSRS-Fate-Locked-Runelite](https://github.com/Nubles/OSRS-Fate-Locked-Runelite)
already resolves to the canonical release commit
`5cc1ffc4e4f684a99211f12342a69ceb6d16de30`. No additional Plugin Hub pin PR
is required for this release. Future plugin releases are built and published
only from `OSRS-Fate-Locked-Runelite`.

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

- Five independently reviewed F2P guides: Cook's Assistant, Sheep Shearer,
  The Restless Ghost, Rune Mysteries, and Imp Catcher.
- Exact obtainable-item chains, ranked alternatives, blockers, requirement
  confirmations, quest walkthrough actions, route maps, and World-map handoff.
- The normal build exposes only the independently authored public pack. Daddy's
  Home, Doric's Quest, Elemental Workshop I, and future unfinished guides remain
  private to the explicit `runeproof-preview` build mode.
- Confirmations remain isolated by run outside Journal completion, Keys, Fate
  rolls, rewards, exports, sync, and canonical save state.
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
   steps ≤3, monsters ≤1, flat +3 per new-area foothold (see
   `frontierAdvisor.ts`, all in one place). Tune with real play feedback;
   the unit tests pin the *rules*, not the constants.
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

The bank pool contains 126 physical canonical bank/deposit chunks plus 1 virtual Forestry unlock.
All 127 are individual `TableType.BANKS` entries in `unlocks.banks[]`: the 126 physical entries are keyed by
canonical chunk id cx*256+cy, while the virtual Forestry unlock is tracked separately,
mirroring the STORAGE table pattern. Data: `data/banks.ts` (regen with
`node scripts/gen-banks.mjs` from public/chunk-content.json's `banks`).

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
- **Browsable owned-banks list** in the Dashboard (Spend card only shows X/127).

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
  relay, and the browser receives no import receipt. Full contract in
  `docs/online-relay.md`. Deployed at
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
  fires VarbitChanged, so pure event-filtering misses its completion. The
  plugin baselines all 48 once on the first event after LOGGED_IN, then
  filters by `ev.getVarbitId()`.
- **Plugin verification belongs in the standalone repository.** In the
  standalone checkout, run `gradle clean test jar --no-daemon`; plugin CI,
  releases, and Plugin Hub work also occur there, never in the companion app.
- **Dataset fetch cool-downs:** GearService/MonsterService fast-fail for 60s
  after a failed load (`init(force)` bypasses for Retry buttons). Without
  this, the relay driver re-fetched on every state change while offline.

## 5. Web release handoff

Use the [release verification checklist](docs/RELEASE_CHECKLIST.md) for the
single authoritative command order, generated-data review, and GitHub handoff.
The required GitHub check is `CI / quality`; enabling it in branch protection
is a manual repository-maintainer setting after the workflow first appears.

Build-size watch: if the eager `dist/assets/index-*.js` grows past about
130 kB gzip, something that should be lazy may have been imported eagerly.
Inspect the built file for content markers rather than relying only on the
import graph.
