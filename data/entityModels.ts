/**
 * 3D entity model registry (spike). Maps an unlock's name to a hosted model so
 * the unlock reveal can show a rotating 3D model instead of a flat sprite.
 *
 * IP: OSRS models are Jagex's intellectual property — we do NOT bundle them.
 * To wire up a real entity, export its model yourself (e.g. via RuneMonk /
 * RuneApps), drop the `.glb` into /public/models/<slug>.glb, and point its entry
 * at `/models/<slug>.glb`. The single entry below uses a royalty-free PLACEHOLDER
 * model (Google's <model-viewer> sample asset) purely to demonstrate the
 * pipeline end-to-end; replace or remove it.
 */

/** Our own trivial generated model (a gold cube) so the pipeline is visible
 *  without any game asset. See scripts/gen-placeholder-glb.mjs. */
export const PLACEHOLDER_MODEL = '/models/placeholder.glb';

export const MODEL_REGISTRY: Record<string, string> = {
  // DEMO ONLY — placeholder model. Replace with '/models/vorkath.glb' once you
  // drop a real export into /public/models, or delete this entry.
  Vorkath: PLACEHOLDER_MODEL,
};

/** The model URL for an unlock name, or undefined to fall back to its sprite. */
export const modelFor = (name: string): string | undefined => MODEL_REGISTRY[name];
