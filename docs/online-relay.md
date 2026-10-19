# RuneLite profile relay

The current Plugin Hub candidate uses the public relay in one direction only:
the Fate Locked web app publishes an app-authored profile and RuneLite
retrieves it. Both programs can run on the same PC without a localhost server,
browser extension, clipboard hand-off, or manually copied code.

The relay is optional. Clipboard and local-file imports remain available.

## Current Hub candidate

```text
Browser  POST /r/<code>   publishes the app-authored v4 profile
Browser  POST /r/<code>   marks the code gone when the player presses Disconnect
RuneLite GET  /r/<code>   retrieves and validates that profile
```

With the plugin update that adds **Send to tracker** and badges (relay
deployed separately, see `workers/fate-relay/DEPLOY-NOTES.md`):

```text
RuneLite POST   /r/<code>/inbox      Send to tracker: what RuneLite noticed, to wait for the tracker
Browser  GET    /r/<code>/inbox      the tracker takes it into the Roll Inbox (write token)
Browser  POST   /r/<code>/inbox/ack  and empties what it took (write token)
RuneLite POST   /r/<code>/badge      the player's opt-in badge: character name and milestone
RuneLite DELETE /r/<code>/badge      sharing turned off, or Disconnect
RuneLite GET    /badges              the public badge list
```

RuneLite creates a random 32-character pairing code when the player presses
**Connect tracker**, then opens the online app with that code in the URL
fragment. After the player approves the current profile, the browser:

1. stores the pairing session and its private write token;
2. builds the current v4 profile;
3. publishes it to the fixed relay endpoint at once; and
4. republishes when that profile's authored state changes. Each publish is a
   full KV write, so changes are coalesced: the newest state is sent once they
   pause for 5 seconds, or after a minute if they never pause, with one
   request in flight at a time. Retry publishes at once.

A publish that fails is tried again by itself after 15 seconds, then 1
minute, then every 5 minutes until one works (`relayRetryDelayMs` in
`services/relaySync.ts`); a run change or Retry sends sooner, and a publish
that works starts the count over. Retrying stops when it can't help: the relay
refused the pairing (`403`) or the profile (`400`, `413`), or the tab isn't
saving the profile. From the second failure in a row, or at once when
retrying can't help, `components/RelayPublishBanner.tsx` says under the
header that RuneLite isn't getting the latest rules, why, that RuneLite is
still using the rules it last received, and when the next try is, with
**Retry now**. A tab that isn't saving the profile is left to the save
banners.

The pairing belongs to the profile approved in the dialog. Every browser tab
shares it, but only a tab showing that profile publishes; a tab on another
profile shows RuneLite as not connected. Pairing again or pressing
**Disconnect** in one tab applies to every open tab. A pairing saved before
its profile was recorded is bound to the profile of the first tab that
publishes it.

After forgetting the pairing, **Disconnect** asks the relay to
[mark the code gone](#marking-a-code-gone) with the pairing's write token, so
the relay stops serving the last profile, and the linked account in it, to
anyone who has the code. The request waits for a publish that tab already has
on its way, which would otherwise land after it and put the profile back. It
is sent once and is best effort: if it fails, for example offline, the
profile expires with its record 30 days after the last publish.

The rules are built from the app's chunk and equipment data. If either fails
to load, the browser publishes nothing: the relay keeps the last complete
profile, and the app shows the error with Retry. (A profile built without
that data would have empty rules, and RuneLite would allow everything.)
Clipboard and file exports still build from whatever loaded.

RuneLite performs only the fixed `GET` request, with optional ETag caching. A
valid response replaces its imported snapshot. A malformed or unsupported
response is rejected without replacing the last valid snapshot.

After the initial pairing check, RuneLite revalidates a connected profile no
more than once per minute and backs off transient failures and rate limits. The
optional stream overlay checks every 30 seconds.

The Plugin Hub build does **not** upload gameplay, account names, detected
events, acknowledgements, suggestions, heartbeats, telemetry, or any other
state. Supported gameplay detections stay in RuneLite's local event history
until the player selects **Copy for tracker**, which puts them on the
clipboard. The Roll Inbox's **Paste from RuneLite** reads them from there.
Neither step uses the relay.

## Send to tracker

The plugin update adds **Send to tracker** beside Copy for tracker. Only
when the player presses it, RuneLite posts exactly what Copy for tracker
would copy to `POST /r/<code>/inbox`. The relay holds the events under
`ri:<code>`, merged by event id (a re-sent id replaces the held copy), the
newest 250 within 256 KiB, for 30 days after the last send; an event older
than 30 days, or larger than the tracker's 8 KiB, is never held. Anyone
holding the pairing code can add to it, as anyone holding it can read the
profile; only the code's write token, which only the tracker has, can read
or empty it. A code with no profile, or one marked gone, answers `404`
`{"error":"no profile"}`.

The tracker's tab that saves the paired profile takes them
(`hooks/useRelayInboxSync.ts`, `services/relayInbox.ts`): at once on start
and when the tab shows again, every minute while it shows, never twice in
10 seconds, and after a failure only after the publish backoff (15 s, 1 min,
then every 5 min). It adds the events to the Roll Inbox through the same
function as Paste from RuneLite (`addRuneliteEvents`,
`utils/runelitePaste.ts`): the inbox skips event ids it already has, refuses
events older than 30 days, and names whose events they were for a run
linked to no one. Then it acknowledges every id it read, those already here
and those it couldn't use too, so the relay empties. The Roll Inbox says
"Added 3 from RuneLite." Nothing rolls: the player still chooses Roll. A
relay from before Send to tracker answers `404 not found`, and the tracker
stops asking until the page is reloaded.

## Badges

Off by default in the plugin. With **Share my badge** on, the plugin posts
`{ name, tier }` to `POST /r/<code>/badge` (a live profile is needed): the
character name, 1 to 12 letters, digits, spaces, `-` and `_`, and the
milestone, 0 (under 25%) to 4 (Fate Unbound, 100%). Every badge lives in
one KV record, `badges`: `{"v":1,"byCode":{"<code>":{"n","t","at"}}}`. A
post or `DELETE` (allowed even for a gone code) rewrites it, one KV write
per change, dropping badges over 30 days old; the plugin resends its badge
at least daily while sharing is on, and the same badge again within an hour
writes nothing. KV takes about one write a second per key, so a write can
fail: the relay then answers `503` with `Retry-After: 60`, and the plugin
tries again later. Two changes at once can also read the same record, and
the later write wins; the lost one comes back with that player's next
resend. With 5000 live badges held, a new code gets `503` and nobody is
dropped for it.

`GET /badges` is public: `{"badges":[{"n","t"}]}`, live badges only, one
entry per name (its newest badge, names compared as the plugin compares
them), sorted by name, at most 5000. It reads the one record through the
location's KV cache (`cacheTtl` 5 minutes) and each Worker isolate keeps
the list it built for 5 minutes, so serving it never lists KV (the free plan
allows 1,000 list operations a day, and Cloudflare's Cache API does nothing
on a `*.workers.dev` address). It has `Cache-Control: public, max-age=600`
and an `ETag` of its body for `If-None-Match`.

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
| `POST` | `/r/<code>` | `{ token?, payload }` | Browser publishes the v4 profile; kept 30 days after the last publish. Refused without the code's write token. |
| `POST` | `/r/<code>` | `{ token, gone: true }` → `{ version, gone: true }` | The owner marks the code gone: a tombstone replaces the profile for 90 days. Refused without the code's write token. |
| `GET` | `/r/<code>` | `{ version, payload }` | RuneLite reads; supports `If-None-Match`. A gone code answers `404` with `{"gone":true}`. |
| `POST` | `/r/<code>/inbox` | `{ format, events }` → `{ accepted, held }` | RuneLite's Send to tracker; anyone with the code. |
| `GET` | `/r/<code>/inbox` | → `{ format, events }` | The tracker, with `Authorization: Bearer <write token>`. |
| `POST` | `/r/<code>/inbox/ack` | `{ ids }` → `{ held }` | The tracker, with its write token. |
| `POST` | `/r/<code>/badge` | `{ name, tier }` → `{ ok: true }` | The plugin; anyone with the code. |
| `DELETE` | `/r/<code>/badge` | → `{ deleted: true }` | The plugin; anyone with the code. |
| `GET` | `/badges` | → `{ badges: [{ n, t }] }` | Public. |

`<code>` is RuneLite's pairing code, 32 lower-case hex digits; any other
code is answered `400`. A `payload` is `FLGZ:` and base64 gzip, or a bundle
as a plain JSON object; anything else is answered `400`. See
[Abuse limits](#abuse-limits).

The relay also keeps players' encrypted online backups under `/b/<id>`; see
[online-backup.md](online-backup.md). It also takes the web app's error
reports at `POST /e`; see [Error reports](#error-reports).

The first browser write claims the record with a private token. The app
persists that token in the pairing session so later profile revisions can
replace the same record.

The Worker also keeps a separate owner record, `own:r:<code>`, that holds
only a SHA-256 hash of the token and the time it was last refreshed. It lasts
90 days from the last refresh, and publishes refresh it at most once a day to
spare KV writes. A code therefore stays claimed after its 30-day profile
record expires; after 90 days without a publish it can be claimed again,
which is safe for random 128-bit codes. Codes published before owner records
existed are adopted on their owner's next publish.

The pairing dialog asks the player to continue only if they just pressed
**Connect tracker** in RuneLite, because any website can open a pairing link.
It shows only the code's last four characters, such as `…a1b2`, so a stream
or screenshot of the dialog does not reveal the code. The app still stores
and sends the whole code.

## Marking a code gone

The owner can withdraw a published profile before its record expires; the app
does so when the player presses **Disconnect**.
`POST /r/<code>` with `{ token, gone: true }` and no payload is authorised
like a publish: it needs the code's write token and refreshes the owner
record the same way. The Worker replaces the profile with a tombstone,
`{ gone: true, version, token }`, which holds no profile data, keeps it for
90 days like an owner record, and answers `{ version, gone: true }`. The
version rises as for any write.

A `GET` of a gone code answers `404` with the body `{"gone":true}`, whatever
its `If-None-Match`. It is a 404, as for a code with no profile, and never a
410: the plugin builds players already have read a 404 as a missing profile,
but would treat a 410 as an outage and back off, and the stream overlay would
keep showing its last frame. A later publish with the owner's token replaces
the tombstone with a profile as usual.

## Versions and ETags

Every write gives the record a new `version`, which `GET` returns in the body
and as the `ETag`. RuneLite imports a response only when the two match, the
version is a positive whole number that fits a Java `int`, and it is greater
than the version RuneLite last imported. Otherwise RuneLite keeps its current
snapshot.

The Worker therefore sets each version to the number of seconds since
1 January 2026 (UTC), or to one more than the stored version when that is
higher. Versions keep rising when a record expires and is published again. A
plain counter restarted at 1 there: clients holding its ETag were told
`304 Not Modified` about the new profile, and RuneLite kept enforcing the old
one. For the same reason, the first publish after this rule was deployed
outranks every counter version issued before it. The epoch must never change;
seconds since 2026 fit a Java `int` until 2094.

One case remains: two writes to one code in the same second can read the same
stored version and store the same number. The later write wins, and a client
that fetched the earlier one can be told `304` until the next publish. Only
the code's owner can write, and a browser tab sends its publishes one at a
time, so this needs two of the owner's tabs or devices publishing within the
same second.

The `ETag` is the bare version, such as `41`, and RuneLite sends it back as it
is in `If-None-Match`. A `GET` whose `If-None-Match` names the stored version
is answered `304 Not Modified` with the same bare `ETag`, whether the
validator is bare, quoted (`"41"`) or weak (`W/"41"`), as a proxy or another
client may send it. Any other value, including a list of validators or `*`,
gets the full reply.

## Removed legacy resources

The Worker no longer has `/r/<code>/state`, `/r/<code>/events`,
`/r/<code>/acks` or `/r/<code>/suggest`; they answer `404`. Neither the
app, the plugin's `main`, nor the Plugin Hub build players run (plugin commit
`0ae842d`) requested them: the plugin's only request is `GET /r/<code>`
(`TrackerConnectionController`), and the app's client for them
(`services/fateEventRelay.ts`) was used only by its own tests. Roll Inbox
decisions stay in the browser.

## Abuse limits

Anyone can send the relay a request, so it accepts only what its own clients
send, and checks that before it reads or writes KV (the free plan allows
1,000 KV writes a day for everyone, and 1 GB of storage):

| Route | Accepted id | Body |
|---|---|---|
| `/r/<code>` | 32 lower-case hex digits: RuneLite's `PairingSupport.newCode`, a UUID without dashes | `{ token?, payload }` or `{ token, gone: true }`, at most 256 KiB; `payload` is `FLGZ:` + base64 gzip, or a JSON object; `token` is at most 128 of `A-Z a-z 0-9 _ -` |
| `/b/<id>` | 32 bytes in base64url (43 symbols, the last one of the 16 that 32 bytes can end on) | `FLBK1.<16-symbol IV>.<ciphertext>`, base64url, at most the longest sync code encrypted (about 2.67 MiB) |
| `/p/<id>` | 16 bytes in base64url (22 symbols, ending in `A`, `Q`, `g` or `w`) | the progress summary, at most 8 KiB |
| `/l/<discordId>` | a Discord snowflake, 17 to 20 digits | the bot's `{ code }` |
| `/r/<code>/inbox` | as `/r/<code>` | `{ format: "fate-locked-runelite-events", events }`, at most 64 KiB and 1 to 100 events, each an object with an event id (`eventId`, or `id`) of 1 to 128 characters and an `occurredAt` in ms at most 30 days old and 10 minutes ahead |
| `/r/<code>/inbox/ack` | as `/r/<code>` | `{ ids }`, up to 250 ids of 1 to 128 characters, at most 40 KiB; a `Bearer` token of at most 128 of `A-Z a-z 0-9 _ -` |
| `/r/<code>/badge` | as `/r/<code>` | `{ name, tier }`, at most 1 KiB; the name 1 to 12 of `A-Z a-z 0-9`, space, `_`, `-` after trimming; the tier 0 to 4 |

Any other id is answered `400`, any other path `404`. The app's tests pin
each of these to what the app makes (`utils/runelitePairing.test.ts`,
`utils/onlineBackup.test.ts`, `utils/progressShare.test.ts`, and
`scripts/goldenBundles.test.ts` for every golden run's profile).

Writes are also limited per IP address with Cloudflare's Workers Rate
Limiting bindings, declared in `workers/fate-relay/wrangler.toml`. Past a
limit the relay answers `429` with `Retry-After: 60`, before touching KV:

| Binding | Counts | Limit | Why this much |
|---|---|---|---|
| `RELAY_WRITE_LIMITER` | every `POST` and `DELETE` to `/r/` (Send to tracker, its acknowledgements and badges included), `/b/` and `/p/` | 30 a minute | A player sends at most about one profile, one backup and one progress summary a minute, a few more when switching to the game client sends a waiting profile at once, or on Retry. 30 leaves room for a household of players behind one address. |
| `RELAY_CLAIM_LIMITER` | writes that create a record: a code's first publish, a new backup id or shared run, each Discord link code | 4 a minute | Turning on RuneLite, online backup and sharing, and asking for a link code, all in one minute, is 4. |
| `RELAY_ERROR_LIMITER` | `POST /e` | 10 a minute | A page reports each error once (and the relay forwards each message once in 10 minutes anyway). |

Reads are not limited: RuneLite checks at most once a minute and the stream
overlay every 30 seconds. The Discord bot's `/l/` routes need its secret and
are not limited. The app already treats a `429` like a relay outage: the
profile and backups are tried again later, and shared progress a minute
later. Cloudflare counts per location and approximately, so the limits are
generous, never exact. Without the bindings (tests, local development) or if
one fails, nothing is limited.

The limits slow abuse down; they don't make the daily KV quota safe. One
address at the write limit could still spend the free plan's 1,000 writes in
about half an hour, and many addresses faster. Moving the relay to Workers
Paid (1 million writes a day) is what makes the quota hard to exhaust.
The owner chose on 13 October 2026 to stay on the free plan for now and
revisit the upgrade later.

## Error reports

`POST /e` takes a JSON report, `{ build, kind, message, stack, path }`, of at
most 8 KiB, with no authentication, and always answers `204` at once with the
CORS headers, whatever the body; any content type is read as JSON, so a
`navigator.sendBeacon` text body works. Nothing is stored. After the
response, a report with a message or a stack is logged and, when the
`ERROR_WEBHOOK_URL` secret is a Discord webhook URL, posted there as a short
plain-text message: a heading with the kind, build and path, then the message
and stack as literal text, cut to Discord's limit, with mentions and link
previews off. The same message from the same build is posted once in 10
minutes per Worker instance. With the secret unset, reports are only logged
(`wrangler tail`).

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

The current relay record expires 30 days after the last publish, or sooner
when the player presses **Disconnect**, which marks the code gone and leaves
a tombstone with no profile data. Thirty days lets RuneLite keep the rules
between play sessions without the tracker open. Anyone with the random pairing code can read the record
during its lifetime; the private token is required to replace it or mark it
gone. The app shows only the code's last four characters. The owner record
holds no profile data and no token, only the token's hash and a timestamp,
and expires 90 days after its last refresh. Use clipboard or local-file import
if relay data should not leave the machine.

With the plugin update, **Send to tracker** events leave RuneLite only when
the player presses it. They wait on the relay for at most 30 days, until the
tracker takes them; only someone holding the pairing code can add to them,
and only the tracker that holds the code's write token can read them.
Badges are off by default: **Share my badge** puts the character name and
milestone on a public list the relay serves to every Fate Locked plugin,
and turning it off removes them.

Separately from sync, when the tracker crashes it sends the relay a short
error report (the build id, the error message and stack trace, and the page
path without its query or `#` part), at most five per visit. It is built to
leave out save data, profile names, RSNs, pairing codes and tokens.

## RuneLite bundle v4

The app exports `version: 4` with a canonical `rules` manifest. It includes
the run, account, game mode, rules/content/detector versions, every unlock
family, bank-lock state, and category-first chunk permission snapshots.

The fields that builds already on the Plugin Hub read, and that the stream
overlay reads, are frozen: `contracts/golden-bundles/bundle-contract.json`
lists each with its JSON type, the ones a bundle is refused without, and
the ones parsed but never read. The export never drops a frozen field that
is read, never changes a field's type or meaning, and only adds fields. The
snapshots go out without the three unread ones (their `chunkKey`, `counts`
and each row's `key`); the app's own snapshots keep them.

`rules.unlocks.housing` and `rules.unlocks.storage` are exported too, but the
current plugin has no fields for them: it ignores them and does not warn on
player-owned house or storage unlocks yet. Like every manifest addition, they
are optional and leave `rulesVersion` unchanged.

Permission status is `ALLOWED`, `NOT_READY`, `LOCKED`, or `UNKNOWN`. `UNKNOWN`
means the app cannot safely decide and must never become a blocking warning.
RuneLite consumes these authored decisions without re-implementing quest,
skill, merchant, bank, or activity rules.

`rules.knownMobility` declares the mobility methods the app can evaluate,
while `rules.unlocks.mobility` is the unlocked subset. Typed fallback exports
retain that authority only when mobility state was explicitly supplied;
otherwise the known set is empty so Travel Guardian fails open instead of
inventing authority.

### Stage 2 sections

The app decides and RuneLite looks the answers up. These `rules` fields
carry the decisions RuneLite would otherwise work out itself:

| Field | What it holds |
|---|---|
| `chunkEntries` | One status for every land, ocean and interior chunk |
| `places` | What each chunk that isn't land is: ocean, or an interior with its name, area and entrances |
| `frontier` | Chunked runs only: the chunks the run may roll next, Sailing included |
| `banks` | Each bank's status and reason, its chunk, and the chunks its facilities are in |
| `freeAreas` | The areas the run's mode frees; the root `freeAreas` takes the same value |
| `progress` | The run card's progress, with the land chunks the run owns |
| `slayerTasks` | Each Slayer task per master and whatever the master, keyed like `slayerChunks` |
| `travel` | Each travel method by id, with each menu option's destinations and decision |

`travel` holds the table in `data/travelMethods.ts`, decided for the run
(`utils/travelDecisions.ts`). A method is matched by exactly one of a
spellbook and spell name, item ids, object ids or NPC ids; its `options`
are keyed by the menu option's exact text, and a fairy ring's `codes` by
its code. Each option lists the chunks it can go to (`to`) with a
`status` and, unless `ALLOWED`, a `reason`: `LOCKED` while an unlock the
method needs is locked, otherwise the destination's entry when there is
exactly one destination, and `UNKNOWN` when the player picks the place
after the click. Networks and boats are `advisory`: tagged, never
blocked. RuneLite blocks only an id match with one destination and a
`LOCKED` decision.

Each snapshot also carries its `kind` (land or ocean), its `area`, and an
`entryReason` whenever its entry isn't `ALLOWED`.

`rules.capabilities` names the sections a bundle has (`chunkDetails` for
the snapshot fields). A reader uses only the sections whose capability it
knows. A section's meaning never changes: a new meaning gets a new field
and a new capability, and statuses stay the four above. An export whose
chunk data didn't load sends only `freeAreas`, `progress` and, for a
Chunked run, `frontier`.

An export built while the app's free-area baseline belongs to another run
(a profile switch mid-build) is refused, and the switch's own publish
sends the new run.

The `FLGZ:` relay request for every golden run is tested against 240 KiB,
16 KiB under the relay's 256 KiB limit; the golden runs' requests are
193-197 KiB, of which the travel section is about 9 KiB (tested against
16 KiB). RuneLite continues to load v1-v3 bundles using legacy map
behavior; a malformed v4 or unsupported future version is rejected without
replacing the last valid snapshot.

## Worker deployment

The app defaults to `https://fate-relay.fatelocked.workers.dev`. A deployment
can override it with `VITE_FATE_RELAY`; local development (and the tests) can
set `fate_relay_base` in browser storage. Production builds ignore that key:
other pages on nubles.github.io share the storage, and every relay call
carries a write token (`resolveRelayBase` in `utils/relayBase.ts`). A copied stream overlay URL then names
that relay in a `relay=` parameter, and the overlay polls it only if it is an
https address, or http on localhost for local development.

From `workers/fate-relay/`, authenticate Wrangler, check the `RELAY` KV
namespace in `wrangler.toml`, and run `npx wrangler@latest deploy` (the rate
limit bindings need Wrangler 4.36 or later). `workers/fate-relay/DEPLOY-NOTES.md`
lists the steps for the current changes.

Worker secrets, all optional:

| Secret | What it does without it |
|---|---|
| `PROGRESS_BOT_SECRET` | Every `/l/` request is refused; see `docs/shared-progress.md`. |
| `DISCORD_EVENTS_URL` | The bot's unlock feed gets nothing; see `docs/shared-progress.md`. |
| `ERROR_WEBHOOK_URL` | Error reports are only logged; see [Error reports](#error-reports). |
