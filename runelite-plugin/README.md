# Fate Locked Ironman — RuneLite Plugin

Companion plugin for the [Fate Locked Ironman tracker](../). Renders the chunks
you've authored in the web app's region map directly onto RuneLite's world map
and main game view, and warns you when you step into a region you haven't
unlocked yet.

## What it does

- **World map overlay.** Every authored chunk shows on the full RuneLite world
  map, tinted green (unlocked), red (authored but not yet unlocked), or grey
  (unauthored empty space).
- **Scene overlay.** The 64×64 chunk you're currently standing in is outlined
  on the main game view with the same color coding.
- **Minimap overlay.** The current chunk is also tinted on the minimap.
- **Side panel.** A toolbar panel shows live run stats (profile, run ID,
  authored region/chunk counts, unlocked count), your current chunk + region +
  status, and a paste-box to load a bundle without editing the config path.
- **Chat on chunk entry.** Every time you cross a chunk boundary the plugin
  prints a one-liner in chat: current chunk coord, owning region, and status.
- **Locked-chunk warning.** Entering a region you haven't unlocked plays an
  audio cue (death squelch, 2277) and flags the chat message red.
- **Hot reload.** If the bundle file changes on disk, the plugin re-reads it
  without a restart — useful while authoring regions.

## Two ways to load a bundle

1. **Config file path** — paste an absolute path; the file is watched and
   hot-reloaded on change.
2. **Side panel paste-box** — paste the bundle JSON directly and click
   *Import pasted JSON*. Good for a quick one-off without saving a file.

## Install (sideload for development)

1. `cd runelite-plugin`
2. `./gradlew shadowJar`
3. Copy `build/libs/fatelocked-0.1.0-all.jar` into `~/.runelite/sideloaded-plugins/`
   (create the directory if it doesn't exist).
4. Launch RuneLite. The plugin appears in the plugin panel as **Fate Locked
   Ironman**.

## Setup

1. In the Fate Locked web app, click the **RL** button in the Region Authoring
   toolbar. It downloads a `fate-locked-bundle-YYYY-MM-DD.json` file.
2. In the RuneLite plugin config, paste the absolute path to that file into
   **Bundle file path**.
3. Overlay should render immediately. Re-export and save over the file any time
   you unlock a new region; the plugin hot-reloads.

## Bundle format

```json
{
  "version": 1,
  "runId": "run-389c62bb",
  "profileName": "Main Account",
  "chunkOffset": { "cx": 1, "cy": 7 },
  "chunks": {
    "Lumbridge": [{ "cx": 51, "cy": 57 }]
  },
  "unlockedRegions": ["Lumbridge"]
}
```

Chunks in `chunks` are stored in the web app's shifted coordinate space. The
plugin subtracts `chunkOffset` on load to return to canonical OSRS chunks —
the same space `WorldPoint.getX() >> 6` gives you.

## Coordinate transform

The web app's map image uses tile coords offset by **(+64 X, +448 Y)** from
canonical OSRS runescript — i.e. **+1 chunk east, +7 chunks north**. The
`chunkOffset` field in the bundle encodes that so the plugin never guesses.

If you recalibrate the web app's `MAP_BOUNDS` and the offset changes, the
next bundle export carries the new offset and the plugin Just Works.

## Limits

- The plugin cannot actually stop you walking into a locked chunk. Movement is
  server-authoritative; all we can do is mark and warn.
- Rendering on the world map uses the currently-public `RenderOverview` API.
  If RuneLite changes that API, the overlay's pixel math may need a touch-up.
- Plugin-hub submission requires removing any external network calls. This
  plugin deliberately has none — everything is local JSON.

## Future work

- Auto-log rolls from in-game item drops into the tracker's history.
- Emit a hash-chained audit log of chunk transitions + events so the web app's
  integrity layer can be verified against actual gameplay.
