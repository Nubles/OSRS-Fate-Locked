# Online sync relay (optional)

Online sync connects the web tracker and RuneLite using outbound HTTPS requests to a small Cloudflare Worker. It is optional and off by default. Clipboard and local-file imports remain fully supported.

## Ownership and consent

The boundary is intentionally strict:

- **RuneLite detects and queues facts.** It writes a durable local outbox entry for a supported in-game event and retries delivery after restarts or temporary failures.
- **The web app validates.** It checks the run, bound account, revision, detector contract, and canonical app data before showing an event in the Roll Inbox.
- **Only the player rolls.** Ingesting, rendering, retrying, or reviewing an event never invokes the dice engine. A normal roll happens only after the player presses **Roll** in the web app.
- **The relay stores records; it does not decide anything.** It cannot classify an event, alter a run, or roll.

The RuneLite **Enable online sync** checkbox defaults to off and carries RuneLite's third-party network warning. With it off, the plugin makes no relay requests and does not append detected events to the local network outbox.

## Deploy the Worker

From `workers/fate-relay/`:

1. Install Wrangler and sign in.
2. Create the `RELAY` KV namespace and place its ID in `wrangler.toml`.
3. Run `wrangler deploy`.

The app defaults to `https://fate-relay.fatelocked.workers.dev`. A deployment can override it with `VITE_FATE_RELAY`; local development can set `fate_relay_base` in browser storage.

## Pairing

1. Enable Online sync in the web app. It creates a random pairing code and a private write token retained by that browser.
2. Enable Online sync in RuneLite and paste the pairing code.
3. RuneLite polls for the run bundle and delivers detected events. The app polls the event inbox and posts terminal acknowledgements.

Both clients are outbound-only. The plugin never opens a local server.

## v1 detected-event envelope

Every `/events` record contains:

| Field | Meaning |
|---|---|
| `protocolVersion` | Event protocol version (`1`). |
| `eventId` | Stable idempotency key retained across retries and restarts. |
| `runId`, `runRevision` | Run identity and the revision used when detection occurred. |
| `account` | Logged-in character name used for bound-account validation. |
| `eventType` | `SKILL_LEVEL`, `QUEST`, `COMBAT_ACHIEVEMENT`, `COLLECTION_LOG`, `CLUE_CASKET`, `BOSS_KILL`, `RAID_COMPLETION`, `SLAYER_TASK`, `DIARY_TASK`, `PET_DROP`, or `MINIGAME_COMPLETION`. |
| `canonicalLabel` | Detector label, or `null` when the plugin cannot identify it safely. |
| `occurredAt`, `sessionSequence` | Event ordering evidence. |
| `bundleVersion`, `rulesVersion`, `contentVersion` | App/bundle compatibility context. |
| `detectorId`, `detectorVersion` | Approved detector contract identity. |
| `confidence` | `EXACT` or `UNCERTAIN`; the app still performs canonical validation. |
| `evidence` | Small bounded detector-specific facts such as skill and level. |

Batches are bounded to 100 events, each event to 8 KiB, and evidence to 32 keys. The app treats wrong-run/account events as blocked and stale or ambiguous data as needing review. Existing quest/task/level/Collection Log progress is not used to silently consume a pending roll.

## API

| Method | Path | Body / response | Retention and ownership |
|---|---|---|---|
| `POST` | `/r/:code` | `{ token?, payload }` | App writes the run bundle; 24-hour TTL. |
| `GET` | `/r/:code` | `{ version, payload }` | Plugin reads; supports `If-None-Match`. |
| `POST` | `/r/:code/events` | `{ token?, events: FateEventEnvelope[] }` | Plugin appends idempotently by `eventId`; seven-day TTL. |
| `GET` | `/r/:code/events` | `{ events }` | App reads the bounded event queue. |
| `POST` | `/r/:code/acks` | `{ token, acknowledgements }` | App writes `COMPLETED`, `DISMISSED`, or `DUPLICATE`; seven-day TTL. |
| `GET` | `/r/:code/acks` | `{ acknowledgements }` | Plugin removes terminal events from its durable outbox. |
| `POST/GET` | `/r/:code/state` | Heartbeat `{ ts, version }` | Plugin writes, app reads; 24-hour TTL. |
| `POST/GET` | `/r/:code/suggest` | Legacy suggestion array | Kept for one compatibility release; the app no longer consumes it. |

Each structured sub-resource owns its own first-writer token. Event append and acknowledgement operations are idempotent, so retrying the same `eventId` does not create another inbox item or roll.

## Migration from `/suggest`

`/suggest` was a transient reminder channel with timestamp-based deduplication. The durable Roll Inbox supersedes it with stable event IDs, persisted plugin delivery, canonical app validation, explicit terminal states, and acknowledgements. The Worker keeps `/suggest` compatible for one release so older installed plugins do not fail, but current app code does not poll it.

## Privacy and retention

Run bundles contain unlock state and tracker status. Detected events contain the bound character name, run identity, label, timestamps, detector version, and bounded evidence. They contain **no account credentials, passwords, session cookies, chat history, inventory dump, or arbitrary telemetry**.

Main bundle/state records expire after 24 hours. Event and acknowledgement records expire after seven days so an event detected while the app is closed can survive a realistic outage. Anyone with the random pairing code can read that code's records; private write tokens are required for protected writes. Use clipboard/file sync if you do not want relay data to leave the machine.

## RuneLite bundle v4

The app now exports `version: 4` with a canonical `rules` manifest. It includes
the run, account, game mode, rules/content/detector versions, every unlock
family, bank-lock state, and category-first chunk permission snapshots. Root
fields from v3 remain for one compatibility release.

Permission status is one of `ALLOWED`, `NOT_READY`, `LOCKED`, or `UNKNOWN`.
Unknown means the app cannot safely decide and must never be converted into a
blocking warning. RuneLite consumes these authored decisions without
re-implementing quest, skill, merchant, bank, or activity rules.

The `FLGZ:` relay payload is tested against the existing 256 KiB compressed
limit. RuneLite continues to load v1-v3 bundles using legacy map behavior; a
malformed v4 or unsupported future version is rejected without replacing the
last valid snapshot.

## Travel Guardian and `knownMobility`

`rules.knownMobility` is the authority list: it declares which canonical
mobility names the snapshot can classify. It is not the player's unlock list.
`rules.unlocks.mobility` is the Allowed subset. A full authored manifest emits
the sorted canonical mobility list as authority; a typed fallback emits that
authority only when the caller supplied mobility state. No authority is an
empty `knownMobility` list, so RuneLite returns Unknown instead of guessing
Locked.

Travel Guardian remains part of the existing Strict Mode checkbox, which is
off by default. RuneLite may prevent travel only for a fresh snapshot bound to
the logged-in account, an exactly recognised canonical destination, and a
proven Locked destination or known mobility rule. Allowed, Not ready, Unknown,
stale, wrong-account, legacy, malformed, and unsupported snapshots fail open.
The shared Strict Mode pause lasts 60 seconds and applies to travel as well as
every other guarded category.

Travel prevention does not add a relay endpoint or event type. The four-second
banner, ten-second per-action chat suppression, and bounded audit record stay
local. Suggested alternatives are computed only from an Allowed destination
plus locally verified item, real-level, and spellbook state. RuneLite never
activates a suggestion, clicks, paths, moves the player, or performs gameplay.

### Operator release safety

The Worker treats the bundle as an opaque payload; a Travel Guardian mirror
does not require a relay deployment. Before release, pin `runelite-plugin/` to
a reachable standalone commit, require byte-identical mirror verification, the
full standalone Gradle gate, app tests, TypeScript type-check, production
build, and the live RuneLite matrix. Do not advance the Hub pin if any Allowed
or Unknown action is consumed, stale/wrong-account data blocks travel, chat
floods, the pause fails to resume automatically, or a suggested alternative
is not actually available. Keep the last valid snapshot active when a later
import is malformed.

## Detector handling

RuneLite observes and queues facts; it never rolls or performs gameplay. The app
owns the handling policy and can downgrade a detector to review, but it never
upgrades an unknown ID or newer version. Confirmation changes a row to Ready;
the player must still press **Roll**.

| Detector | Version | Signal | Handling | Known limitation |
|---|---:|---|---|---|
| `skill-level-v1` | 1 | RuneLite stat change | Ready after validation | Requires a real level increase. |
| `quest-widget-v1` | 1 | Quest reward widget | Ready after validation | Unknown quest names require review. |
| `combat-achievement-chat-v1` | 1 | Exact combat-task chat | Ready after validation | Depends on the canonical task label. |
| `collection-log-chat-v1` | 1 | Collection Log chat | Ready or review | Duplicate item names require a choice. |
| `clue-casket-loot-v1` | 1 | Checked casket identity | Ready after validation | Only supported casket tiers are accepted. |
| `boss-loot-v1` / `raid-loot-v1` | 1 | Checked loot encounter | Ready after validation | Retained for one compatibility release. |
| `slayer-task-v1` | 1 | Remembered assignment plus completion chat | Needs confirmation | Player chooses the Slayer master/rate; assignment must be observed first. |
| `diary-task-v1` | 1 | Diary tier varbit transition | Needs confirmation | Player chooses the completed task from that tier. |
| `pet-drop-v1` | 1 | New-pet chat, optionally correlated to follower ID | Needs confirmation | Unknown follower identities use a generic Pet drop review. |
| `minigame-completion-v1` | 1 | Pest Control widget plus exact win chat | Needs confirmation | Pest Control only; both signals must occur within five seconds. |
| `boss-kill-v2` | 2 | Checked encounter mapping plus loot event | Needs confirmation | Group encounters are never treated as personal proof. |

The local **Export playtest report** action contains aggregate detector counts
only. Promotion thresholds and current evidence status are recorded in
[`detectors/promotion-log.md`](detectors/promotion-log.md).