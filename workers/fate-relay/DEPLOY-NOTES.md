# Deploying Send to tracker and badges (October 2026)

This deploy adds the relay routes for RuneLite's **Send to tracker** button
and for Fate Locked badges. Nothing else changes, and there is nothing new to
set up: no new bindings, secrets or `wrangler.toml` changes. The web tracker
and the plugin both work with the old relay too (they fall back quietly), so
deploy whenever convenient.

## What to run

From `workers/fate-relay/`, logged in to Wrangler as the account that owns
`fate-relay`:

```sh
npx wrangler@latest deploy
```

## What changes

- `POST /r/<code>/inbox`: RuneLite's Send to tracker leaves what it noticed
  waiting for the tracker (newest 250 events, 30 days at most).
- `GET /r/<code>/inbox` and `POST /r/<code>/inbox/ack`: the tracker takes
  them into its Roll Inbox with its own pairing token, then empties them.
  Nothing rolls by itself; the player still chooses Roll.
- `POST` and `DELETE /r/<code>/badge`: the plugin's opt-in badge (character
  name and milestone).
- `GET /badges`: the public badge list. Every badge lives in one KV record,
  `badges`; the list is that record's contents, rebuilt at most every 10
  minutes.
- Free-plan cost: one KV write per Send to tracker and per take, and at most
  about one per sharing player a day for badges. No KV list operations at
  all: the badge list is one KV read, cached.
- Nothing to migrate: none of this was deployed before, so the relay
  starts with no waiting events and an empty badge list.

## Checking it

On Windows type `curl.exe`; on macOS or Linux, `curl`. Each check writes
nothing (the last removes a badge nobody has, which changes nothing).

```sh
curl.exe -s https://fate-relay.fatelocked.workers.dev/badges
# {"badges":[]}         (the old relay says: not found)
curl.exe -s https://fate-relay.fatelocked.workers.dev/r/00000000000000000000000000000000/inbox
# forbidden             (the old relay says: not found)
curl.exe -s -X DELETE https://fate-relay.fatelocked.workers.dev/r/00000000000000000000000000000000/badge
# {"deleted":true}      (the old relay says: not found)
```

Then, with the updated plugin, press **Send to tracker** in RuneLite's Roll
inbox card. Within a minute the tracker's Roll Inbox shows the events and
says "Added 1 from RuneLite." (switching to the tracker's tab fetches at
once).

## Rolling back

`npx wrangler@latest rollback` restores the previous version. The new
routes then answer `404 not found` again: the plugin keeps Copy for tracker
and shows no badges, and the tracker stops asking until the page is
reloaded. Waiting events and badges stay in KV until they expire (30 days)
and the old relay ignores them.

---

# Earlier: deploying the relay hardening

The web app already works with both the old and the new relay, so deploy
whenever convenient. Until you do, the old relay keeps running unchanged.

## What to run

From `workers/fate-relay/`, logged in to Wrangler as the account that owns
`fate-relay`:

```sh
npx wrangler@latest deploy
```

Wrangler must be 4.36 or later for the `[[ratelimits]]` bindings in
`wrangler.toml`; `@latest` makes sure. The deploy should list `env.RELAY`
and three Rate Limit bindings (`RELAY_WRITE_LIMITER` 30 requests/60s,
`RELAY_CLAIM_LIMITER` 4 requests/60s, `RELAY_ERROR_LIMITER` 10
requests/60s). If Wrangler says a `namespace_id` (7301, 7302, 7303) is
already used in the account, change it to any unused number and deploy again.

Optional, to have the web app's error reports posted to a Discord channel
(create a webhook in that channel's settings, under Integrations):

```sh
npx wrangler@latest secret put ERROR_WEBHOOK_URL
# paste https://discord.com/api/webhooks/<id>/<token>
```

Without it, error reports are only logged (`npx wrangler@latest tail`).
`PROGRESS_BOT_SECRET` and `DISCORD_EVENTS_URL` stay as they are.

## What changes for players

- RuneLite keeps a player's rules for 30 days after the tracker last sent
  them, instead of 24 hours.
- An online backup also keeps the previous copy, once a day, when the same
  browser backs up again.
- Malformed requests get `400`, too many writes from one address in a
  minute get `429`; real clients never send either.
- `/r/<code>/state`, `/events`, `/acks` and `/suggest` are gone (`404`).
  No released plugin build uses them.

## Checking it

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://fate-relay.fatelocked.workers.dev/r/ABCD
# 400 (was 404)
```

Then pair RuneLite with the tracker as usual and check the status card says
the rules are up to date.

## Rolling back

`npx wrangler@latest rollback` restores the previous version. Records written
by the new version stay readable by the old one.
