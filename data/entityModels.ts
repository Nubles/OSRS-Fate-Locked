/**
 * Resolves an unlock's name to a 3D model so the unlock reveal (and the Boss
 * Planner) can show a rotating model instead of a flat sprite.
 *
 * Auto-resolution by convention: drop a file named `<slug>.glb` into
 * /public/models (e.g. king-black-dragon.glb) and it shows up on unlock with NO
 * code changes — the manifest (data/modelManifest.ts) is regenerated before
 * dev/build, and any unlock whose slug is present resolves automatically.
 *
 * IP: OSRS models are Jagex's intellectual property — this repo does NOT bundle
 * them. You supply your own exports (e.g. via RuneMonk / RuneApps) as fan
 * content; nothing here ships a game asset. Ships DORMANT (no model files →
 * everything falls back to the existing 2D sprites).
 */
import { MODEL_FILES } from './modelManifest';

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
  const file = MODEL_FILES[slugify(name)];
  return file ? asset(`models/${file}`) : undefined;
};

/** Model URL for a manifest slug directly (used by the review gallery). */
export const modelUrlBySlug = (slug: string): string | undefined => {
  const file = MODEL_FILES[slug];
  return file ? asset(`models/${file}`) : undefined;
};
