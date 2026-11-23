# Deploying the relay hardening

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
- `#live-unlocks` posts are limited per run (`feedForPublish` in
  `progress.js`): at most 10 posting publishes an hour, nothing when a publish
  gains more than 10 areas or chunks at once, and nothing dated more than 5
  minutes ahead. The publish still succeeds and the bot still gets the
  snapshot for roles. Until this deploy, the old relay posts every new unlock.

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

---

# Fewer KV writes (October 2026)

Two relay changes spare the free plan's 1,000 KV writes a day. Neither needs
a new binding, secret or `wrangler.toml` change; deploy with the next
`npx wrangler@latest deploy` from `workers/fate-relay/`. Until then the old
relay keeps working with the new tracker, and the tracker's own savings
(unchanged profiles not re-sent, longer waits between publishes and
backups) work without it.

- A shared-progress publish of the summary the relay already holds (after a
  reload, say) writes nothing and answers `{ updatedAt, unchanged: true }`;
  the bot hears nothing new. A summary unchanged for 30 days is stored
  again, so it doesn't expire.
- A RuneLite publish refreshes the code's owner record at most once a week
  instead of once a day (the record still lasts 90 days).

The hourly usage alert is a GitHub Actions workflow, not part of the relay:
it needs no deploy, only the `CLOUDFLARE_ANALYTICS_TOKEN` repository secret
(docs/online-relay.md, "Daily KV quota").

Checking it (writes nothing):

```sh
curl.exe -s -o NUL -w "%{http_code}\n" https://fate-relay.fatelocked.workers.dev/r/ABCD
# 400, as before
```

Rolling back: `npx wrangler@latest rollback`; records stay readable by both.

---

# Shared-progress ownership outlives its record (November 2026)

**This change needs a relay deploy** (`npx wrangler@latest deploy` from
`workers/fate-relay/`; no new binding, secret or `wrangler.toml` change).
Until it is deployed the relay keeps its earlier behaviour: there are no
owner records for shared progress yet.

- `own:p:<id>` owner records (180 days, refreshed at most weekly; Stop sharing
  refreshes it once) keep a run's id its owner's after Stop sharing or expiry.
  Existing runs gain one on their owner's next publish; nobody is locked out.
- A write that claims an id nobody holds removes the Discord link its
  `ld:<id>` names first, and links older than the claim are not served or
  notified. Links now carry `linkedAt` metadata; the bot's payload and every
  response the tracker and the bot already handle are unchanged.
- KV writes: an unchanged publish still writes nothing, a changed one still
  writes the summary, plus the owner record at most once a week per run.

The tracker side (a run refused its own id moves to a new id once, with a
message) works against both the old and the new relay.

Rolling back: `npx wrangler@latest rollback`. The old relay ignores owner
records and link metadata, so records stay readable by both.
