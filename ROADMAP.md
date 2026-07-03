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
4. **Plugin-side chunk-content in the side panel** is already done for the
   current chunk; a "nearest locked bank/shop" line in the HUD would be the
   next in-game QoL win (all from `FateLockedBundle.contentAt`, no network).

## 3. Architecture cheat-sheet

- **Reachability choke point:** `utils/reachability.ts::isAreaReachable(name,
  unlocks, gameModeId)`. EVERY "is this named area open" check must go
  through it — that's how Chunked mode works app-wide. If a new surface
  reads `unlocks.regions.includes(...)` directly, it's a bug (this exact
  bug was found twice: World tab grid, ShareModal mastery).
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

## 5. Release checklist (web app)

```
npx vitest run        # 406 tests
npx tsc --noEmit
npx vite build        # main chunk should stay ≈118 kB gzip
git push              # GitHub Pages deploys from main
```

If the eager `dist/assets/index-*.js` grows past ~130 kB gzip, something
that should be lazy got imported eagerly — grep the built file for content
markers, don't trust the import graph.
