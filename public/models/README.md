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

## Where to get models

Export them yourself from a cache viewer such as RuneMonk or RuneApps (both have
a GLTF export). Convert `.gltf` → `.glb` if needed.

## Important — intellectual property

OSRS models are **Jagex's intellectual property**. This repo does **not** bundle
any game models; it only references files you place here. Whether to host such
exports is your decision — treat them as fan content (attribution, non-commercial)
and remove them on request. `placeholder.glb` is our own generated test cube, not
a game asset, and is ignored by the manifest.
