/**
 * 3D entity model registry (spike). Maps an unlock's name to a hosted model so
 * the unlock reveal can show a rotating 3D model instead of a flat sprite.
 *
 * IP: OSRS models are Jagex's intellectual property — we do NOT bundle them.
 * To wire up a real entity, export its model yourself (e.g. via RuneMonk /
 * RuneApps), drop the `.glb` into /public/models/<slug>.glb, and add its entry
 * below pointing at `/models/<slug>.glb`.
 *
 * Ships DORMANT: the registry is empty, so the app behaves exactly as before
 * (2D sprites) until you add models. No game assets are bundled.
 */

/** Our own trivial generated model (a gold cube) so the pipeline can be tested
 *  without any game asset. See scripts/gen-placeholder-glb.mjs. */
export const PLACEHOLDER_MODEL = '/models/placeholder.glb';

export const MODEL_REGISTRY: Record<string, string> = {
  // Add one line per entity once a real export is in /public/models, e.g.:
  //   Vorkath: '/models/vorkath.glb',
  // To preview the pipeline with the bundled placeholder cube, temporarily add:
  //   Vorkath: PLACEHOLDER_MODEL,
};

/** The model URL for an unlock name, or undefined to fall back to its sprite. */
export const modelFor = (name: string): string | undefined => MODEL_REGISTRY[name];
