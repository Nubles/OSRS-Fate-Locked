# Keeping the app up to date with new OSRS content

> *"Can the app self-update — when a new quest / collection-log item / boss is
> released, does it add itself?"*

Short answer: **the collection log already self-updates live, and the rest is
kept current automatically through a reviewed weekly pull request.** Here's the
full picture and the reasoning behind it.

## The two layers

The app is a static site (React + Vite on GitHub Pages) whose game data lives in
typed files under `data/`. "Self-updating" is solved with two complementary
mechanisms:

### 1. Runtime self-update — live, zero action (Collection Log)

`services/CollectionLogSyncService.ts` runs in the browser the first time a
player opens the Collection Log. It fetches the wiki's **authoritative** source
— `Module:Collection_log/data.json`, the same data the wiki and the in-game log
use — diffs it against the bundled snapshot, and **appends any newly-tracked
items onto existing pages, in memory.** A drop Jagex adds and the wiki records
shows up with **no redeploy**.

It is deliberately constrained to stay safe:

| Property | Behaviour |
|---|---|
| **Additive only** | Only *appends* new items. Never renames or deletes — the reviewed build-time data owns those. |
| **Fail-safe** | Any network/parse error leaves the bundled data untouched; the app just shows the snapshot. |
| **Lazy + cached** | Fetched once on first open, cached in `localStorage` (works offline after), re-checked weekly. |
| **ID-stable** | New items get fresh synthetic IDs that don't collide; existing IDs (and player progress) are untouched. |

Brand-new **pages** (a new boss's whole log) are *detected* (`newSources`) but
**not** auto-added — see why below.

### 2. Automated repo sync — reviewed, then auto-deployed (everything)

`.github/workflows/sync-content.yml` runs weekly (and on demand). It re-runs the
wiki sync, runs the **full test suite** (including the cross-data invariants),
and opens a **pull request** with whatever the wiki changed. A maintainer
reviews and merges; the merge triggers the existing Deploy workflow and ships.

This is what bakes wiki changes into the committed bundle (so first-load is
correct and names get the wiki's polished forms), and it's where anything that
needs human curation surfaces as a reviewable diff instead of shipping blind.

Run it locally any time:

```bash
npm run clog:sync     # or: npm run content:sync
```

## What's automatic vs. what needs a human — and why

| Content | New item on existing source | Brand-new source/entry |
|---|---|---|
| **Collection log items** | ✅ **Auto, live** (runtime sync) + baked in by CI | ⚠️ Detected; page added by `clog:sync` once a tab is chosen |
| **Bosses** | ✅ new drops auto-add to the boss's log | ⚠️ **Detected** (new log page) → curate: model, drop-rate, key cost, gacha tier, `BOSSES_LIST` |
| **Quests** | — | ⚠️ Detected by diffing names → curate: skill reqs, prereqs, region, QP, difficulty tier |
| **Diaries / Combat Achievements** | — | ⚠️ Same pattern: detect → curate the per-task requirements |

The curation gate is **intentional**, not a limitation:

- **A boss is more than a name.** The app needs a 3D model, a drop-rate, a key
  cost and a gacha tier for it — none of which can be mechanically derived from
  the wiki. Auto-injecting a boss with no model/economy would be broken.
- **Cross-data invariants must hold.** e.g. *every* Collection-Log boss page must
  map to an unlockable boss (`data/consistency.test.ts`). Blind auto-add already
  *would have* shipped a contradiction (the novelty "Brutus" page) — the test
  caught it. The review gate is where that judgement lives.
- **The wiki can be mid-edit or vandalised.** A test-gated PR means a bad upstream
  edit can't silently reach players.

So: **fully hands-off where the data is self-describing (collection-log items),
and detected-then-reviewed where real game-design curation is required.**

## Extending the sync to quests / diaries / CAs

The collection log is the working template. To add another content type:

1. Add `scripts/sync-<type>.mjs` (mirror `scripts/sync-collection-log.mjs`):
   fetch the wiki's source, diff against the app's data, **append/rename
   preserving IDs**, and **report** anything new that needs curation.
2. Chain it into the `content:sync` script in `package.json`.
3. The weekly workflow then includes it in the same reviewed PR automatically.

Note on sources: the collection log has a clean JSON module
(`Module:Collection_log/data.json`). Quests/diaries/CAs don't expose an
equivalent (the wiki has no public Cargo API here), so a quest sync would diff
against the **category/list** pages and is best scoped as a *detector* that flags
new quest names for curation — not a blind importer of half-specified quests.
