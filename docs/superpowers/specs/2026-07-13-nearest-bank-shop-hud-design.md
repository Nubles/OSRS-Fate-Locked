# Nearest Unlocked Bank/Shop HUD Line — Design

**Date:** 2026-07-13
**Status:** Approved
**Repos:** implement in `Nubles/RS3-Fate-Locked-Runelite` (source of truth);
mirror byte-for-byte with CRLF endings into `runelite-plugin/` here.

## Goal

Answer the region-locked player's #1 practical question — "where CAN I bank
(or shop)?" — with two always-visible HUD lines, computed entirely from the
already-imported `FateLockedBundle` (roadmap §2.5: "all from
FateLockedBundle.contentAt, no network").

## Display

Two `LineComponent`s in `FateLockedHudOverlay`, rendered directly after the
Here/Status block, gated by a new `showNearest` config toggle (default on):

| State | Line | Color |
|---|---|---|
| Standing chunk has a usable bank | `Bank: here ✓` | green |
| Nearest usable bank elsewhere | `Bank: Draynor · 3 NE` | white (label), gray left |
| No usable bank anywhere | `Bank: none unlocked` | red |

Same three states for `Shop:`. Label = first segment of `labelAt(chunk)`
(sub-area name), truncated to fit the 165 px panel; falls back to
`(cx, cy)` for unauthored chunks. Distance = Chebyshev distance in chunks
(straight-line, not pathable — a hint, not a route). Direction = 8-way
compass point from the player's chunk to the target chunk.

Lines render only when the bundle has chunk-content data (v3+); v1/v2
bundles and the empty bundle show nothing new.

## Data & semantics

- **Bank chunks:** chunks whose `chunkContent` `poi` list has an entry
  containing `bank` (case-insensitive) — booths, chests and deposit boxes
  all count for an ironman.
- **Shop chunks:** chunks with a non-empty `shop` category.
- **Usable bank:** `lockStateAt(chunk) == UNLOCKED && isBankUnlocked(chunk)`
  (the second check covers bank-locked runs; it's a no-op otherwise).
- **Usable shop:** `lockStateAt(chunk) == UNLOCKED`.

## Components

### `FateLockedBundle` (extend)

- Two new fields built once in the constructor from `chunkContent`:
  `Set<CanonicalChunk> bankChunks`, `Set<CanonicalChunk> shopChunks`.
- New value class `Nearest` (`chunk`, `distanceChunks`) and query
  `Nearest nearestUsableBank(CanonicalChunk from)` /
  `Nearest nearestUsableShop(CanonicalChunk from)`:
  linear scan of the index (≈100–500 entries), filter on the usable
  predicate, minimize Chebyshev distance. Distance 0 = "here". Null when
  none qualify. Ties break toward smaller cx, then cy (deterministic).

### `FateLockedHudOverlay` (extend)

- Per-frame it reads a cached result from the plugin; formatting only.
- Static helper `compass(dcx, dcy)` → `"N" | "NE" | … | "NW"` (8-way,
  from the dominant axis with a 2:1 threshold — e.g. dx=+5, dy=+1 → "E",
  dx=+5, dy=+4 → "NE").

### `FateLockedPlugin` (extend)

- Cache: `CanonicalChunk lastNearestChunk` + the two `Nearest` results +
  the bundle instance they were computed against. Recompute in the overlay
  path only when the player's chunk differs or the bundle object changed
  (bundle reload swaps the instance). No new event subscriptions.

### `FateLockedConfig` (extend)

- `showNearest` boolean, default `true`, section/order adjacent to
  `showHud`: "Nearest unlocked bank & shop".

## Error handling

- Null local player / null bundle state: lines skipped (same pattern as the
  existing Here/Status block).
- Empty indexes (no chunk content): lines skipped entirely rather than
  showing a misleading "none unlocked".

## Testing

The plugin repo has no unit-test suite and no local Gradle — GitHub Actions
is the only compile check (roadmap §4). Therefore:

- Keep the new logic in small pure methods (`nearestUsableBank`,
  `compass`) reviewable by inspection.
- Push to a branch first if CI churn is a concern; otherwise small commits
  to main, watching the Actions tab after each push.
- Web-side mirror copy must be byte-identical with CRLF endings; no web
  tests are affected (no TS changes).

## Out of scope

- Pathable distance / route hints (BFS over unlocked chunks).
- Side-panel variant (the panel's current-chunk section already lists
  contents; this feature is specifically the at-a-glance HUD line).
- Plugin Hub release bump (roadmap §1 covers shipping).
