# Nearest Unlocked Bank/Shop HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two HUD lines pointing at the closest usable bank and shop, computed from the imported bundle (spec: `docs/superpowers/specs/2026-07-13-nearest-bank-shop-hud-design.md`).

**Architecture:** Index bank/shop chunks once at bundle parse; linear-scan nearest query filtered on lock state; overlay caches the result per player-chunk and formats it. No wire-format change, no network, no new events.

**Tech Stack:** Java 11 (RuneLite plugin), Lombok, no local build — GitHub Actions is the compile check.

## Global Constraints

- Source of truth: `Nubles/RS3-Fate-Locked-Runelite` clone at `scratchpad/plugin`. After pushing there and CI passing, copy changed files into the web repo's `runelite-plugin/` converting LF→CRLF, commit both.
- No unit-test framework in the plugin repo; keep logic in small pure methods and verify by CI compile + code inspection.
- RuneLite API imports must be verified against existing imports in the file being edited (roadmap gotcha) — this change introduces no new RuneLite types.

### Task 1: Bundle indexes + nearest query (`FateLockedBundle.java`)

- Fields `Set<CanonicalChunk> bankChunks` / `shopChunks`, built in the constructor from `chunkContent` (poi entry containing "bank" case-insensitively; non-empty `shop` list), using the existing `parseChunkKey`.
- `@Value public static class Nearest { CanonicalChunk chunk; int distanceChunks; }` (add `import lombok.Value;`).
- `nearestUsableBank(from)` / `nearestUsableShop(from)` → shared private `nearest(from, candidates, requireBankUnlock)`: skip non-UNLOCKED chunks (and `!isBankUnlocked` for banks), minimize Chebyshev distance, ties toward smaller cx then cy, null when none.
- `hasNearestData()` → either index non-empty.

### Task 2: Config toggle (`FateLockedConfig.java`)

- `showNearest` boolean, default true, `warningsSection`, name "HUD: nearest bank & shop".

### Task 3: HUD lines (`FateLockedHudOverlay.java`)

- Overlay-local cache `{cachedBundle, cachedChunk, cachedBank, cachedShop}` recomputed when the bundle instance or player chunk changes.
- After the Here/Status block (inside the `wp != null` branch), when `config.showNearest() && bundle.hasNearestData()`: two lines via `addNearestLine(...)` — `here ✓` green at distance 0, `<Area> · <dist> <dir>` white otherwise, `none unlocked` red when null.
- Static `compass(dx, dy)`: 8-way, 2:1 dominance collapses to a cardinal.

### Task 4: Push, CI, mirror

- Commit + push plugin repo; watch the Actions run to green (only compile check).
- Copy the three files into `runelite-plugin/src/...` in the web repo with CRLF endings; commit + push web repo.
