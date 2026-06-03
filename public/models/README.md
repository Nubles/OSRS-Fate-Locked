# 3D entity models

Drop exported model files here as `.glb` (preferred) or `.gltf`, named by a slug,
e.g. `vorkath.glb`. Files in `/public` are served at the site root, so this file
is reachable at `/models/vorkath.glb`.

Then register it in `data/entityModels.ts`:

```ts
export const MODEL_REGISTRY: Record<string, string> = {
  Vorkath: '/models/vorkath.glb',
};
```

The unlock reveal (and any other `<EntityModel>` placement) will then show the
rotating 3D model, with the item's 2D sprite as an instant poster + fallback.

## Where to get models

Export them yourself from a cache viewer such as RuneMonk or RuneApps (both have
a GLTF export). Convert `.gltf` → `.glb` if needed.

## Important — intellectual property

OSRS models are **Jagex's intellectual property**. This repo does **not** bundle
any game models; it only references files you place here. Whether to host such
exports is your decision — treat them as fan content (attribution, non-commercial)
and remove them on request. The committed registry entry points at a royalty-free
placeholder model, not a game asset.
