/**
 * Query tools — read-only answers grounded in the app's own data, never the
 * model's memory. Each returns a short text answer plus optional map/nav actions.
 */
import { chunkContentService } from '../../services/ChunkContentService';
import { summarisePlaces, placeOf } from '../../utils/chunkLocations';
import { questLocations, refineQuestRegion } from '../../utils/questLocations';
import { getQuestStatus } from '../../utils/journalStatus';
import { QUEST_DATA } from '../../data/questData';
import { SUB_AREA_CHUNKS } from '../../data/subAreaChunks';
import { REGION_CHUNKS } from '../../data/regionChunks';
import type { Tool, ToolResult, AssistantContext, AssistantAction } from '../types';

const notReady = (): ToolResult => ({
  text: "I'm still loading the world data — give me a second and ask again.",
});

/** Find the best place name → a representative chunk (sub-area first, then region). */
const resolvePlace = (query: string): { name: string; cx: number; cy: number } | null => {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const scan = (groups: Record<string, { cx: number; cy: number }[]>) => {
    let best: { name: string; cx: number; cy: number; score: number } | null = null;
    for (const [name, chunks] of Object.entries(groups)) {
      if (!chunks.length) continue;
      const n = name.toLowerCase();
      const score = n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : 0;
      if (score && (!best || score > best.score)) best = { name, cx: chunks[0].cx, cy: chunks[0].cy, score };
    }
    return best;
  };
  return scan(SUB_AREA_CHUNKS) ?? scan(REGION_CHUNKS);
};

const mapAction = (cx: number, cy: number, label: string): AssistantAction => ({
  kind: 'map', label, payload: { cx, cy },
});

/** "Where can I find a Yew tree / Chaos Druid / General Store?" */
const whereToFind: Tool = {
  name: 'where_to_find',
  description: 'Locate an entity (monster, tree, ore, shop, NPC, item spawn) on the map and whether those places are unlocked.',
  args: { entity: 'the thing to find, e.g. "Yew tree"' },
  run: ({ entity }, ctx) => {
    if (!chunkContentService.ready) return notReady();
    const name = (entity ?? '').trim();
    if (!name) return { text: 'Tell me what to find, e.g. "where can I find coal?"' };
    // Natural phrasings ("iron ore", "yew trees") rarely match an entity name
    // exactly, so try progressively looser searches: exact → full phrase →
    // phrase minus a generic suffix (ore/rock/tree/spot) → first word.
    const stripped = name.replace(/\b(ores?|rocks?|trees?|spots?|nodes?)\b/gi, '').trim();
    const firstWord = name.split(/\s+/)[0];
    // "find" is for findable things (monsters, nodes, NPCs, spawns, shops) —
    // never quests, so "rune" resolves to Runite ore, not "Rune Mysteries".
    const KINDS = ['monster', 'object', 'npc', 'spawn', 'shop'] as const;
    const search = (q: string) => chunkContentService.searchEntities(q, 5).find(h => h.kind !== 'quest');
    const hit =
      chunkContentService.entityLocations(name, KINDS as any) ??
      search(name) ??
      (stripped && stripped !== name ? search(stripped) : undefined) ??
      (firstWord !== name ? search(firstWord) : undefined);
    if (!hit) return { text: `I couldn't find "${name}" anywhere in the chunk data.` };
    const places = summarisePlaces(hit.locations, ctx.unlocks);
    const open = places.filter(p => p.unlocked);
    const lead = open[0] ?? places[0];
    const openList = open.slice(0, 4).map(p => p.label).join(', ');
    const text = open.length
      ? `${hit.name} is at ${places.length} place(s). Unlocked for you: ${openList || '—'}${open.length > 4 ? '…' : ''}.`
      : `${hit.name} appears at ${places.length} place(s), but none are unlocked yet (nearest: ${lead.label}).`;
    return { text, actions: lead ? [mapAction(lead.cx, lead.cy, `Show ${hit.name} on map`)] : [] };
  },
};

/** "Why is Dragon Slayer II locked?" */
const whyLocked: Tool = {
  name: 'why_quest_locked',
  description: 'Explain whether a quest is available and, if not, exactly which requirements (region, skills, prereq quests) are blocking it.',
  args: { quest: 'the quest name' },
  run: ({ quest }, ctx) => {
    const name = (quest ?? '').trim().toLowerCase();
    if (!name) return { text: 'Which quest? e.g. "why is Monkey Madness locked?"' };
    const data = Object.values(QUEST_DATA).find(q => q.name.toLowerCase() === name)
      ?? Object.values(QUEST_DATA).find(q => q.name.toLowerCase().includes(name));
    if (!data) return { text: `I don't have a quest called "${quest}".` };

    if (getQuestStatus(data, ctx.unlocks) === 'COMPLETED') return { text: `${data.name} is already complete.` };

    // Compute blockers with the chunk-refined region check (so a quest reachable
    // via unlocked sub-areas isn't reported as region-locked). If nothing blocks,
    // it's actually available — decide from the blockers, not the coarse status.
    const blockers: string[] = [];
    const gated = data.regions.filter(r => r !== 'Misthalin' && !ctx.unlocks.regions.includes(r));
    const loc = questLocations(data.name, ctx.unlocks);
    const region = refineQuestRegion(gated.length === 0, loc);
    if (!region.met) {
      const locked = loc.lockedPlaces.slice(0, 3).map(p => p.label).join(', ');
      blockers.push(`region: ${locked || gated.join(', ')} not unlocked`);
    }
    const currentQP = ctx.unlocks.quests.reduce((a, q) => a + (QUEST_DATA[q]?.points ?? 0), 0);
    for (const [skill, lvl] of Object.entries(data.skills as Record<string, number>)) {
      if (skill === 'Quest Points') { if (currentQP < lvl) blockers.push(`${lvl} QP (you have ${currentQP})`); continue; }
      const have = ctx.unlocks.levels[skill] ?? 1;
      const unlocked = (ctx.unlocks.skills[skill] ?? 0) > 0;
      if (!unlocked || have < lvl) blockers.push(`${skill} ${lvl}${unlocked ? ` (you have ${have})` : ' (skill locked)'}`);
    }
    const missingPrereq = data.prereqs.filter(q => !ctx.unlocks.quests.includes(q));
    if (missingPrereq.length) blockers.push(`prerequisite quest(s): ${missingPrereq.join(', ')}`);

    const first = loc.startPlaces[0] ?? loc.places[0];
    const action = first ? [mapAction(first.cx, first.cy, `Show where ${data.name} starts`)] : [];
    if (blockers.length === 0) {
      return { text: `${data.name} is available — you meet every requirement. Go for it!`, actions: action };
    }
    return { text: `${data.name} is locked. Blocking: ${blockers.join('; ')}.`, actions: action };
  },
};

/** "What can I do in Falador?" — a quick unlocked/locked summary for a place. */
const whatHere: Tool = {
  name: 'what_can_i_do_here',
  description: 'Summarise what a named place (sub-area or region) offers and how much of it is unlocked.',
  args: { place: 'a place name, e.g. "Falador"' },
  run: ({ place }, ctx) => {
    if (!chunkContentService.ready) return notReady();
    const resolved = resolvePlace(place ?? '');
    if (!resolved) return { text: `I don't recognise the place "${place}".` };
    const chunks = SUB_AREA_CHUNKS[resolved.name] ?? REGION_CHUNKS[resolved.name] ?? [{ cx: resolved.cx, cy: resolved.cy }];
    const c = chunkContentService.aggregate(chunks);
    const where = placeOf(resolved.cx, resolved.cy);
    const bits: string[] = [];
    if (c.monsters.length) bits.push(`${c.monsters.length} monster type(s)`);
    if (c.quests && Object.keys(c.quests).length) bits.push(`${Object.keys(c.quests).length} quest(s)`);
    if (c.shops.length) bits.push(`${c.shops.length} shop(s)`);
    if (c.objects.length) bits.push(`${c.objects.length} object/resource node(s)`);
    return {
      text: `${resolved.name} (${where.region ?? 'world'}): ${bits.join(', ') || 'no catalogued content'}. Open it on the map for the full unlocked/locked breakdown.`,
      actions: [mapAction(resolved.cx, resolved.cy, `Open ${resolved.name} on map`)],
    };
  },
};

export const QUERY_TOOLS: Tool[] = [whereToFind, whyLocked, whatHere];
export { resolvePlace };
