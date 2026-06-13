/**
 * Navigation tools — drive the existing UI via the app's public event API
 * (fate:nav, navigate-journal) and showChunkOnMap. These never change game
 * state; they only move the user around, matching the "answer + navigate" scope.
 */
import { showChunkOnMap } from '../../utils/chunkLocations';
import { resolvePlace } from './query';
import type { Tool } from '../types';

const TAB_ALIASES: Record<string, string> = {
  world: 'WORLD', map: 'WORLD',
  character: 'CHARACTER', stats: 'CHARACTER',
  activities: 'ACTIVITIES & UTILITY', utility: 'ACTIVITIES & UTILITY',
  journal: 'JOURNAL', quests: 'JOURNAL', diaries: 'JOURNAL',
  collection: 'COLLECTION', clog: 'COLLECTION',
};

/** Jump the world map to a named place (and spotlight its chunk). */
const goToPlace: Tool = {
  name: 'go_to_place',
  description: 'Open the world map and jump to a named place (sub-area or region).',
  args: { place: 'a place name, e.g. "Varrock"' },
  run: ({ place }) => {
    const resolved = resolvePlace(place ?? '');
    if (!resolved) return { text: `I don't know where "${place}" is.` };
    return {
      text: `Taking you to ${resolved.name} on the map.`,
      actions: [{ kind: 'map', label: `Go to ${resolved.name}`, payload: { cx: resolved.cx, cy: resolved.cy } }],
    };
  },
};

/** Switch the main dashboard tab. */
const openTab: Tool = {
  name: 'open_tab',
  description: 'Switch to a main app tab: World, Character, Activities, Journal, or Collection.',
  args: { tab: 'one of: world, character, activities, journal, collection' },
  run: ({ tab }) => {
    const key = (tab ?? '').trim().toLowerCase();
    const target = TAB_ALIASES[key];
    if (!target) return { text: `I can open: World, Character, Activities, Journal, Collection.` };
    return {
      text: `Opening the ${target} tab.`,
      actions: [{ kind: 'tab', label: `Open ${target}`, payload: { target: `tab:${target}` } }],
    };
  },
};

export const NAV_TOOLS: Tool[] = [goToPlace, openTab];
