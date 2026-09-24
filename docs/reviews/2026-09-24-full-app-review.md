# Full app review — 24 September 2026

Scope: the whole web app at `6b7c301`, reviewed as nine areas: engine and key
economy, game modes and reachability, saves and profiles, interface, journal
data, advisors and combat tools, RuneProof guides, relay and integrations, plus
a pass of my own. Each finding was reproduced with a temporary test, a
browser run or a script against the real data, or traced through the code,
and is marked as such below.

**Outcome:** 100 distinct findings, after merging duplicates between areas.
52 are fixed on `claude/quirky-archimedes-aponk4`, and two more (U7, U17) are
partly fixed. Each behaviour fix is pinned by a test that fails on the old
code, except the phone onboarding layout and the What's New ordering, which
were verified in the browser instead. The other 46 are listed under
[Open findings](#open-findings) with a recommended fix. Four of those wait on
an owner decision; three earlier decisions are recorded under
[Decisions](#decisions). Nothing has been deployed.

Finding IDs by area: **E** engine, **B** modes and reachability, **P** saves
and profiles, **U** interface, **J** journal data, **H** advisors and combat,
**G** RuneProof, **F** relay and integrations, **R** my own pass.

## Verification

| Check | Base `6b7c301` | This branch |
| --- | --- | --- |
| `npx vitest run` | 311 files, 4,150 passed, **1 failed** (App lifecycle Discord invite test timed out at 5.2 s under load; fixed in `030975a`) | 325 files, **4,245 passed** |
| `npx tsc --noEmit` | clean | clean |
| `npm run content:verify` | passed | passed |
| `npm run diary:verify` | current | current (after `npm run diary:sync`) |
| `npm run changelog:verify` | n/a | passed (base `6b7c301`) |
| `VITE_BASE=/OSRS-Fate-Locked/ vite build` | 239.5 kB gzip entry chunk | 242.8 kB gzip entry chunk; about 2.5 kB of that is the new What's New text |

Browser checks ran in Chromium against the production build, starting from a
fresh profile with localStorage and IndexedDB cleared:

- Onboarding (Next ×4, then Enter The Void) opens **Choose game mode** first. What's New, showing the new release, opens only after the mode is applied.
- On a 390×844 phone viewport, Next and Enter The Void are on screen and receive taps on every card. On the base build Next was clipped below the card.
- After Reset all progress, three reloads open the dashboard. On the base build every reload showed the recovery screen.
- Oracle search with "test" + Enter leaves the run ID and history unchanged, writes no backups and shows no diagnostics.
- No page errors. The only console errors are blocked external wiki requests, because this sandbox has no wiki access.

## Verified correct

Each area review also checked the following against the code and data, and
found them sound:

- **Secrets and saves:** Discord webhooks, Discord cursors and relay tokens stay outside GameState, and the schema's field whitelist keeps them out of exports, sync codes, backups and checkpoints. Prototype-pollution keys are rejected at every depth. Sync-code and `.fate` decoding is size-bounded and strict. Profile IDs cannot collide with sidecar keys. The save coordinator validates, checksums and reads back both stores.
- **Engine:** roll bins and die offsets are right. Clarity takes the lower of two rolls, Omni rolls only on success, and pity and Greed (including the boss-reserve clamp) behave as documented. Replay matches the reducer apart from the issues listed here. The hash chain survives a save round-trip. Seeded draws never collide, and gameplay never calls `Math.random` apart from the known `rollDice`.
- **Modes:** the roll pool, roll action, reducer guard and forecasts share `randomUnlockPool`. Completion handles Aquarium, the Chunked start chunk and bank locks consistently. Every bank surface goes through `bankLocksActive`/`isBankReachable`. Vanilla location rules cover every boss and minigame.
- **Interface:** components load through `lazyWithRetry`; the RuneProof data loader in G3 is the exception. Spend Keys and farm cards cannot double-spend. Drop rates, task figures, pity and ritual costs shown match config. Every command palette entry has a listener.
- **Journal data:** there are no quest prerequisite cycles, and every quest, diary, skill and area reference resolves. One eligibility check drives every journal surface. Miniquests carry 0 QP, and the collection log covers 1,926/1,926 entries with everything unlocked.
- **Combat maths:** max hit, effective levels, stance bonuses, prayer and potion multipliers, attack and defence rolls, DPS and time to kill match OSRS for non-negative rolls. There is no NaN or division by zero.
- **RuneProof:** the preview/production boundary holds. Step confirmation re-checks permissions, and guide checks go through save ownership.
- **Relay and Discord:** the token travels only in POST bodies, and pairing codes are 128-bit and validated. Discord URL validation rejects look-alike hosts, and embeds stay within Discord's limits. The overlay renders text only.

## Fixed

| Commit | Findings fixed | Pinned by |
| --- | --- | --- |
| `90a3edb` | **P1** (high): after a reset, import or restore, every reload showed the "more than one run" recovery screen. The only way out deleted every checkpoint. | `utils/saveRecovery.test.ts`; browser |
| `957722c` | **R1** (high): Oracle "test" + Enter ran a diagnostic suite in production that replaced the real run with test data. **R4**: Oracle area status assumed Misthalin is free. | `OracleSearch.diagnostics.test.tsx`, `OracleSearch.test.tsx`; browser |
| `6419e6d` | **U2** (high): onboarding could not be finished on a phone. **R2**: What's New opened on top of Choose game mode. | browser (phone and desktop) |
| `0c19fc4` | **R3/F15**: Windows-1252 bytes displayed as replacement characters. | `scripts/source-encoding.test.ts`, which now checks every source and data file |
| `ccb195e` | **R10**: price API error bodies were cached as the price table for an hour. | `services/PriceService.test.ts` |
| `0c1e2a3`, `a813fdc` | **R5**: stale product name, share text, wiki user agent and metadata; the product name is now spelled one way everywhere. | — |
| `71e4336` | **P3**: a `gameModeId` such as "constructor" crashed every load. **P4**: a save paused on an Aquarium reveal became invalid. **P8**: legacy sync codes all shared one run ID. | `utils/saveCompatibility.test.ts` |
| `ab22c91` | **P6**: saves above about 1.97 MB could not be exported as .fate files. | `utils/encryption.test.ts` |
| `c458691` | **F6**: a full localStorage crashed the app from the Roll Inbox on every reload. | `services/rollInboxStore.test.ts` |
| `8b3e54c` | **U4**: one Omni-key paid for two unlocks. **U8/E1**: a second buff overwrote a paid one, and unaffordable rituals were not rejected by the reducer. **E8**: level-ups at 99 rolled rewards. **U3**: Auto-Roll kept levelling after unmount. **E2/E3**: Cartographer offers could be redrawn for free, and small frontiers showed too few offers. **E5**: replay counted a charted Chaos Temple as a Ritual of Chaos. | `gameReducer.test.ts`, `GameContext.test.tsx`, `VoidAltar.test.tsx`, `AutoRollPanel.test.tsx`, `processRepairs.test.ts` |
| `028837f` | **U1** (high): pending legacy compensation left What's New with no working close or claim control. | `ChangelogModal.dom.test.tsx` (real release list) |
| `840b023` | **U5**: Timelapse showed "INTEGRITY: BROKEN" for replay notes; **U17** (Timelapse half). **B2/J5**: Chunked doability started from the wrong chunk. **B4**: reveal toasts repeated when storage was full. | `TimelapseModal.test.tsx`, `QuestDoabilityPanel.chunked.test.tsx`, `FeatureRevealDriver.test.tsx` |
| `adfac70` | **U6**: skill cards ignored Enter and Space. **U7** (partly): Enter on the tour's Next button skipped a step. **U13**: icon-only close buttons had no name. | `Dashboard.skill-card.test.tsx`, `GuidedTour.test.tsx` |
| `bf9fb95` | **U9/E9**: the Codex contradicted the engine on Omni odds, the worked example, Storage and precision. **U12/R6**: retired modes were presented as current. **B3**: Spend Keys offered rolls with an empty pool. **B8**: counters. **B10**: copy. **U16**: skills count and shortcut labels. | `config/economy.consistency.test.ts` (Omni odds against the roll engine), `GachaSection.pool.test.tsx`, `ShortcutsPanel.dom.test.tsx` |
| `4f7c97e` | **J1** (high): level-1 skilling diary tasks had no skill gate. **J7**: Champions' Guild could never read Ready. **J10**: CA reward chips used names that match no boss. | `sync-achievement-diaries.test.ts`, `activityRequirements.consistency.test.ts` (every required area must exist), `data/consistency.test.ts` |
| `6e445ac` | **H3** (high): ammo strength was added for weapons that don't fire it (+59% DPS on darts). **H4**: hit chance could leave 0–100%. **H12**: floating-point rounding. **H13**: prayer label. | `gearStats.test.ts`, `dps.test.ts` |
| `0a022ea` | **F3**: the relay buffered any body size before checking the 256 KiB limit. | `workers/fate-relay/worker.test.ts` |
| `030975a` | **R7**: a flaky 5 s test timeout. | — |
| `677fe61` | **G2**: Cook's Assistant steps 4–9 always read "needs checking". | `utils/questWalkthroughs/evaluator.test.ts` (public catalogue) |
| `dfc8e14` | **F5**: Discord re-announced imported unlocks and went silent after a fast-clock save. | `DiscordSyncDriver.test.tsx`, `discordWebhook.test.ts`, `GameContext.test.tsx` |
| `1ae6f1a` | **H7**: the goal planner counted a quest's own points toward its own QP gate. | `goalPlanner.test.ts` |
| `4a41cef` | **J6**: the Quest Journal area filter hid quests the area gates (Varrock: 29 of 43 shown). | `QuestLog.region-filter.test.tsx` |
| `cdd112f` | **J4**: wilderness_easy_4 accepted the Abyss route without Enter the Abyss. | `journalStatus.test.ts`, `sync-achievement-diaries.test.ts` |
| `3bbaa0b`, `8dc88e1` | **H8**: max hit came from the first number in the text, so Tormented Demons read 0 (Low danger). | `MonsterService.test.ts` (parser table plus the real snapshot) |
| `54ba21d` | **R11** (new): importing or restoring spliced history from the replaced run into legacy saves, or linked hash-less imports to the old run's chain. | `gameReducer.test.ts` |
| `f73243f` | What's New release "Safer Saves, Fairer Keys and Accurate Planners". | `data/changelog.test.ts` |
| `0405db5`, `9feb8b5` | **J2**: quest difficulties match the official OSRS ratings (four changed; see [Decisions](#decisions)). | `data/questDifficulty.source.test.ts` (every quest Quest Helper lists) |
| `840c323` | **H1**: the Boss Planner has a version picker with a standard default. **H2**: the DPS Calculator selects the exact version picked. | `BossKillPlanner.version.test.tsx`, `bossPlanner.test.ts`, `MonsterService.test.ts`, `DpsCalc.weaponOptions.test.tsx` |
| `ee94c9a` | **E4**: new Chunked runs no longer get a key on their first level-up; existing runs keep their schedule. | `gameReducer.test.ts` |

Test failures during the work, all resolved: new reducer guards starved two
tier-cap tests of keys, so their fixtures now start with enough keys. A diary
generator test pinned `lum_easy_10` to no skills; it now pins `{ Cooking: 1 }`.
The alternative-route audit list gained `wilderness_easy_4`. A first attempt
at **G1** broke seven tests that pin documented owned-item behaviour, so it was
reverted and moved to the decisions list.

## Open findings

### Fix next

- **P2** (high, reproduced) — `utils/saveCoordinator.ts:203,429`, `recoveryDatabase.ts:413`. A tab that takes over saving keeps the revision counter it loaded with, so the recovery database rejects its writes as `stale_revision` while the UI says "Saved". On reload the other tab's older state returns. Re-syncing the counter on takeover alone is not enough: when tab A simply closes, stale tab B re-takes the lease automatically and would then overwrite A's newer progress everywhere. The fix needs all three parts: assign the revision inside the `putHead` transaction (max of stored and local, plus 1); never report `stale_revision` as saved; and require the manual-takeover confirmation when a blocked tab with unsaved changes regains the lease, as the spec already asks.
- **F1** (medium, security, reproduced) — `workers/fate-relay/worker.js:135-142`. The write token is stored only inside the 24-hour record. After it expires, anyone's first POST claims the code, and the owner then gets `403` forever. Fix: see the recommendation under [Decisions](#decisions).
- **F14** (low, security, traced) — `utils/runelitePairing.ts:9-13`, `RunelitePairingDialog.tsx:55`. Any website can present a `#runelite-pair=` link, and the dialog says "RuneLite requested this connection". Confirming it lets the link's author read every future publish. Fix: neutral wording, and ask the player to match the code shown in RuneLite.
- **P5** (medium, reproduced) — `components/SaveBootstrap.tsx:531,705`. If IndexedDB exists but fails to open, the game stays closed with no retry or export, even though the localStorage save is valid. Clearing site data, the obvious workaround, deletes that save. Fix: offer Retry, Export and "continue with browser save", or degrade as the app already does when IndexedDB is missing.
- **P7** (medium, reproduced) — `utils/profileWriterLease.ts:92-125`. A tab restored from the back-forward cache can re-take the lease for a deleted profile and write it back. Fix: refuse leases for profiles missing from the current list, and re-read the list on `pageshow`.
- **F4** (medium, traced) — `services/relaySync.ts`. The relay pairing is shared by every tab, but each tab has its own active profile. A second tab on another profile publishes that profile to the paired RuneLite code. Fix: store the paired profile ID and publish only that profile, and listen for `storage` events on the session key.
- **F2** (medium, reproduced) — `worker.js:60-69,140`, `StreamOverlay.tsx:103-105`. The ETag is a counter that restarts when the record expires, so clients can get `304` for new content, and the overlay keeps its ETag through a 404. Fix: use a hash of the payload as the ETag, and clear it on 404. The plugin side needs checking too.
- **U10** (medium, traced) — `components/Dashboard.tsx:1203`. The tab wrapper's animation leaves a `transform`, which traps `fixed` dialogs such as the Equipment Lab slot picker and the DPS monster picker inside the pane. Fix: portal them, as `GearView.tsx:208` already does.
- **G3** (medium, traced) — `data/questWalkthroughLoader.ts`. It uses a bare `import()`, bypassing the `lazyWithRetry`/`importWithRetry` choke point, and a failed chunk load is swallowed into an empty catalogue with no retry. Fix: `importWithRetry`, plus a failed state with retry.
- **H5** (medium, reproduced) — `utils/bossPlanner.ts:73-74`. "Boosts on" is the default and applies Piety or Rigour without checking the Arcana unlock or Prayer level. Fix: use the best prayer the player has unlocked.
- **H6** (medium, reproduced) — `utils/frontierAdvisor.ts:78-81`. Only chunks that open a new named area are simulated, so quests unlocked by an exact chunk score 0. Fix: also simulate chunks named in quest or diary locations.
- **B1** (medium, reproduced) — `components/RunCard.tsx:24,112-145`. The share-card map colours whole continents and treats Misthalin as free, so Vanilla area unlocks never show. Fix: colour by `chunkUnlocked`/`isRegionUnlocked`, and count with `isAreaReachable`.

### Lower priority

- **Saves and data:** **P9**: "Export encrypted save" is XOR obfuscation; relabel it or use AES-GCM. **R8**: the entry chunk is 242 kB gzip against the roughly 128 kB the project notes target; the largest eager modules are collection-log data, GameContext, Dashboard, App and the changelog. **R9**: `sync-content.yml` opens PRs with `GITHUB_TOKEN`, so CI does not run on them. **H8 remainder**: max-hit text with no number (3 rows: N/A, Varies, "? (melee)") still reads as 0 rather than unknown.
- **Interface:** **U7** remainder: the tour card doesn't take or trap focus. **U11**: `RollInbox` defines `RowFrame` in render, so rows remount and lose focus. **U14**: unlock and achievement reveals aren't keyed, so a second reveal inherits the first's timer. **U15**: the pairing error state offers only Retry, leaving touch users stuck. **U17** remainder: `RunCard.tsx:344` still shows a fixed "/50" Fate.
- **Relay:** **F7**: the overlay URL drops a custom relay address. **F8**: the overlay trusts the payload's shape and size. **F9**: a failed data load publishes an empty ruleset. **F10**: the bundle omits housing and storage. **F11**: legacy `/acks` can prune events without the events token. **F12**: relay POSTs have no timeout. **F13**: worker errors lack CORS headers, there is a KV write per action and no `Access-Control-Max-Age`.
- **Engine:** **E6**: a false `FATE_OVERFLOW` warning with pity off or a threshold above 50. **E7**: the Gambit minimum stake disagrees between engine and UI in legacy modes. **E10/J11**: dormant Roll Inbox acceptance paths ignore the manual rules; they are unreachable today.
- **Modes:** **B5**: area achievements can't be earned in Chunked. **B6**: legacy Xtreme can't roll the locked Misthalin areas. **B7**: the Region Advisor ranks whole continents. **B9**: goal plans turn location labels such as "North Taverley" into area steps (265 steps).
- **Journal:** **J9**: Enter the Abyss's Wizards' Guild route ignores Magic 66. **J12**: jumping to a quest card doesn't clear the difficulty filter. **H11/J8**: Warriors' Guild readiness uses raw levels, while the diary uses tier-capped levels.
- **Advisors:** **H9**: a locked skill is simulated as tier 1. **H10**: every skill step suggests a Skills key. **H14**: the forecast pace is off by one event. **H15**: small items (frontier scoring comment, Z→A skill sort, "1m 60s", a 1.2 s quest-advisor recompute).
- **RuneProof:** **G4**: sources behind locked chunks rank above usable ones. **G5**: a guide revision bump drops valid checks. **G6**: a pinned quest's route header always reads 0%. **G7**: de-duplication drops distinct source access. **G8**: preview-only item lists ship in production.

### Decisions

Decided on 24 September and done on this branch:

- **J2, match OSRS.** Quest Helper's list of official ratings (the pinned snapshot, and its current master) differs from the app for four quests: At First Light (now Novice), Recipe for Disaster's Sir Amik Varze and King Awowogei parts (now Master) and its finale (now Grandmaster). The reviewer had named six other quests; Quest Helper rates all six Intermediate, as the app already did, so they are unchanged. The wiki itself was unreachable, and web search results mixed in older RuneScape ratings. Three newer quests are not in the snapshot and keep their current rating.
- **H1, add a version picker.** Done, with the post-quest, normal or solo fight (or a fight's opening phase) as the default. **H2** is fixed with it.
- **E4, new runs only.** Choosing the game mode now starts the milestone counters from the run's starting total. Runs that already chose their mode keep their schedule.

Still waiting on a decision, with recommendations:

- **J3 / G1, owned-item confirmation (owner unsure).** Recommendation: require the same one-tap confirmation Sheep Shearer uses for every "already have it" route (Karamja Hard's oomlie wrap, Varrock Medium's Digsite pendant, the Cook's Assistant ingredients), and have it complete only that item's own steps. The app then never assumes what is in a player's bank. The cost is one extra tap for players who really have the item. Seven tests pin today's behaviour, so the change needs to update them.
- **P9, encrypted export.** Recommendation: rename it to "Export save file (.fate)" and say in the export that anyone with the file can read its notes and linked account name. Don't add passphrase encryption. A forgotten passphrase would lock players out of their only off-device backup, and the file holds little that is sensitive.
- **F1, relay ownership.** Recommendation: keep an owner record per code that holds only a SHA-256 hash of the write token, never the token. Give it a 90-day lifetime, refreshed on every publish, while the payload keeps its 24-hour lifetime. A code then stays claimed while in use, and can be reclaimed after 90 idle days, which is safe for 128-bit random codes. Existing codes gain their owner record on their first publish after deploy. Record the new retention in `docs/online-relay.md`, and fix F14's pairing wording in the same change. The relay deploys separately with `wrangler deploy`.

### Risks noted but not demonstrated

- `utils/saveSchema.ts:989` recomputes legacy compensation whenever a save's version is below the current one. A future v5 bump would offer it to v4 saves again.
- Magic accuracy may need +9 rather than +8, and the Salamander stance may be Accurate rather than Rapid. Neither could be source-checked offline.

## Guards against drift

The branch adds 14 test files and extends 29 more. The broad guards are:

- `scripts/source-encoding.test.ts`: every app source and data file must be strict UTF-8.
- `config/economy.consistency.test.ts`: every Omni percentage the Codex documents must match the roll engine.
- `data/activityRequirements.consistency.test.ts`: every required area must be a known area.
- `data/consistency.test.ts`: CA reward chips must name real bosses.
- `scripts/sync-achievement-diaries.test.ts`: level-1 skilling tasks must carry the skill gate, and the alternative-route list must match the audit.
- `components/ChangelogModal.dom.test.tsx`: uses the real release list, so a claim buried in an old release can't pass again.
- `data/questDifficulty.source.test.ts`: every quest's difficulty must match the official rating in the pinned Quest Helper snapshot, and new quests missing from it are named.

## Not covered

- The RuneLite plugin (Java) and its side of the relay contract, the deployed Cloudflare Worker and KV, a real Discord webhook, and Wise Old Man; all were exercised with mocks only.
- OSRS Wiki facts: the wiki was unreachable from this sandbox, so artwork, wiki-fed data and quest difficulties were not checked against it.
- Browsers other than Chromium, real phones (an emulated 390×844 viewport only), and assistive technology beyond accessible-name and keyboard checks.
- Chunked mode was covered by unit tests and data checks, not a full browser playthrough.

## Deployment notes

- The web app deploys on merge to `main`. The relay change (`0a022ea`) only goes live after `wrangler deploy` from `workers/fate-relay`.
- The monster catalogue's `normalizationVersion` is now 2, so cached catalogues are rebuilt once from the shipped file. No network request is needed.
- Discord cursors saved by the old version reseed silently to the newest history entry on first run. No announcements are replayed.
- Every player sees the new What's New release once.
- The Chunked milestone change applies to runs whose mode is chosen after deploy. Boss Planner version choices are stored per device.
