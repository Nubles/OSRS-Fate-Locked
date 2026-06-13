import { QUERY_TOOLS } from './query';
import { NAV_TOOLS } from './nav';
import type { Tool, AssistantAction } from '../types';

/** Every tool the assistant can call. */
export const ALL_TOOLS: Tool[] = [...QUERY_TOOLS, ...NAV_TOOLS];

export const toolByName = (name: string): Tool | undefined =>
  ALL_TOOLS.find(t => t.name === name);

// One dispatch of the navigation event.
const fire = (a: AssistantAction): void => {
  switch (a.kind) {
    case 'map': {
      // showChunkOnMap switches to the World tab, parks the chunk, + spotlights it.
      const { cx, cy } = a.payload as { cx: number; cy: number };
      import('../../utils/chunkLocations').then(m => m.showChunkOnMap(cx, cy));
      break;
    }
    case 'tab':
    case 'modal':
      window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: a.payload.target } }));
      break;
    case 'journal':
      window.dispatchEvent(new CustomEvent('navigate-journal', { detail: { tab: a.payload.tab } }));
      break;
  }
};

/**
 * Fire an action through the app's existing public event API.
 *
 * Why the repeated dispatch + resize: the action button lives in a portal, and
 * the destination tab (e.g. the map) mounts a beat after the tab switch. A
 * single fire could land before the target is listening/measured, leaving it
 * blank until a manual click. Re-firing the (idempotent) navigation a few times
 * over ~1s — and nudging a resize so size-measuring components re-measure —
 * makes a later fire always catch the mounted destination. Switching to a tab
 * that's already active, or re-centring the map, are both no-ops, so this is safe.
 */
export const runAction = (a: AssistantAction): void => {
  [0, 250, 700].forEach(ms => setTimeout(() => fire(a), ms));
  [120, 400, 900, 1500].forEach(ms =>
    setTimeout(() => window.dispatchEvent(new Event('resize')), ms));
};
