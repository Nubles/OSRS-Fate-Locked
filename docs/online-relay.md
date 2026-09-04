# RuneLite profile relay

The current Plugin Hub candidate uses the public relay in one direction only:
the Fate Locked web app publishes an app-authored profile and RuneLite
retrieves it. Both programs can run on the same PC without a localhost server,
browser extension, clipboard hand-off, or manually copied code.

The relay is optional. Clipboard and local-file imports remain available.

## Current Hub candidate

```text
Browser  POST /r/<code>   publishes the app-authored v4 profile
RuneLite GET  /r/<code>   retrieves and validates that profile
```

RuneLite creates a random 32-character pairing code when the player presses
**Connect tracker**, then opens the online app with that code in the URL
fragment. After the player approves the current profile, the browser:

1. stores the pairing session and its private write token;
2. builds the current v4 profile;
3. publishes it to the fixed relay endpoint; and
4. republishes when that profile's authored state changes.

RuneLite performs only the fixed `GET` request, with optional ETag caching. A
valid response replaces its imported snapshot. A malformed or unsupported
response is rejected without replacing the last valid snapshot.

After the initial pairing check, RuneLite revalidates a connected profile no
more than once per minute and backs off transient failures and rate limits. The
optional stream overlay checks every 30 seconds. The tracker does not poll the
legacy event resources.

The plugin does **not** upload gameplay, account names, detected events,
acknowledgements, suggestions, heartbeats, telemetry, or any other state.
Supported gameplay detections stay in RuneLite's local event history.

## What “Profile sent” means

The browser cannot know whether RuneLite imported the profile because the
plugin sends no receipt. The success message confirms only that the browser
published the latest profile to the relay.

This is intentionally not described as a live connection. If RuneLite is
closed, offline, or rejects the payload, the browser receives no status about
that condition.

## Current API

| Method | Path | Body / response | Ownership |
|---|---|---|---|
| `POST` | `/r/<code>` | `{ token?, payload }` | Browser publishes the v4 profile; 24-hour TTL. |
| `GET` | `/r/<code>` | `{ version, payload }` | RuneLite reads; supports `If-None-Match`. |

The first browser write claims the record with a private token. The app
persists that token in the pairing session so later profile revisions can
replace the same record.

## Legacy compatibility only

The Worker temporarily retains these older routes so already-installed legacy
clients do not fail abruptly:

- `/r/<code>/state`
- `/r/<code>/events`
- `/r/<code>/acks`
- `/r/<code>/suggest`

They are not part of the current Hub candidate's connection. Current UI and
documentation must not use them to claim that the plugin is connected, has
sent gameplay, or has acknowledged an import.

## Ownership and safety boundary

- **The app authors policy.** It exports the run, unlocks, account binding,
  rules, content versions, and category-first permission decisions.
- **RuneLite consumes policy.** It renders those decisions, warns before
  locked actions, and fails open when the app did not provide enough
  information for a safe decision.
- **RuneLite observes locally.** Detection history is stored on the player's
  machine and is never transmitted by the current Hub candidate.
- **The relay stores bytes.** It cannot classify gameplay, alter a run, or
  perform a roll.
- **Only the player rolls.** Importing, rendering, detecting, or reviewing an
  event never invokes the app's dice engine.

Plugin source, builds, releases, and Plugin Hub review live exclusively in the
standalone
[OSRS-Fate-Locked-Runelite](https://github.com/Nubles/OSRS-Fate-Locked-Runelite)
repository. The web repository contains no Java plugin or plugin download
pipeline.

## Privacy and retention

The published v4 profile contains the tracker state needed to render and
enforce the player's current restrictions. It contains no password, session
cookie, chat history, inventory dump, or arbitrary telemetry.

The current relay record expires after 24 hours. Anyone with the random
pairing code can read that record during its lifetime; the private token is
required to replace it. Use clipboard or local-file import if relay data
should not leave the machine.

## RuneLite bundle v4

The app exports `version: 4` with a canonical `rules` manifest. It includes
the run, account, game mode, rules/content/detector versions, every unlock
family, bank-lock state, and category-first chunk permission snapshots. Root
fields from v3 remain for one compatibility release.

Permission status is `ALLOWED`, `NOT_READY`, `LOCKED`, or `UNKNOWN`. `UNKNOWN`
means the app cannot safely decide and must never become a blocking warning.
RuneLite consumes these authored decisions without re-implementing quest,
skill, merchant, bank, or activity rules.

`rules.knownMobility` declares the mobility methods the app can evaluate,
while `rules.unlocks.mobility` is the unlocked subset. Typed fallback exports
retain that authority only when mobility state was explicitly supplied;
otherwise the known set is empty so Travel Guardian fails open instead of
inventing authority.

The `FLGZ:` relay payload is tested against the existing 256 KiB compressed
limit. RuneLite continues to load v1-v3 bundles using legacy map behavior; a
malformed v4 or unsupported future version is rejected without replacing the
last valid snapshot.

## Worker deployment

The app defaults to `https://fate-relay.fatelocked.workers.dev`. A deployment
can override it with `VITE_FATE_RELAY`; local development can set
`fate_relay_base` in browser storage.

From `workers/fate-relay/`, install Wrangler, authenticate, configure the
`RELAY` KV namespace in `wrangler.toml`, and run `wrangler deploy`.
