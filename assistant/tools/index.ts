import { QUERY_TOOLS } from './query';
import { NAV_TOOLS } from './nav';
import type { Tool, AssistantAction } from '../types';

/** Every tool the assistant can call. */
export const ALL_TOOLS: Tool[] = [...QUERY_TOOLS, ...NAV_TOOLS];

export const toolByName = (name: string): Tool | undefined =>
  ALL_TOOLS.find(t => t.name === name);

/** Fire an action through the app's existing public event API. */
export const runAction = (a: AssistantAction): void => {
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
};
