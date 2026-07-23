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

## Verification and maintenance commands

Use the command that matches the intended operation:

- `npm run content:verify` is the deterministic gate used by pull-request and
  deploy CI. It is fully offline and read-only: it validates committed quest,
  Achievement Diary, and Combat Achievement data, then checks that generated
  Diary files are byte-for-byte current without writing anything.
- `npm run content:check` is a network-backed freshness inspection. It may
  contact the OSRS Wiki and update `docs/SYNC_STATUS.md`, so it is kept out of
  required CI.
- `npm run content:sync`, `npm run diary:sync`, and `npm run ca:sync`
  are explicit maintenance writes. Run them only when updating reviewed source
  material, and review their generated changes in their own diff.

Generated data is never hand-edited. Update its committed source snapshot or
its generator, run the appropriate sync command, and review the resulting diff.

## What's automatic vs. what needs a human — and why

| Content | New item on existing source | Brand-new source/entry |
|---|---|---|
| **Collection log items** | ✅ **Auto, live** (runtime sync) + baked in by CI | ⚠️ Detected; page added by `clog:sync` once a tab is chosen |
| **Bosses** | ✅ new drops auto-add to the boss's log | ⚠️ **Detected** (new log page) → curate: model, drop-rate, key cost, gacha tier, `BOSSES_LIST` |
| **Quests** | — | ✅ **Detected** by `content:check` (wiki `{{Globals\|quests}}` count) → curate: skill reqs, prereqs, region, QP, difficulty tier |
| **Combat Achievements** | ✅ Offline render from the committed, reviewed snapshot via `ca:sync` | ✅ Network drift detection via `content:check` → explicitly fetch/review/update the snapshot, then run `ca:sync` |
| **Diaries** | — | ✅ Reviewed 492-row snapshot; regenerate with `diary:sync` |

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

## Detecting new quests / CAs (implemented)

Unlike the collection log, quests/CAs/diaries have **no clean machine-readable
wiki source** (no public Cargo API, and their on-wiki tables are generated). So
instead of a blind importer, `scripts/check-content-sync.mjs` (`npm run
content:check`, also part of `content:sync`) is a **detector**. It records the
wiki's own authoritative numbers next to the app's in **`docs/SYNC_STATUS.md`**:

- **Quests** — the wiki's `{{Globals|quests}}` / `quests p2p` / `quests f2p`
  count variables (rendered via the API). The app tracks *more* entries than the
  wiki's quest count because it also includes miniquests/sub-quests, so the
  signal to watch is a **change** in the wiki number.
- **Combat Achievements** — `ca:sync` renders the committed, reviewed snapshot
  without network access, keying each task by its stable in-game
  `data-ca-task-id` so re-runs are deterministic and preserve progress.
  `content:check` uses the network to detect upstream drift; it does not rewrite
  the snapshot. To refresh the data, fetch the official API data, review and
  update the snapshot, then run `npm run ca:sync`.
- **Diaries** — generated offline from the committed 492-row reviewed snapshot;
  source refreshes remain explicit review work because the wiki has no stable per-task ID.

Because the report is **deterministic** (no timestamps), git only shows a diff
when an upstream number actually moves — so the weekly workflow turns "a new
quest/CA shipped" into a reviewable PR (`docs/SYNC_STATUS.md` is in its
`add-paths`). A human then curates the real entry in `data/questData.ts` /
`data/caTasks.ts`.

> The detector originally surfaced that the app tracked only 223 of the wiki's
> then-current 637 combat achievements; a reviewed snapshot refresh followed by
> `ca:sync` backfilled the full set (now 646/646 in `SYNC_STATUS.md`). Adding another content type later follows the same pattern:
> a `sync-*` script (if fully wiki-defined) or a detector entry, joining the same
> weekly PR automatically.

## Achievement Diary snapshot

Achievement Diary tasks are generated from the committed, reviewed snapshot at
`data/sources/achievement-diary-tasks.json`. The snapshot was verified against
[Achievement Diary/All achievements](https://oldschool.runescape.wiki/w/Achievement_Diary/All_achievements)
revision `15263582` and the twelve linked official Diary pages recorded in the
snapshot. Their tier tables contain exactly 492 current tasks.

Regenerate the TypeScript task list and task-ID migration map offline:

```bash
npm run diary:sync
```

The command never contacts the network. It validates the frozen source metadata,
the 492-row total, unique IDs and ordinals, known tiers, alias targets, and an
independently derived 485-row classification before writing `data/diaryTasks.ts` and the
migration map in `utils/taskIdMigrations.ts`. The audit parses the canonical
project skill, quest, and region declarations, so the reported zero unknown
references cannot mask a bad snapshot row. It also compares the derived historical
IDs with `data/sources/achievement-diary-legacy-ids.json`, frozen from the exact
pre-refresh `data/diaryTasks.ts` at commit `fe4654f`.

ID rules:

- A current task with the same semantics keeps its existing application ID.
- A genuinely replaced task may use an explicit old-ID alias only when the source
  establishes that succession; lookalike tasks are not guessed.
- A task with no legitimate predecessor receives a frozen
  `<area-prefix>_<tier-prefix>_<official-ordinal>` ID that never reuses a retired ID.
- Retired and unknown historical completion IDs remain in saves but do not count
  toward the current 492-task total.

Current reviewed classification: 471 preserved semantic IDs, 0 source-supported
replacement aliases, 14 retired existing IDs, and 21 new canonical IDs. The net
increase is seven, but the refresh is not a seven-row append.


## Combat Achievement snapshot

Combat Achievement tasks are generated offline from
`data/sources/combat-achievement-tasks.json`. The reviewed baseline is pinned
to the official [Combat Achievements](https://oldschool.runescape.wiki/w/Combat_Achievements)
overview revision `15272408`, verified on 2026-07-23, plus the exact six tier
page revisions and official API queries recorded in the snapshot. The overview
still displayed 637 tasks, but its own live Globals and the tier tables had
already advanced to 646 after the Maggot King additions; the live API data takes
precedence over that stale summary.

Regenerate the TypeScript list without network access:

```bash
npm run ca:sync
```

The command validates the stable `ca_<official-id>` identity format, source
metadata, unique IDs, exact 646-row total, and the official tier distribution
(41 Easy, 60 Medium, 86 Hard, 164 Elite, 174 Master, 121 Grandmaster) before
writing `data/caTasks.ts`. It aborts before writing on any drift. The generated
module is never hand-edited. `content:check` uses the network to detect upstream
drift but never rewrites the snapshot. To refresh, fetch the official API data,
review and update the snapshot, then run `npm run ca:sync`.
