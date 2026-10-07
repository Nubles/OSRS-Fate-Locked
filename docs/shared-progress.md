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
   for 30 seconds and publishes are at least a minute apart, since each is a
   KV write. An unchanged summary is not sent again.

**Stop sharing** deletes the summary from the relay. The Discord link stays
until the player runs `/unlink`; meanwhile `/progress` says the run isn't
shared. An unrefreshed summary expires after 90 days.

## Relay API

```text
Browser POST   /p/<id>            publish the summary (Bearer write token; 8 KiB; once a minute)
Browser DELETE /p/<id>            delete it (Bearer write token)
Browser POST   /p/<id>/link-code  a one-time code, valid ten minutes (needs a published summary)
Bot     POST   /l/<discordId>     {code}: link that Discord user to the code's run
Bot     GET    /l/<discordId>     {linked, snapshot, updatedAt}, or 404 {linked:false}
Bot     DELETE /l/<discordId>     forget the link
```

The first publish claims an id; the relay keeps only a SHA-256 hash of its
write token. There is no public read: summaries are served only to the bot,
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
wrangler deploy
```

Then set `FATE_RELAY_URL` and `FATE_RELAY_BOT_SECRET` on the Discord bot's
Vercel project and register its commands.

Summaries are self-reported, like everything else in the browser. They show
progress; Verified Runner remains the only mark that a run was checked.
