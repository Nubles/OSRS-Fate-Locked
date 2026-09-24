import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { buildQuestWalkingGraph, QUEST_WALKING_GRAPH_URL, serializeQuestWalkingGraph, syncQuestWalkingGraph } from './quest-walking-graph.mjs';

const manifest = { repository: 'test/source', commit: 'pinned', rawSha256: 'hash', sourceUrl: 'source' };
const fixture = () => ({
  walkableChunks: ['256', '512', '768', '1024', '1280'],
  chunks: {
    256: { Nickname: 'West bank', Connect: { 768: true } },
    512: { Nickname: 'East bank' },
    768: { Nickname: 'Island' },
    1024: { Nickname: 'Ocean Chunk' },
    1280: {},
  },
  sections: {
    256: { 1: ['512', '256-2', '256-W1', '1024', '1280', '???', '99999'], 2: [], W1: ['512'] },
    512: { 0: [] },
    768: { 0: [] },
    1024: { 0: ['256-1'] },
    1280: { 0: ['256-1'] },
  },
  questSections: {} as Record<string, unknown>,
  sectionsLimits: {} as Record<string, unknown>,
});

let pinned: ReturnType<typeof buildQuestWalkingGraph>;
beforeAll(async () => {
  const { data, manifest: pin } = await readPinnedChunkSource();
  pinned = buildQuestWalkingGraph(data, pin);
});

describe('source-backed quest walking graph', () => {
  it('retains section identity and one-way edges, without invented adjacency or transport', () => {
    const graph = buildQuestWalkingGraph(fixture(), manifest);
    expect(Object.keys(graph.nodes).sort()).toEqual(['256-1', '256-2', '512', '768']);
    expect(graph.nodes['256-1']).toEqual({ chunk: '1,0', requirements: [], edges: [
      { to: '256-2', requirements: [] }, { to: '512', requirements: [] },
    ] });
    expect(graph.nodes['512'].edges).toEqual([]);
    expect(graph.nodes['768'].edges).toEqual([]);
    expect(graph.nodes['512-0']).toBeUndefined();
  });

  it('excludes water, ocean, unnamed, unknown and missing destinations', () => {
    const graph = buildQuestWalkingGraph(fixture(), manifest);
    for (const omitted of ['256-W1', '1024', '1280', '???', '99999']) {
      expect(graph.nodes[omitted]).toBeUndefined();
      expect(Object.values(graph.nodes).flatMap((node: any) => node.edges).some((edge: any) => edge.to === omitted)).toBe(false);
    }
  });

  it('retains exact node and directed edge gates and fails closed for unfamiliar metadata', () => {
    const source = fixture();
    source.questSections = { '256': ['~|Base Quest|~ Complete the quest'], '256-1': ['~|Section Quest|~ 3'] };
    source.sectionsLimits = {
      '256-1 to 512': { Tasks: { '~|Cabin Fever|~ 1': 'Quest' }, Items: { Rope: 1 } },
      '256-1 to 256-2': { Tasks: { Strange: 'Unknown category' } },
    };
    const graph = buildQuestWalkingGraph(source, manifest);
    expect(graph.nodes['256-1'].requirements).toEqual(['~|Base Quest|~ Complete the quest', '~|Section Quest|~ 3']);
    expect(graph.nodes['256-2'].requirements).toEqual(['~|Base Quest|~ Complete the quest']);
    expect(graph.nodes['256-1'].edges.find((edge: any) => edge.to === '512').requirements).toEqual([
      'UNSUPPORTED_SOURCE_REQUIREMENT:{"Items":{"Rope":1}}', '~|Cabin Fever|~ 1',
    ]);
    expect(graph.nodes['256-1'].edges.find((edge: any) => edge.to === '256-2').requirements)
      .toEqual(['UNSUPPORTED_SOURCE_REQUIREMENT:{"Tasks":{"Strange":"Unknown category"}}']);
    expect(graph.nodes['512'].requirements).toEqual([]);
  });

  it('does not silently discard malformed requirement shapes', () => {
    const source = fixture();
    source.questSections['256-1'] = { unsupported: true };
    source.sectionsLimits['256-1 to 512'] = null;
    const graph = buildQuestWalkingGraph(source, manifest);
    expect(graph.nodes['256-1'].requirements).toEqual(['UNSUPPORTED_SOURCE_REQUIREMENT:{"unsupported":true}']);
    expect(graph.nodes['256-1'].edges.find((edge: any) => edge.to === '512').requirements)
      .toEqual(['UNSUPPORTED_SOURCE_REQUIREMENT:null']);
  });

  it('proves the Restless Ghost mainland path and the Tower bridge detour', () => {
    const churchToUrhney = ['12850-1', '12849-1', '12593-1'];
    const ghostToTower = ['12849-1', '12593-1', '12594-1', '12338-1', '12337-1'];
    for (const route of [churchToUrhney, ghostToTower]) for (let index = 0; index < route.length; index++) {
      expect(pinned.nodes[route[index]].requirements).toEqual([]);
      if (index) expect(pinned.nodes[route[index - 1]].edges).toContainEqual({ to: route[index], requirements: [] });
    }
    expect(pinned.nodes['12337-1'].edges).toEqual([{ to: '12338-1', requirements: [] }]);
    expect(pinned.nodes['12593-1'].edges.some((edge: any) => edge.to === '12337-1')).toBe(false);
    expect(ghostToTower.map(id => pinned.nodes[id].chunk)).toEqual(['50,49', '49,49', '49,50', '48,50', '48,49']);
  });

  it('retains the pinned Cabin Fever edge restriction', () => {
    expect(pinned.nodes['14646-1'].edges).toContainEqual({ to: '14902', requirements: ['~|Cabin Fever|~ 1'] });
    expect(pinned.nodes['14902'].edges).toContainEqual({ to: '14646-1', requirements: ['~|Cabin Fever|~ 1'] });
  });

  it('adds the reviewed Al Kharid toll in both directions without losing source gates', async () => {
    const requirement = 'Al Kharid gate: 10 coins unless Prince Ali Rescue is complete';
    for (const [from, to] of [['12850-1', '13106-1'], ['13106-1', '12850-1']]) {
      expect(pinned.nodes[from].edges).toContainEqual({ to, requirements: [requirement] });
    }
    expect(pinned.source.reviewedEdgeRequirements).toContainEqual({
      edges: ['12850-1 to 13106-1', '13106-1 to 12850-1'],
      requirement,
      url: 'https://oldschool.runescape.wiki/w/Lumbridge',
    });
    const { data, manifest: pin } = await readPinnedChunkSource();
    data.sectionsLimits['12850-1 to 13106-1'] = { Tasks: { '~|Another gate|~ 2': 'Quest' } };
    const combined = buildQuestWalkingGraph(data, pin);
    expect(combined.nodes['12850-1'].edges).toContainEqual({
      to: '13106-1', requirements: [requirement, '~|Another gate|~ 2'],
    });
  });

  it('rebuilds the committed graph deterministically from verified source bytes', async () => {
    const stored = await readFile(QUEST_WALKING_GRAPH_URL, 'utf8');
    expect(stored.replace(/\r\n/g, '\n')).toBe(serializeQuestWalkingGraph(pinned));
    expect(await syncQuestWalkingGraph({ check: true })).toEqual(pinned);
    const source = fixture();
    const reordered = { ...source, sections: Object.fromEntries(Object.entries(source.sections).reverse()) };
    expect(serializeQuestWalkingGraph(buildQuestWalkingGraph(reordered, manifest)))
      .toBe(serializeQuestWalkingGraph(buildQuestWalkingGraph(source, manifest)));
  });
});
