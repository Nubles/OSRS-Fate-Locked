# Fate Locked Ironman

A companion tracker for the **Fate Locked Ironman** challenge mode in Old School RuneScape — a "snowball" restriction run where your account starts with *everything* locked, and Fate decides what you unlock.

**Live app:** https://nubles.github.io/OSRS-Fate-Locked/

## The concept

You begin as a fresh Ironman with nothing: no skills past level 1, no equipment slots, no map regions, no transport. To progress you:

1. **Farm Keys** — complete in-game tasks (Slayer tasks, Clue scrolls, quests, diaries, levels) and roll against their drop rate.
2. **Spend Keys** — cash Keys in on a content table (Skills, Equipment, Regions, Bosses, Minigames…) to unlock a random entry.
3. **Snowball** — each unlock opens up new tasks, which earn more Keys.

Bad luck is cushioned by **Fate Points** (a pity timer) and the **Void Altar**, where Fate Points can be spent on rituals. Rare **Omni-Keys** let you pick an unlock directly; **Chaos Keys** unlock from any table at random.

## Features

- **Farm Keys** — Slayer master & Clue scroll roll cards with animated rolls, plus pointers to skill/journal/collection-log rolling.
- **Spend Keys** — gacha-style unlock tables with reveal animations.
- **Progression Dashboard** — Character (equipment tiers, skills), World (interactive region map), Activities & Utility (bosses, minigames, guilds… with region tags), Journal (quests, diaries, combat achievements), and Collection Log.
- **Game Modes** — Vanilla, Casual, Hardcore, Region Rush, and a fully tunable Custom mode. The mode is chosen at the start of a run and locked in permanently.
- **Region modifiers** — in Region Rush, every continent you unlock grants a passive bonus.
- **Region map authoring** — paint custom region/chunk layouts, export/import as JSON.
- **Integrity & verification** — a tamper-evident hash chain over the run history, a deterministic run ID, invariant replay, and exportable verified bundles, so a completed run can be shared and checked.
- **Shareable run card & timelapse** — generate an image of your run, or play its history back as a narrated timelapse.
- **Profiles** — multiple independent runs in one browser.
- **RuneLite companion plugin** — see [`runelite-plugin/`](./runelite-plugin) for an in-game overlay of your authored chunks.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Vitest

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. All state is stored in the browser's `localStorage` — no backend, no API keys.

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

## RuneLite plugin

`runelite-plugin/` contains a Java RuneLite plugin that renders your authored Fate Locked chunks on the in-game world map and minimap, and warns when you enter a locked region. Build it with `./gradlew shadowJar` and sideload the JAR — see [`runelite-plugin/README.md`](./runelite-plugin/README.md).

## Disclaimer

Old School RuneScape and its assets are © Jagex Ltd. This is an unofficial fan-made tool and is not affiliated with Jagex.
