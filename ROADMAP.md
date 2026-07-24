# Roadmap & Maintainer Handoff

Everything in flight, everything planned, and every gotcha learned the hard
way — written so the project can keep moving without any particular
contributor. Last updated: July 2026.

---

## 1. Ship the Plugin Hub update (highest value, ~10 minutes)

The Hub currently serves commit `dc3823c` of
[Nubles/RS3-Fate-Locked-Runelite](https://github.com/Nubles/RS3-Fate-Locked-Runelite).
Everything since is CI-green and unreleased:

- Chunked-mode chunk-coordinate lock state (`unlockedChunks` in the bundle)
- Roll detection: quests (reward widget), diary tiers (varbits), combat
  achievements (chat), collection log (chat), boss/raid kills (LootReceived)
- Suggestion relay: plugin → app `{source, label, ts}` pushes on `/suggest`
- Connection heartbeat: `{ts, version}` ack on `/state` after each relay
  import (powers the web app's "Connect RuneLite" card)
- `onVarbitChanged` hot-path fix (48 client calls → 1 set lookup per event)
- World-map tooltip now lists the hovered chunk's contents

**To ship:** sync your fork of `runelite/plugin-hub`, edit
`plugins/fate-locked-ironman`, set `commit=` to the current HEAD of the
plugin repo (`git rev-parse HEAD`, full 40 chars), open the PR.

**Reviewer question to expect:** "there's new outbound traffic since the last
release" — the `/suggest` and `/state` POSTs. Answer: both sit behind the
same `onlineSync` opt-in boolean whose `@ConfigItem` carries the mandated
IP-address warning; both are documented in the plugin repo's CONTRIBUTING
(§ Online sync). No consent → `pollRelay()`/`pushSuggestion()` return on
their first line and no request is ever made.

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

## 2. Near-term features (in rough value order)

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

Each of the 100 canonical bank/deposit-box locations is its own unlock
(`TableType.BANKS`, `unlocks.banks[]`, keyed by canonical chunk id cx*256+cy),
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
- ~~Plugin integration~~ — done: bundle exports `bankLocks` + `unlockedBanks`;
  the plugin warns (chat + notifier) on opening a bank/deposit box in an
  unlocked chunk (warnLockedBank toggle). Bank group ids 12 / 192.
- ~~Completion/stats~~ — done: banks counted in completion % (denominator +
  points), Share card tile, and the copy summary.
- **Browsable owned-banks list** in the Dashboard (Spend card only shows X/100).

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
- **Relay (Cloudflare Worker, `workers/fate-relay/`):** three records per
  pairing code — `/r/:code` (app→plugin bundle), `/r/:code/suggest`
  (plugin→app suggestions), `/r/:code/state` (plugin→app heartbeat). Each
  has its own version + first-writer-claims write-token + 24h TTL. Full
  contract in `docs/online-relay.md`. Deployed at
  `fate-relay.fatelocked.workers.dev`; redeploy with `wrangler deploy` from
  `workers/fate-relay/` (KV id is committed in wrangler.toml).
- **Suggestion lifecycle (web):** `services/suggestSync.ts`. The relay is a
  dumb store — cleared/dismissed suggestions must go into the persisted
  `cleared` set or the next poll resurrects them (this was a real bug).
  Auto-clear on roll lives in the ALWAYS-MOUNTED `SuggestionBanner`, not the
  lazily-mounted queue (also a real bug: tab components miss rolls made
  elsewhere).
- **Plugin mirror:** the plugin's source of truth is the standalone repo;
  `runelite-plugin/` in this repo is a byte-for-byte mirror with CRLF line
  endings. After any plugin change: copy the files over converting LF→CRLF,
  commit both repos.

## 4. Gotchas that cost real debugging time

- **RuneLite API imports:** verify against the live javadocs
  (static.runelite.net), not memory. `LootReceived` lives in
  `net.runelite.client.plugins.loottracker`, NOT `client.events` — a wrong
  guess here broke CI once. Same class of bug: `CircleCheck` doesn't exist
  in this lucide-react version (it's `CheckCircle2`).
- **Relay write-tokens must be persisted.** The worker's first-writer model
  means an in-memory token dies with the process and 403s every later write
  for up to 24h. The plugin persists them in config as
  `suggestToken.<code>` / `stateToken.<code>`; the web app persists the
  main-channel token in `fate_relay_session_v1`.
- **Quest reward scroll wording varies:** usually "You have completed The
  Corsair Curse!" with NO trailing "quest" — regexes must handle both forms
  (see `QUEST_COMPLETE_SUFFIXED` / `_BARE`).
- **Diary varbits & login baselines:** a tier varbit that's 0 at login never
  fires VarbitChanged, so pure event-filtering misses its completion. The
  plugin baselines all 48 once on the first event after LOGGED_IN, then
  filters by `ev.getVarbitId()`.
- **GitHub Actions is the plugin's only build.** There's no local Gradle in
  the dev environment — CI is the compile check, so keep plugin commits
  small and watch the Actions tab after each push.
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
