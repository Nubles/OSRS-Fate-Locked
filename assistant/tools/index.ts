import { QUERY_TOOLS } from './query';
import { NAV_TOOLS } from './nav';
import type { Tool, AssistantAction } from '../types';

/** Every tool the assistant can call. */
export const ALL_TOOLS: Tool[] = [...QUERY_TOOLS, ...NAV_TOOLS];

export const toolByName = (name: string): Tool | undefined =>
  ALL_TOOLS.find(t => t.name === name);

// A freshly-switched tab can mount a component before its container has size
// (the map measures width; lists measure height), leaving it blank until the
// user interacts. A couple of resize ticks make those components re-measure.
const nudgeLayout = () => [80, 250, 550].forEach(ms =>
  setTimeout(() => window.dispatchEvent(new Event('resize')), ms));

/**
 * Fire an action through the app's existing public event API.
 *
 * Deferred to a fresh task (setTimeout 0): the action button lives in a portal,
 * so dispatching synchronously would fire `fate:nav` *nested inside* the
 * assistant's own React click handler — which is exactly the case that left the
 * destination tab stuck blank until a manual click. Deferring lets React finish
 * the current handler first, so tab/map owners receive the event cleanly (the
 * same way they do from the ⌘K palette).
 */
export const runAction = (a: AssistantAction): void => {
  setTimeout(() => {
    switch (a.kind) {
      case 'map': {
        // showChunkOnMap also switches to the World tab + spotlights the chunk.
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
    nudgeLayout();
  }, 0);
};
