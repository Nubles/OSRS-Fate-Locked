# Online sync relay (optional)

Lets the web app push your run to the RuneLite plugin **over the internet** —
no clipboard, no files, works across machines. Both sides only make **outbound**
HTTPS calls to a tiny Cloudflare Worker keyed by a short **pairing code**, so the
plugin stays Plugin-Hub-compliant (it never runs a server). Entries auto-expire
after 24h.

## Deploy the Worker (one-time)

From `workers/fate-relay/`:

1. `npm i -g wrangler` (if needed), then `wrangler login`.
2. Create the KV store: `wrangler kv namespace create RELAY` → copy the `id`
   into `wrangler.toml`.
3. `wrangler deploy` → you get a URL like
   `https://fate-relay.<you>.workers.dev`.

## Point the app at it

The web app defaults to `https://fate-relay.alexanderhaynes18.workers.dev`.
Override per-deploy with `VITE_FATE_RELAY=https://fate-relay.<you>.workers.dev`,
or at runtime via `localStorage.setItem('fate_relay_base', '<url>')`.

## How it works

- Web app: **Online sync** → generates a pairing code (+ a private write-token
  kept only in your browser) and auto-POSTs your bundle on every change.
- Plugin: paste the **code** into *Online sync code*; it polls the relay every
  few seconds and imports on change. The code only grants **reads** — without
  the write-token nobody else can overwrite your slot.

## API

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/r/:code` | `{ token?, payload }` | Write. First write claims the code's token; later writes must match it. |
| `GET` | `/r/:code` | — | Read `{ version, payload }`; `304` with `If-None-Match: <version>`. |
| `POST`/`GET` | `/r/:code/state` | — | Optional reverse channel (live game state). |

`payload` is the `FLGZ:`-prefixed gzip+base64 bundle (same compact form the
clipboard copy uses). Max 256 KB; TTL 24h.

## Privacy

Payloads contain your chunk unlocks + run state — **no account credentials**.
Data is ephemeral (24h) and reachable only with the random pairing code. Use the
clipboard/file paths instead if you'd rather nothing leave your machine.
