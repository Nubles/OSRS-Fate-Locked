# 3D entity models

Drop a model file here and it shows up automatically when that entity is
unlocked (in the unlock reveal and the Boss Planner) — **no code changes**.

## How it works

1. Name the file by the entity's **slug**: lowercase, with non-alphanumeric runs
   becoming `-`. Examples:
   - `Vorkath` → `vorkath.glb`
   - `King Black Dragon` → `king-black-dragon.glb`
   - `K'ril Tsutsaroth` → `kril-tsutsaroth.glb`
2. Drop the `.glb` (or `.gltf`) into this folder. Files in `/public` are served
   at the site root, so it's reachable at `/models/<slug>.glb`.
3. The manifest (`data/modelManifest.ts`) is regenerated automatically before
   `npm run dev` / `npm run build`. To refresh it by hand: `npm run models:manifest`.

That's it — any unlock whose slug has a file here renders in 3D, with its 2D
sprite as the instant poster + fallback. Names that don't slugify cleanly can be
mapped explicitly in `MODEL_REGISTRY` in `data/entityModels.ts`.

## Batch export from a cache (recommended)

`scripts/export-models.mjs` generates these files for you from a local OSRS cache
using the open-source [osrscachereader](https://github.com/Dezinater/osrscachereader):

```bash
npm install -D osrscachereader                 # cache reader (pulls `canvas`)
# get a cache (e.g. an OpenRS2 archive) — a folder with main_file_cache.*
npm run models:export -- --cache "C:/path/to/cache" --names
npm run models:manifest
```

It reads the entities in `scripts/models.config.json` (`names` are auto-resolved
by scanning the cache; `aliases` map raids/multi-boss names to a representative
NPC; `npcIds` pin an explicit id) and writes `<slug>.gltf` here.

## Or export one at a time

Use a cache viewer such as RuneMonk or RuneApps (both have a glTF export) and drop
the file in named by slug.

## Important — intellectual property

OSRS models are **Jagex's intellectual property**. This repo does **not** bundle
any game models; it only references files you place here. Whether to host such
exports is your decision — treat them as fan content (attribution, non-commercial)
and remove them on request. `placeholder.glb` is our own generated test cube, not
a game asset, and is ignored by the manifest.
