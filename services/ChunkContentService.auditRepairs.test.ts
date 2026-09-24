import { beforeAll, describe, expect, it, vi } from 'vitest';
import full from '../public/chunk-content.json';
import { ChunkContentService } from './ChunkContentService';
import { resolveQuest } from '../utils/contentIdentity';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => full })));
  expect(await service.init()).toBe(true);
  vi.unstubAllGlobals();
});
const first = (name: string) => [...new Set(service.entityLocations(name, ['quest'])?.locations
  .filter(loc => loc.role === 'first').map(loc => `${loc.cx},${loc.cy}`))].sort();

describe('reviewed second-audit content repairs', () => {
  it('retains diary and clue evidence from named interiors without duplicate diary refs', () => {
    expect(service.contentFor(46, 51)?.diaries.Falador.split(',').map(s => s.trim())).toContain('HD3');
    expect(service.contentFor(47, 52)?.diaries.Falador.split(',').map(s => s.trim())).toContain('EA9');
    expect(service.contentFor(20, 59)?.diaries['Kourend & Kebos'].split(',').map(s => s.trim())).toEqual(expect.arrayContaining(['HD9', 'EL5']));
    expect(service.contentFor(45, 55)?.clues.easy).toBeGreaterThan(0);
    for (const refs of Object.values(service.aggregate(service.allChunkCoords()).diaries)) {
      const list = refs.split(',').map(s => s.trim());
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('projects every Catacombs physical section to each reviewed entrance without duplicating counts', () => {
    for (const [cx, cy] of [[25, 57], [24, 59], [22, 57], [26, 60], [26, 55], [22, 56]]) {
      const sources = service.entityLocations('Ankou', ['monster'])!.locations
        .filter(loc => loc.cx === cx && loc.cy === cy && loc.locationName === 'Catacombs of Kourend');
      expect(sources.reduce((sum, loc) => sum + (loc.count ?? 0), 0)).toBe(10);
      expect(service.entityLocations('King Sand Crab', ['monster'])!.locations.some(loc => loc.cx === cx && loc.cy === cy)).toBe(true);
      const requirements = service.entityRequirementOptions('Ankou', 'monster', cx, cy, '6556').flat();
      expect(requirements.some(req => req.raw.includes('vine'))).toBe(!(cx === 25 && cy === 57));
    }
    const total = service.aggregate([{ cx: 25, cy: 57 }, { cx: 22, cy: 57 }]);
    expect(total.monsters.find(mon => mon.name === 'Ankou')?.count).toBe(10);
  });

  it('indexes reviewed permanent omissions and retains their entry conditions', () => {
    expect(service.itemSourceRecords('Potato cactus').some(record => record.kind === 'spawn' && record.sourceId === '12690')).toBe(true);
    expect(service.itemSourceChunks('Potato cactus')).toContainEqual(expect.objectContaining({ cx: 50, cy: 48, sourceId: '12690' }));
    for (const name of ['Ektheme', 'Imerominia', 'Istoria', 'Krato', 'Logios', 'Meleti', 'Pagida']) {
      expect(service.entityLocations(name, ['npc'])?.locations).toContainEqual(expect.objectContaining({ cx: 25, cy: 59, sourceId: '6303' }));
    }
    const lizards = service.entityLocations('Sulphur Lizard', ['monster'])!.locations;
    expect([...new Map(lizards.map(loc => [loc.sourceId, loc.count])).values()].reduce((sum, count) => sum! + count!, 0)).toBe(13);
    expect(service.entityRequirementOptions('Sulphur Lizard', 'monster', 20, 59, '5278').flat().some(req => req.raw.includes('boots'))).toBe(true);
    const titan = service.entityLocations('Black Knight Titan', ['monster'])!.locations;
    expect(titan).toContainEqual(expect.objectContaining({ cx: 42, cy: 50, sourceId: '11081' }));
    expect(service.entityRequirementOptions('Black Knight Titan', 'monster', 42, 50, '11081').flat().map(req => req.raw))
      .toEqual(expect.arrayContaining([expect.stringContaining('before restoring'), expect.stringContaining('whistle')]));
  });

  it('resolves every generated quest identity, including the ice-dungeon sword step', () => {
    expect(service.entitiesOfKind('quest').filter(quest => !resolveQuest(quest.name))).toEqual([]);
    expect(service.contentFor(47, 49)?.quests["The Knight's Sword"]).toBe('step');
  });

  it('uses reviewed quest starts and preserves legitimate elven alternatives', () => {
    expect(first('Ratcatchers')).toEqual(['49,53']);
    expect(service.contentFor(50, 54)?.quests.Ratcatchers).toBe('step');
    for (const name of ['RFD: The Cook', 'RFD: Goblins', 'RFD: Dwarf', 'RFD: Evil Dave', 'RFD: Pirate Pete', 'RFD: Lumbridge Guide', 'RFD: Sir Amik Varze', 'RFD: King Awowogei', 'RFD: Skrach Uglogwee', 'RFD: Finale']) {
      expect(first(name)).toContain('50,50');
    }
    expect(first('Roving Elves')).toEqual(['34,49', '35,49']);
    expect(first("Mourning's End Part I")).toEqual(['34,49', '35,49']);
  });

  it('locates Chase at the reviewed dog shelter', () => {
    expect(service.entityLocations('Chase', ['npc'])?.locations).toContainEqual(expect.objectContaining({ cx: 47, cy: 54 }));
    expect(service.taskRequirements('Chase', 'npc', 47, 54)).toContain('A Ruff Situation Complete the quest');
  });

  it('keeps the indexed interior name with each exact source access alternative', () => {
    const main = service.entityAccessOptions('Ankou', 'monster', 25, 57, '6556');
    const west = service.entityAccessOptions('Ankou', 'monster', 22, 57, '6556');
    expect(main).toEqual([{ area: 'Catacombs of Kourend', requirements: [] }]);
    expect(west).toEqual([{ area: 'Catacombs of Kourend', requirements: [expect.objectContaining({ raw: expect.stringContaining('west vine'), origin: 'CHUNK_ENTRY' })] }]);
    expect(service.entityAccessOptions('Ankou', 'monster', 25, 57, 'missing-source')).toEqual([]);
    expect(service.entityAccessOptions('Chase', 'npc', 47, 54)[0]).not.toHaveProperty('area');
  });
});
