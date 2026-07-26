# Fate Locked Ironman

A companion tracker for the **Fate Locked Ironman** challenge mode in Old School RuneScape — a "snowball" restriction run where your account starts with *everything* locked, and Fate decides what you unlock.

**Live app:** https://nubles.github.io/OSRS-Fate-Locked/

![Spending a Key: the gacha table rolls, Fate is altered, and the TzHaar Fight Cave is unlocked](docs/media/hero.gif)

## The concept

You begin as a fresh Ironman with nothing: no skills past level 1, no equipment slots, no map regions, no transport. To progress you:

1. **Farm Keys** — complete in-game tasks (Slayer tasks, Clue scrolls, quests, diaries, levels) and roll against their drop rate.
2. **Spend Keys** — cash Keys in on a content table (Skills, Equipment, Regions, Bosses, Minigames…) to unlock a random entry.
3. **Snowball** — each unlock opens up new tasks, which earn more Keys.

Bad luck is cushioned by **Fate Points** (a pity timer) and the **Void Altar**, where Fate Points can be spent on rituals. Rare **Omni-Keys** let you pick an unlock directly; **Chaos Keys** unlock from any table at random.

## Screenshots

| | |
|---|---|
| ![Farm Keys — Slayer master roll cards next to the Character dashboard](docs/media/farm-keys.png) | ![Spend Keys — unlock tables alongside the interactive world region map](docs/media/region-map.png) |
| *Farm Keys & the Character dashboard* | *Spend Keys & the world region map* |
| ![Spend Keys tables next to the Equipment Lab](docs/media/spend-keys.png) | ![The Journal — quest, diary and combat-achievement tracking](docs/media/journal.png) |
| *Unlock tables & the Equipment Lab* | *The Journal: quests, diaries & combat achievements* |

## Features

- **In-app Codex** — a full rulebook covering the Key Economy (every way to earn and spend keys, with a worked example), drop rates, game modes, the Void Altar, region bonuses, and equipment tiers. It renders from one typed source (`config/economy.ts`) that a consistency test pins to the engine's drop rates, so the rules you read always match the rules the game runs.
- **Farm Keys** — Slayer master & Clue scroll roll cards with animated rolls, plus pointers to skill/journal/collection-log rolling.
- **Spend Keys** — gacha-style unlock tables with reveal animations.
- **Progression Dashboard** — Character (equipment tiers, skills), World (interactive region map), Activities & Utility (bosses, minigames, guilds… with region tags), Journal (quests, diaries, combat achievements), and Collection Log.
- **Game Modes** — Vanilla, Casual, Hardcore, Region Rush, and a fully tunable Custom mode. The mode is chosen at the start of a run and locked in permanently.
- **Region modifiers** — in Region Rush, every continent you unlock grants a passive bonus.
- **Region map authoring** — paint custom region/chunk layouts, export/import as JSON.
- **Integrity & verification** — a tamper-evident hash chain over the run history, a deterministic run ID, invariant replay, and exportable verified bundles, so a completed run can be shared and checked.
- **Shareable run card & timelapse** — generate an image of your run, or play its history back as a narrated timelapse.
- **Profiles** — multiple independent runs in one browser.
- **RuneLite companion plugin** — marks locked content in-game, explains the current chunk, and can durably queue supported completions for the web Roll Inbox.
- **Explicit-player Roll Inbox** — exact RuneLite detections are checked against the app's canonical rules and shown by category. Nothing rolls on detection, render, retry, or restart; the player always presses **Roll**.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Vitest

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. All state is stored in the browser's `localStorage` — no backend, no API keys.

Fate Analytics can export a voluntary local aggregate for the
[key-economy evidence protocol](./docs/key-economy-evidence.md). Nothing is
uploaded automatically.

## Other scripts

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build
npm test          # run the test suite (Vitest)
npm run test:watch
```

## Deployment

The app deploys to **GitHub Pages** automatically via `.github/workflows/deploy.yml` on every push to `main` — it installs dependencies, runs the tests, builds, and publishes. The build's base path is derived from the repository name, so it works regardless of what the repo is called.

To enable it on a fresh fork: **Settings → Pages → Build and deployment → Source → "GitHub Actions"**.

## Maintainer docs

- [`docs/RESOURCE_ENGINE.md`](./docs/RESOURCE_ENGINE.md) — the Resource Engine: data shape, the supply-chain analyzer, the three wiki-sourced generator scripts (`scripts/buildCraftables.mjs`, `scripts/buildPotions.mjs`, `scripts/buildSourceEnrichment.ts`), the enrichment merge pattern, the integrity-test contract, and the workflow for adding curated items.

## RuneLite plugin and Roll Inbox

The companion [RuneLite plugin](https://github.com/Nubles/OSRS-Fate-Locked-Runelite) renders the tracker rules in-game, warns before locked actions, and—only when the player enables Online sync—queues supported completions for the app. The standalone repository is the source of truth at [`5cc1ffc4e4f684a99211f12342a69ceb6d16de30`](https://github.com/Nubles/OSRS-Fate-Locked-Runelite/commit/5cc1ffc4e4f684a99211f12342a69ceb6d16de30); `runelite-plugin/` is its CI-verified mirror, pinned by `runelite-plugin/SOURCE_COMMIT`.

RuneLite detects and retries delivery; the app validates the run, account, revision, detector, and canonical rate. The event waits in **Sync & Roll → Roll Inbox** until the player chooses **Roll**, **Not eligible**, Review, or Dismiss. There is no Roll button in RuneLite and no background path to the dice engine.

Online sync is a checkbox that defaults to off. Event/ack records expire after seven days; bundle and heartbeat records expire after 24 hours. See [the relay protocol](./docs/online-relay.md) for fields, endpoints, ownership, and privacy limits.

## Disclaimer

Old School RuneScape and its assets are © Jagex Ltd. This is an unofficial fan-made tool and is not affiliated with Jagex.
