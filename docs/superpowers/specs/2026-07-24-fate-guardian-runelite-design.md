# Fate Guardian and RuneLite Companion Design

**Date:** 2026-07-24
**Status:** Approved design, pending implementation planning
**Repositories:** `Nubles/OSRS-Fate-Locked`, `Nubles/RS3-Fate-Locked-Runelite`

## Purpose

Turn the RuneLite companion into a low-friction rules guardian:

- detect eligible gameplay events and queue their exact roll;
- leave every roll decision and roll action to the player;
- separate trustworthy detections from events requiring confirmation;
- explain current permissions in-game without forcing the player to consult the
  tracker constantly;
- optionally prevent actions that are certainly against the run's rules; and
- keep the web app as the single authority for eligibility, Fate, randomness,
  history, and integrity.

The intended experience is that a player can focus on Old School RuneScape.
RuneLite observes and protects; the web app judges and records.

## Product boundaries

### The web app owns

- Canonical eligibility and requirement evaluation
- Drop rates, Fate Points, pity, rituals, and game-mode rules
- Seeded randomness and every roll outcome
- Duplicate and replay detection
- Run history and integrity verification
- Final Ready, Needs confirmation, Blocked, or Completed classification
- Rules and content versioning

### RuneLite owns

- Observing gameplay events
- Capturing minimal evidence for detected events
- Maintaining a durable local event outbox
- Displaying current rules and permissions in-game
- Warning before known-invalid actions
- Cancelling known-invalid clicks when optional Strict Mode is enabled
- Displaying queue and sync health

RuneLite never awards a key, chooses an unlock, changes the run, or performs a
gameplay action.

## Current release baseline

At design time, the RuneLite Plugin Hub manifest pins plugin commit
`fdca20aad7ffcf159b62210f7492f110c185afee`. The standalone plugin is four
commits ahead at `f450bbd87cee74d26d24061d034368ad9f0c0c86`.

The unreleased changes include:

- the optional current-chunk content overlay;
- locked-bank warnings;
- nearest usable bank and shop HUD guidance; and
- correct mode-specific free areas plus improved lock parity with the web app.

The existing roadmap claim that the Hub still serves `dc3823c` is stale.

Release the existing four-commit update separately before Fate Guardian work so
the new feature is reviewed and debugged from the correct baseline.

## System architecture

### Shared rules manifest

The next RuneLite bundle version expands from map-centric state into a complete,
versioned permission snapshot.

It includes:

- run ID, bound account, game mode, run revision, and export time;
- rules version, content version, bundle version, and detector contract version;
- unlocked regions and chunks;
- skill method caps;
- equipment tiers;
- banks and shops;
- bosses and minigames;
- mobility and transport networks;
- spellbooks, prayers, and Arcana;
- guilds and farming patches;
- Slayer unlocks;
- current keys, Fate Points, active ritual, and pinned goal; and
- the compact content indexes required for in-game decisions.

The plugin may evaluate immediate access from this snapshot, but the web app
always revalidates a queued roll against canonical state.

### Gameplay event envelope

Every detected occurrence is represented by an immutable event:

```text
eventId
runId
account
runRevision
eventType
canonicalLabel
occurredAt
sessionSequence
bundleVersion
rulesVersion
contentVersion
detectorId
detectorVersion
evidence
```

`evidence` contains only what is needed to validate the detector, such as a chat
signature, widget group, varbit transition, clue tier, or loot-event identity.
It does not contain credentials, complete inventories, or unrelated gameplay
data.

### Reliable event delivery

RuneLite maintains a small persistent outbox:

1. Detect the event and assign its immutable ID.
2. Persist it locally before attempting network delivery.
3. Retry until the web app acknowledges it.
4. Retain acknowledged IDs long enough to prevent replay after restarts.
5. Never drop an event because the relay is offline.

The relay uses an append-and-acknowledge event channel rather than overwriting a
capped array. Delivery is idempotent by `eventId`.

The web app validates each event and returns one of:

- **Ready to roll** — exact detection and currently eligible.
- **Needs confirmation** — credible but ambiguous or based on stale context.
- **Blocked** — detected, but not eligible; includes a concise reason.
- **Completed** — rolled, intentionally dismissed, or rejected as a duplicate.

No event state transition triggers a roll automatically.

## Roll Inbox

### RuneLite panel

The plugin panel displays:

- number of Ready events;
- number requiring confirmation;
- current rule-warning count;
- last successful tracker sync; and
- an action that opens the web tracker directly at the Roll Inbox.

### Web app

Each inbox row supports:

- **Roll** — opens the existing roll interaction for that source;
- **Review** — resolves an uncertain canonical match;
- **Not eligible** — records the canonical rejection reason;
- **Dismiss** — records an intentional player decision; and
- **Dismiss duplicate events** — only for occurrences already recorded.

After the player rolls, the app records the result in normal history and
acknowledges the source event. The event does not create a separate randomness
path.

## Detection policy

Detection confidence is conservative. Unsupported or heuristic detectors start
in Needs confirmation and graduate to Ready only after fixture and playtest
evidence.

| Gameplay event | Default classification | Exact requirements |
| --- | --- | --- |
| Skill level gained | Ready | Exact skill and level; matching account and current bundle |
| Quest completed | Ready | Quest name maps uniquely |
| Quest with unknown name | Needs confirmation | Player selects the quest |
| Combat Achievement | Ready | Exact task name from the completion message |
| Individual Diary task | Ready when proven | Exact individual-task mapping |
| Diary tier completion | Needs confirmation | Offers newly completed tasks for review |
| Collection Log entry | Ready | Maps to one incomplete slot |
| Ambiguous Collection Log item | Needs confirmation | Player selects the slot |
| Clue casket | Ready | Exact clue tier and opening event |
| Slayer task completion | Ready | Assignment, master, and completion tracked |
| Slayer task joined mid-assignment | Needs confirmation | Source cannot be proven |
| Recognised boss kill | Ready | Exact boss and approved detector |
| Combat-level or loot heuristic | Needs confirmation | Heuristic evidence only |
| Recognised raid completion | Ready | Exact raid reward event |
| Supported minigame completion | Ready | Dedicated completion detector |
| Generic activity message | Needs confirmation | Insufficient identity |
| Pet obtained | Ready | Exact new pet identity |
| Ambiguous pet message | Needs confirmation | Player selects the pet |

An event only becomes Ready when:

- the account matches the run's bound account;
- the event references the same run ID;
- the event's run revision matches the app, or canonical history can prove the
  event was eligible at that revision;
- the source exists in canonical data;
- the occurrence has not already been rolled, queued, or acknowledged;
- prerequisites and permissions were satisfied;
- the selected mode permits that key source; and
- the detector version is approved for exact handling.

Stale, mismatched, or unknown context never produces a Ready event.

## Optional Strict Mode

Strict Mode is exposed as one checkbox:

> Strict Mode — prevent actions that are certainly against this run's rules

It is **off by default** and only activates after explicit player choice.

When enabled, it may consume a click for:

- locked NPCs and objects;
- locked banks;
- known teleports into locked territory;
- equipment above the unlocked slot tier;
- explicitly locked bosses or activities;
- locked shops, transport networks, or farming patches; and
- other actions whose target and rule result are both certain.

Strict Mode:

- never performs an action;
- never cancels an Unknown decision;
- explains a prevented action concisely;
- provides a **Pause Strict Mode for 60 seconds** button in the plugin panel,
  with a visible countdown, for deliberate emergency overrides;
- can be disabled immediately;
- logs prevented actions locally for troubleshooting; and
- leaves server-authoritative movement warning-only.

The initial release covers chunks, NPCs, objects, banks, known teleports, and
over-tier equipment. Other categories are enabled only when their mappings and
tests are complete.

## Chunk information panel

### Information architecture

The approved layout is **category-first**. It is compact, visually polished,
and designed for RuneLite's narrow side panel.

The header shows:

- chunk or named area;
- region and canonical chunk coordinates;
- whether entry is allowed;
- sync freshness; and
- compact totals for Can do, Locked, and Not ready.

Content is grouped into relevant categories, such as:

- Skilling and resources
- Banks
- Shops
- Quests
- Combat access
- Travel and transport
- Farming
- Bosses and activities

Empty categories are omitted.

### Category-specific density

The panel does not repeat generic explanations on every row.

- **Banks and shops:** name plus `Locked` or the positive status. Do not show
  redundant text such as "This individual bank has not been rolled" or
  "Unlock from Spend Keys → Banks."
- **Quests:** quest name plus a green tick, orange circle, or red cross.
- **Combat access:** target name plus a tick or cross.
- **Skilling and resources:** may show the concise current cap and requirement,
  because that comparison materially explains availability.
- **Other requirement-heavy content:** show details only on hover, selection, or
  expansion when needed.

Status semantics:

- green tick — available or completable now;
- orange circle — relevant here but missing a requirement;
- red cross or `Locked` — explicitly forbidden by current rules.

Unknown content is visually distinct and is never cancelled by Strict Mode.

The goal is fast scanning, not a rules transcript. A player should be able to
answer "What can I use here?" without reading paragraphs.

## App enhancements

The refactored app is technically strong. Its next improvements should reduce
decisions instead of adding more dashboards.

Priority enhancements:

1. **Today panel** — Ready rolls, confirmations, active restriction, pinned goal,
   and best legal next action in one place.
2. **Universal Why explanations** — every eligibility decision can reveal its
   satisfied and missing requirements on demand.
3. **Dependency-aware unlock guidance** — identify incomplete combinations such
   as Pest Control and Void Knights' Outpost without changing the random result.
4. **Rules versioning** — retain the exact rules/content version for each run and
   offer explicit legacy or migration choices after balance changes.
5. **Local playtest report** — export time-to-first-key, drought length, unused
   unlocks, blocked recommendations, and confirmation rates without uploading
   private data.
6. **Evidence-led balance changes** — evaluate weighted Fate Points,
   early-game boosts, or diminishing returns only after real-run reports.

Additional calculators and dashboards are lower priority than the Roll Inbox,
Today panel, and in-game guardian.

## Failure handling

- **Relay offline:** RuneLite retains events and shows offline/stale status.
- **App offline:** local plugin permissions continue from the latest bundle;
  queued events wait.
- **Stale bundle:** warnings may continue, but exact roll detections requiring
  state are downgraded to Needs confirmation.
- **Wrong account:** no Ready events and no Strict Mode blocking for that run;
  show the existing account mismatch warning.
- **Unknown content:** warn or mark Unknown; never block.
- **Malformed or future bundle:** reject atomically and retain the last valid
  snapshot.
- **Duplicate delivery:** acknowledge the existing event without duplicating the
  queue or roll.
- **Relay restart or RuneLite restart:** persistent outbox resumes idempotently.

## Testing strategy

### Plugin tests

Add Java tests for:

- current and legacy bundle parsing;
- rules and content version handling;
- region, chunk, free-area, and bank parity;
- status decisions for every Strict Mode category;
- Unknown never blocking;
- event ID stability and deduplication;
- outbox persistence, retry, acknowledgement, and restart recovery;
- detector fixtures for every exact and uncertain source;
- compact chunk-panel view models and status counts; and
- account/run mismatch behaviour.

### Web app tests

Add tests for:

- event-envelope validation and resource bounds;
- exact versus confirmation classification;
- run/account/rules-version gates;
- duplicate and replay rejection;
- Roll Inbox state transitions;
- a roll using the canonical existing randomness/history path;
- acknowledgement ordering;
- category-specific chunk status derivation;
- app/plugin rules-manifest parity; and
- future and legacy protocol compatibility.

### Relay tests

Test:

- append idempotency;
- acknowledgement idempotency;
- write-token isolation;
- ordering;
- record and payload limits;
- TTL behaviour;
- retry after transient failure; and
- no cross-run event access.

### Manual verification

Before each Plugin Hub update:

- play one session with online sync on and off;
- restart RuneLite with unacknowledged events;
- test a stale bundle and wrong account;
- verify Strict Mode is off by default;
- verify the 60-second override and countdown;
- confirm Unknown actions are never cancelled;
- confirm the compact chunk panel at normal RuneLite widths; and
- review network additions and consent wording for Plugin Hub compliance.

## Delivery sequence

### Project 0 — Release hygiene

- Ship Plugin Hub `f450bbd`.
- Correct the roadmap baseline.
- Add drift detection for the Hub manifest, standalone plugin, and app mirror.
- Add the first Java bundle and lock-parity tests.
- Triage open plugin issues.

### Project 1 — Durable Roll Inbox

- Introduce the event protocol and persistent outbox.
- Add append/acknowledge relay support.
- Build the web Roll Inbox.
- Add exact level, quest, Combat Achievement, unambiguous Collection Log, clue,
  and recognised boss/raid detectors.

### Project 2 — Shared rules and compact chunk panel

- Ship the expanded versioned rules manifest.
- Centralise plugin-side rule decisions.
- Implement the approved category-first chunk panel.
- Add stale-data and account/run safety states.

### Project 3 — Optional Strict Mode

- Add the default-off checkbox and explicit onboarding.
- Cover only proven categories.
- Add the override and local prevention log.
- Submit as a focused Plugin Hub update with no unrelated detector expansion.

### Project 4 — Detector expansion

- Add Slayer, individual Diary tasks, pets, supported minigames, farming or
  other qualifying activities, and more precise boss sources.
- Begin every new detector in Needs confirmation.
- Promote to Ready only after fixture coverage and real playtesting.

## Success criteria

- Supported exact events require no manual completion bookkeeping.
- No relay retry or client restart creates a duplicate roll.
- Exact-detector false positives remain below 0.5%.
- At least 95% of supported detections require no correction.
- Connected events appear in the web inbox within ten seconds.
- Every prevented Strict Mode action names the governing restriction.
- Unknown actions are never cancelled.
- Strict Mode can be disabled immediately.
- The compact chunk panel answers availability without redundant prose.
- The plugin remains Plugin Hub compliant and performs no gameplay actions.

## Non-goals

- Automatically pressing Roll
- Automatically awarding keys or choosing unlocks
- Moving the entire tracker into RuneLite
- Blocking server-authoritative movement
- Blocking uncertain actions
- Rebalancing the key economy as part of the plugin work
- Uploading behavioural analytics by default
- Adding unrelated calculators or dashboards
