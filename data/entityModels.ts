/**
 * Resolves an unlock's name to a 3D model so the unlock reveal (and the Boss
 * Planner) can show a rotating model instead of a flat sprite.
 *
 * Auto-resolution by convention: drop a file named `<slug>.glb` into
 * /public/models (e.g. king-black-dragon.glb) and it shows up on unlock with NO
 * code changes — the manifest (data/modelManifest.ts) is regenerated before
 * dev/build, and any unlock whose slug is present resolves automatically.
 *
 * IP: OSRS models are Jagex's intellectual property, used here as fan content
 * like the wiki images and game fonts the tracker already shows. The files in
 * /public/models are exported from the game cache by scripts/export-models.mjs
 * (picks in scripts/models.config.json and scripts/unlock-models.config.json).
 * Any unlock without a file keeps its 2D sprite.
 */

import { importWithRetry } from '../utils/lazyRetry';
import { SKILLS_LIST } from './items';

/**
 * The manifest (several hundred models) loads on demand, not at startup, so it
 * stays out of the eager bundle. Until it arrives, modelFor() answers undefined
 * and callers show their 2D picture; hooks/useModelFor re-renders them once it
 * is in. A failed load is forgotten so the next caller can try again.
 */
let modelFiles: Record<string, string> | null = null;
let manifestLoad: Promise<Record<string, string>> | null = null;

export const modelManifestLoaded = (): boolean => modelFiles !== null;

export const loadModelManifest = (): Promise<Record<string, string>> =>
  (manifestLoad ??= importWithRetry(() => import('./modelManifest')).then(
    (m) => (modelFiles = m.MODEL_FILES),
    (err) => { manifestLoad = null; throw err; },
  ));

/** Every manifest slug → file, empty until loadModelManifest() resolves. */
export const loadedModelFiles = (): Record<string, string> => modelFiles ?? {};

/**
 * Prefix a /public path with the app's base URL so it resolves under a project
 * subpath (e.g. GitHub Pages serves the app at /OSRS-Fate-Locked/). Without this
 * a hardcoded "/models/x.gltf" 404s on the live site and the model silently
 * falls back to its 2D sprite (which then doesn't rotate).
 */
const base = (import.meta.env.BASE_URL || '/');
const asset = (p: string) => `${base}${p.replace(/^\/+/, '')}`;

/** Our own trivial generated model (a gold cube) to test the pipeline. */
export const PLACEHOLDER_MODEL = asset('models/placeholder.glb');

/**
 * Optional explicit overrides — only needed when an entity's name doesn't
 * slugify to its file name, or to point at an external/placeholder URL.
 */
export const MODEL_REGISTRY: Record<string, string> = {
  // e.g.  'K\'ril Tsutsaroth': '/models/kril-tsutsaroth.glb',
};

/** name → file slug, matching how /public/models files are named. */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The model URL for an unlock name, or undefined to fall back to its sprite. */
export const modelFor = (name: string): string | undefined => {
  if (MODEL_REGISTRY[name]) return MODEL_REGISTRY[name];
  const file = modelFiles?.[slugify(name)];
  return file ? asset(`models/${file}`) : undefined;
};

/** Model URL for a manifest slug directly (used by the review gallery). */
export const modelUrlBySlug = (slug: string): string | undefined => {
  const file = modelFiles?.[slug];
  return file ? asset(`models/${file}`) : undefined;
};

/**
 * Per-model render rotation ("roll pitch yaw"), keyed by slug. A few OSRS NPC
 * models are authored standing on end (their long axis is the vertical Y), so
 * they render nose-up. <model-viewer>'s `orientation` re-poses them at view time
 * — non-destructive, the exported .gltf is untouched. Pitch -90° lays the long
 * axis flat. Tune here if one still looks off (try +90deg, or a yaw, to taste).
 */
export const MODEL_ORIENTATION: Record<string, string> = {
  // (no NPCs active — Galvek/Leviathan reverted; their raw export pose is kept)
};

/**
 * Skills unlock as their skillcape, exported as worn, so the camera starts on
 * the plain side facing the wearer. The skill's emblem is on the back, so turn
 * each cape round (yaw 180°) to show the emblem first.
 */
export const SKILLCAPE_SLUGS: readonly string[] = SKILLS_LIST.map(slugify);
const EMBLEM_TO_CAMERA = '0deg 0deg 180deg';
for (const slug of SKILLCAPE_SLUGS) MODEL_ORIENTATION[slug] ??= EMBLEM_TO_CAMERA;

/**
 * A skillcape held still on its emblem in the unlock reveal: spinning it hid
 * the emblem for most of the turn. The player can still drag it round.
 */
export const isSkillcape = (name: string): boolean => SKILLCAPE_SLUGS.includes(slugify(name));

/** Render orientation for an unlock name, or undefined (no rotation). */
export const orientationFor = (name: string): string | undefined =>
  MODEL_ORIENTATION[slugify(name)];

/** Render orientation for a manifest slug directly (used by the review gallery). */
export const orientationForSlug = (slug: string): string | undefined =>
  MODEL_ORIENTATION[slug];
