import { describe, expect, it } from 'vitest';
import content from '../public/chunk-content.json';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { MOBILITY_LIST, POH_LIST } from '../data/items';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import { BOAT_CROSSINGS, TRAVEL_NETWORKS } from '../data/travelLinks';
import { AREA_ENTRY_ROUTES } from '../data/areaAccess';
import type { UnlockState } from '../types';
import { computeAreaRoutes } from './areaRoutes';
import { chunkReachability } from './chunkReach';
import { chunkForPlace } from './chunkLocations';
import { closedTravelNodes, graphNode, routeGraph, travelReachability } from './travelReach';

/**
 * A player reported on 29 September 2026 that the Diary Journal called tasks
 * doable in owned areas they had no way to reach: Brimhaven Dungeon's, and
 * praying at the altar in Kourend Castle. The map's route graph reached both
 * from Lumbridge through Zanaris and Death's Office.
 */
const connect = (content as unknown as { connect: Record<string, string[]> }).connect;
type Chunk = { cx: number; cy: number };
const AREAS = { ...REGION_CHUNKS, ...SUB_AREA_CHUNKS } as Record<string, Chunk[]>;
const idOf = ({ cx, cy }: Chunk) => String(cx * 256 + cy);
const ownable = new Set(Object.values(AREAS).flat().map(idOf));

const run = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], banks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...overrides,
});
const stranded = (unlocks: UnlockState) => computeAreaRoutes(connect, unlocks, 'vanilla')!.strandedAreas;
const LUMBRIDGE = chunkForPlace('Lumbridge');

describe('the reviewed travel links', () => {
  it('name nodes of the route graph, docks on the map, and unlocks and quests the app knows', () => {
    for (const network of TRAVEL_NETWORKS) {
      expect(network.source, network.label).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/.+\?oldid=\d+$/);
      for (const node of network.nodes) {
        expect(connect[graphNode(node)]?.length, `${network.label}: ${node}`).toBeGreaterThan(0);
        expect(ownable.has(graphNode(node)), `${network.label}: ${node} is land a run owns`).toBe(false);
      }
      for (const opener of network.opensWith) {
        if (opener.mobility !== undefined) expect(MOBILITY_LIST).toContain(opener.mobility);
        if (opener.housing !== undefined) expect(POH_LIST).toContain(opener.housing);
        for (const quest of opener.quests ?? []) expect(QUEST_DATA[quest], quest).toBeDefined();
        if (opener.weapon?.unlessDiary !== undefined) {
          expect(Object.keys(DIARY_DATA), opener.weapon.unlessDiary).toContain(opener.weapon.unlessDiary);
        }
      }
      for (const stop of network.stops ?? []) {
        expect(ownable.has(graphNode(stop.node)), `${network.label}: ${stop.node}`).toBe(true);
        for (const quest of stop.quests) expect(QUEST_DATA[quest], quest).toBeDefined();
      }
    }
    for (const crossing of BOAT_CROSSINGS) {
      expect(crossing.source, crossing.label).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/.+\?oldid=\d+$/);
      expect(crossing.docks.length, crossing.label).toBeGreaterThan(1);
      for (const dock of crossing.docks) expect(ownable.has(graphNode(dock)), `${crossing.label}: ${dock}`).toBe(true);
      for (const quest of crossing.quests ?? []) expect(QUEST_DATA[quest], quest).toBeDefined();
    }
  });

  it('close a network until the run has everything one way to open it needs', () => {
    const zanaris = [graphNode('Zanaris'), graphNode('37,69')];
    const isShut = (unlocks: UnlockState) => zanaris.every(node => closedTravelNodes(unlocks).has(node));
    expect(isShut(run())).toBe(true);
    // Fairy rings need the unlock, Fairytale I, and a staff or the Lumbridge Elite diary.
    const rings = { mobility: ['Fairy Rings'], quests: ['Fairytale I - Growing Pains'] };
    expect(isShut(run({ mobility: ['Fairy Rings'] }))).toBe(true);
    expect(isShut(run({ ...rings }))).toBe(true);
    expect(isShut(run({ ...rings, equipment: { Weapon: 1 } }))).toBe(false);
    expect(isShut(run({ ...rings, diaries: ['Lumbridge Elite'] }))).toBe(false);
    expect(isShut(run({ quests: ['Fairytale I - Growing Pains'], equipment: { Weapon: 1 } }))).toBe(true);

    expect(closedTravelNodes(run({ mobility: ['Eagle Transport'] })).has(graphNode('31,77'))).toBe(true);
    expect(closedTravelNodes(run({ mobility: ['Eagle Transport'], quests: ["Eagles' Peak"] })).has(graphNode('31,77'))).toBe(false);
    expect(closedTravelNodes(run({ mobility: ['Balloon Transport'] })).has(graphNode('28,76'))).toBe(true);
    expect(closedTravelNodes(run({ mobility: ['Balloon Transport'], quests: ['Enlightened Journey'] })).has(graphNode('28,76')))
      .toBe(false);

    const house = [graphNode('Player-owned house'), graphNode('28,89')];
    expect([...closedTravelNodes(run({ housing: ['Portal Chamber'] }))]).not.toEqual(expect.arrayContaining(house));
    expect([...closedTravelNodes(run({ housing: ['Portal Nexus'] }))]).not.toEqual(expect.arrayContaining(house));
    expect([...closedTravelNodes(run({ housing: ['Jewellery Box'] }))]).toEqual(expect.arrayContaining(house));
    expect(closedTravelNodes(run({ quests: ['Enter the Abyss'] })).has(graphNode('Abyss'))).toBe(false);

    const everything = run({
      mobility: [...MOBILITY_LIST], housing: [...POH_LIST], quests: Object.keys(QUEST_DATA), equipment: { Weapon: 1 },
    });
    expect([...closedTravelNodes(everything)].sort()).toEqual(
      [graphNode("Death's Office"), graphNode('49,89'), graphNode('Puro-Puro'), graphNode('40,67'), graphNode('45,75')].sort());
  });

  it('leave a ring off the network until its own quest is done', () => {
    const ring = graphNode('33,47');
    expect(connect[graphNode('37,69')]).toContain(ring);
    expect(routeGraph(connect, run())[graphNode('37,69')]).not.toContain(ring);
    expect(routeGraph(connect, run())[ring] ?? []).not.toContain(graphNode('37,69'));
    expect(routeGraph(connect, run({ quests: ['Regicide'] }))[graphNode('37,69')]).toContain(ring);
  });

  it('join a boat’s docks both ways, once the run has its quests', () => {
    const fossil = graphNode('58,59');
    expect(routeGraph(connect, run())[graphNode('52,53')] ?? []).not.toContain(fossil);
    const graph = routeGraph(connect, run({ quests: ['Bone Voyage'] }));
    expect(graph[graphNode('52,53')]).toContain(fossil);
    expect(graph[fossil]).toContain(graphNode('52,53'));
    expect(routeGraph(connect, run({ quests: ['Bone Voyage'] }))).toBe(graph);
    expect(connect[graphNode('52,53')] ?? []).not.toContain(fossil);
  });
});

describe('what is stranded', () => {
  const reported = run({ regions: ['Brimhaven', 'Kourend Castle'] });

  it('strands Brimhaven and Kourend Castle when no way there is open, as the report found', () => {
    // The plain graph walked there through Zanaris and Death's Office.
    const plain = chunkReachability(connect, reported, LUMBRIDGE, undefined, 'vanilla').reachable;
    expect(plain.has(graphNode('42,50'))).toBe(true);
    expect(plain.has(graphNode('25,57'))).toBe(true);

    expect([...stranded(reported)]).toEqual(expect.arrayContaining(['Brimhaven', 'Kourend Castle']));
  });

  it('reaches them by a network the run has unlocked, or by a boat', () => {
    const fairyRings = { mobility: ['Fairy Rings'], quests: ['Fairytale I - Growing Pains'], equipment: { Weapon: 1 } };
    const rings = stranded({ ...reported, ...fairyRings });
    expect(rings.has('Brimhaven')).toBe(false);
    expect(rings.has('Kourend Castle')).toBe(true);
    // The unlock alone isn't enough: the rings need Fairytale I and a staff.
    expect(stranded({ ...reported, mobility: ['Fairy Rings'] }).has('Brimhaven')).toBe(true);
    // Zul-Andra's ring (BJS) needs Regicide as well.
    expect(stranded(run({ regions: ['Zul-Andra'], ...fairyRings })).has('Zul-Andra')).toBe(true);
    expect(stranded(run({ regions: ['Zul-Andra'], ...fairyRings, quests: [...fairyRings.quests, 'Regicide'] })).has('Zul-Andra'))
      .toBe(false);

    // Captain Barnaby from Rimmington; the monks and Veos from Port Sarim.
    expect(stranded(run({ regions: ['Port Sarim', 'Rimmington', 'Brimhaven'] })).has('Brimhaven')).toBe(false);
    expect(stranded(run({ regions: ['Port Sarim', 'Entrana'] })).has('Entrana')).toBe(false);
    expect(stranded(run({ regions: ['Entrana'] })).has('Entrana')).toBe(true);
    expect(stranded(run({ regions: ['Port Sarim', 'Piscarilius'] })).has('Piscarilius')).toBe(false);
    expect(stranded(run({ regions: ['Piscarilius'] })).has('Piscarilius')).toBe(true);
  });

  it('strands nothing the plain graph reached for a run that owns every area, networks or not', () => {
    const everything = run({ regions: Object.keys(AREAS) });
    const plain = chunkReachability(connect, everything, LUMBRIDGE, undefined, 'vanilla').reachable;
    const reviewed = travelReachability(connect, everything, LUMBRIDGE, undefined, 'vanilla').reachable;
    // Only islands with reviewed entry routes (data/areaAccess.ts), which judge them instead.
    const lost = [...plain].filter(id => !reviewed.has(id));
    const islandOf = (id: string) => Object.entries(SUB_AREA_CHUNKS as Record<string, Chunk[]>)
      .find(([, chunks]) => chunks.some(chunk => idOf(chunk) === id))?.[0];
    expect([...new Set(lost.map(islandOf))].sort()).toEqual(['Ape Atoll', 'Harmony Island', "Mos Le'Harmless"]);
    for (const name of ['Ape Atoll', 'Harmony Island', "Mos Le'Harmless"]) expect(AREA_ENTRY_ROUTES[name]?.length, name).toBeGreaterThan(0);
    const routes = computeAreaRoutes(connect, everything, 'vanilla')!;
    expect([...routes.strandedChunks].filter(key => lost.includes(graphNode(key)))).toEqual([]);

    // The barge adds Fossil Island, which the plain graph never reached.
    const voyage = travelReachability(connect, { ...everything, quests: ['Bone Voyage'] }, LUMBRIDGE, undefined, 'vanilla');
    expect(plain.has(graphNode('58,59'))).toBe(false);
    expect(voyage.reachable.has(graphNode('58,59'))).toBe(true);
  });
});
