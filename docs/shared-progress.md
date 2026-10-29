# Shared progress for the Fate Locked Discord

A player can choose to show a summary of their run in the Fate Locked Discord.
The bot's `/progress` command then shows their mode, area or chunk count,
quests, diary tasks, Combat Achievements and last few unlocks.

It is off until the player turns it on, in **Discord notifications → Fate
Locked Discord**. The save, history, sync code and backup never leave the
browser: only the summary in `utils/progressSnapshot.ts` is sent.

## Linking

1. The player presses **Share and get a link code**. The browser makes a
   random id and write token for the run (kept in per-profile localStorage,
   outside GameState), publishes the summary, and asks the relay for a
   one-time code.
2. The player types `/link <code>` in the Discord within ten minutes. The bot
   hands the code to the relay, which records that Discord user's link to the
   run and forgets the code.
3. `ProgressShareDriver` republishes when progress changes: changes settle
   for a minute and publishes are at least 3 minutes apart, since each is a
   KV write; a run of unlocks goes out, and into the feed, together. An
   unchanged summary is not sent again, and the relay doesn't store one it
   already holds (after a reload): it answers `{ updatedAt, unchanged: true }`
   with no KV write and nothing for the bot, unless the stored summary is
   30 days old, so a shared run doesn't expire.

## Unlock feed and roles

When a linked run publishes, the relay tells the bot: it POSTs
`{discordId, snapshot, newUnlocks, updatedAt}` to `DISCORD_EVENTS_URL` with
the `PROGRESS_BOT_SECRET` as a Bearer token, after answering the browser.
`newUnlocks` are the `recent` entries newer than the previous summary's, so
the first publish after sharing starts never posts a backlog. The bot posts
them in `#live-unlocks` and keeps the player's mode and milestone roles in
step with the run. To find the Discord user, the relay keeps `ld:<run id>`
beside each `l:<discordId>` link; links made before it existed gain it the
next time the bot reads them. With `DISCORD_EVENTS_URL` unset, nothing is
sent.

**Stop sharing** deletes the summary from the relay. The Discord link stays
until the player runs `/unlink`; meanwhile `/progress` says the run isn't
shared. An unrefreshed summary expires after 90 days.

## Adventurer's Log

In the same window, **Adventurer's Log → Public** makes the run's summary a
public page at `#/log/<run id>` (`components/AdventurersLog.tsx`). Turning it
on turns sharing on too, and publishes straight away. A public summary adds
`public: true` and `map`: the land chunks the run owns, one bit per cell of
the tracker's 48 x 34 chunk grid (`utils/chunkMapBits.ts`), row by row from
the north-west corner, low bit first, in base64. Anyone with the link can read
it through `GET /p/<id>`; a private summary and a missing one both answer
`404`, so a private run can't be found by guessing. Turning it off republishes
without the flag, and **Stop sharing** deletes the summary, page and all.

## Clan feed

The OSRS layout's chatbox has a **Clan** tab (Settings → Clan broadcasts, on
by default) showing the newest posts in `#live-unlocks`. The tracker asks the
relay's `GET /clan`; the relay asks the bot's `/api/clan-feed` on the origin
of `DISCORD_EVENTS_URL`, with the bot's secret, and passes on only each post's
shown name, mode, unlocks and time (`workers/fate-relay/clan.js`). The bot
reads the posts back from the channel, so nothing is stored anywhere new and
no KV write is made. The names are the ones the feed already shows in the
Discord.

## Relay API

```text
Browser POST   /p/<id>            publish the summary (Bearer write token; 8 KiB; once a minute)
Browser DELETE /p/<id>            delete it (Bearer write token)
Anyone  GET    /p/<id>            a public Adventurer's Log: {snapshot, updatedAt}, else 404
Anyone  GET    /clan              the clan feed: {entries: [{name, mode?, items, more?, at}]}
Browser POST   /p/<id>/link-code  a one-time code, valid ten minutes (needs a published summary)
Bot     POST   /l/<discordId>     {code}: link that Discord user to the code's run
Bot     GET    /l/<discordId>     {linked, snapshot, updatedAt}, or 404 {linked:false}
Bot     DELETE /l/<discordId>     forget the link
```

The first publish claims an id; the relay keeps only a SHA-256 hash of its
write token. A run id that isn't 16 bytes in base64url, or a Discord id that
isn't a snowflake, is answered `400` before the relay looks anything up. The
browser's publishes, deletes and link codes count toward the relay's per-IP
write limit, and a new run or link code toward its claim limit; the bot's
`/l/` requests are not limited (see "Abuse limits" in
[online-relay.md](online-relay.md)). The two public reads may be cached for a minute
(`Cache-Control: public, max-age=60`, and `caches.default` on a custom domain; on workers.dev the
edge cache does nothing, so `/clan` also keeps its last answer in the Worker's memory for a minute). Apart from a public Adventurer's Log, summaries are served only to the bot,
which authenticates with the `PROGRESS_BOT_SECRET` Worker secret (the bot holds
the same value as `FATE_RELAY_BOT_SECRET`). With the secret unset, every `/l/`
request is refused. The relay keeps only the fields that
`workers/fate-relay/progress.js::validProgressSnapshot` accepts, so a field
added to the summary must be added there too; `utils/progressSnapshot.test.ts`
checks that the relay accepts what the app builds.

## Setup

```sh
cd workers/fate-relay
wrangler secret put PROGRESS_BOT_SECRET   # 32+ random characters
wrangler secret put DISCORD_EVENTS_URL    # https://<bot origin>/api/progress-events
wrangler deploy
```

Then set `FATE_RELAY_URL` and `FATE_RELAY_BOT_SECRET` on the Discord bot's
Vercel project and register its commands.

Summaries are self-reported, like everything else in the browser. They show
progress; Verified Runner remains the only mark that a run was checked.
