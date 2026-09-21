import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { initialState } from '../context/GameContext';
import { evaluateBankRequirements, evaluateEntityAccess } from './entityAccess';
import { buildChunkPermissionSnapshot } from './chunkPermissionSnapshot';
import { ALL_CHUNK_KEYS, getChunkFrontier, chunkKey } from './chunkAdjacency';
import { chunkUnlocked, summarisePlaces } from './chunkLocations';
import { checkUnlockAvailability, randomUnlockPool } from './gameEngine';
import { TableType } from '../types';
import { canonicalQuestId, canonicalBossId } from './contentIdentity';
import { compileRawRequirements, evaluateRouteGates } from './questRoutes/accountRequirements';
import { migrateClogIds } from './clogIdMigrations';
import { computeSync } from '../services/CollectionLogSyncService';
import { createCollectionIdAllocator } from './collectionLogIds.mjs';
import { buildReport } from '../scripts/check-content-sync.mjs';
import { slayerReachability } from './slayerReach';

const service = new ChunkContentService();
const account = () => structuredClone(initialState.unlocks);
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init(); vi.unstubAllGlobals();
});

describe('reviewed content repairs', () => {
  it('maps all retained named interiors while keeping unnamed records outside permission indexes', () => {
    const unlocated = Object.values(content.interiors).filter(entry => !entry.entrances.length);
    expect(unlocated).toHaveLength(153);
    expect(unlocated.every(entry => entry.name.startsWith('Interior '))).toBe(true);
    expect(Object.keys(content.interiors)).toHaveLength(909);
    expect(evaluateEntityAccess('Giant rat', 'monster', { cx: 50, cy: 50, sourceId: '12436' }, account(), 'chunked', service).status)
      .toBe('UNKNOWN');
  });

  it('locates permanent demonic gorillas at the crash-site opening and requires Monkey Madness II', () => {
    const hits = service.entityLocations('Demonic gorilla', ['monster'])!.locations;
    expect(hits.filter(hit => hit.sourceId === '8280' || hit.sourceId === '8536'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ cx: 38, cy: 55, sourceId: '8280' }),
        expect.objectContaining({ cx: 38, cy: 55, sourceId: '8536' }),
      ]));
    const state = { ...account(), chunks: ['38,55'] };
    const coord = { cx: 38, cy: 55 };
    const status = () => buildChunkPermissionSnapshot(service.contentFor(38, 55)!, coord,
      { unlocks: state, gameModeId: 'chunked', contentService: service })
      .categories.COMBAT!.find(row => row.name === 'Demonic gorilla')!.status;
    expect(status()).toBe('NOT_READY');
    state.quests.push('Monkey Madness II');
    expect(status()).toBe('ALLOWED');
  });

  it('does not unlock quest-only Crabclaw rooms when completing the quest', () => {
    const state = { ...account(), chunks: ['25,53'], quests: ['The Depths of Despair'] };
    expect(evaluateEntityAccess('Sand Crab', 'monster', { cx: 25, cy: 53, sourceId: '6809' }, state, 'chunked', service).status)
      .toBe('ALLOWED');
    expect(evaluateEntityAccess('Chest', 'object', { cx: 25, cy: 53, sourceId: '6808' }, state, 'chunked', service).status)
      .toBe('NOT_READY');
    state.quests = [];
    expect(evaluateEntityAccess('Sand Crab', 'monster', { cx: 25, cy: 53, sourceId: '6809' }, state, 'chunked', service).status)
      .toBe('UNKNOWN');
  });

  it('keeps post-quest tormented demons distinct from ordinary swamp cave access', () => {
    const state = { ...account(), chunks: ['49,49'] };
    const coord = { cx: 49, cy: 49, sourceId: '12692' };
    expect(evaluateEntityAccess('Tormented Demon', 'monster', coord, state, 'chunked', service).status).not.toBe('ALLOWED');
    state.quests.push('While Guthix Sleeps');
    expect(evaluateEntityAccess('Tormented Demon', 'monster', coord, state, 'chunked', service).status).toBe('ALLOWED');
    expect(service.entityLocations('Juna', ['npc'])!.locations).toContainEqual(expect.objectContaining({ cx: 49, cy: 49 }));
  });

  it('uses the physical Kruk trapdoor and does not infer its partial quest stage', () => {
    const hits = service.entityLocations('Maniacal monkey', ['monster'])!.locations
      .filter(hit => hit.locationName === "Kruk's Dungeon");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(hit => hit.cx === 42 && hit.cy === 43)).toBe(true);
    const state = { ...account(), chunks: ['42,43'] };
    expect(evaluateEntityAccess('Maniacal monkey', 'monster', hits[0], state, 'chunked', service).status).toBe('UNKNOWN');
    state.quests.push('Monkey Madness II');
    expect(evaluateEntityAccess('Maniacal monkey', 'monster', hits[0], state, 'chunked', service).status).toBe('ALLOWED');
  });

  it('indexes all reviewed essence teleport hosts while requiring Rune Mysteries', () => {
    const hits = service.entityLocations('Rune Essence rock', ['object'])!.locations;
    for (const [cx, cy] of [[50,53], [48,49], [41,51]]) {
      const loc = hits.find(hit => hit.cx === cx && hit.cy === cy)!;
      expect(loc).toBeTruthy();
      const state = { ...account(), chunks: [`${cx},${cy}`] };
      expect(evaluateEntityAccess('Rune Essence rock', 'object', loc, state, 'chunked', service).status).toBe('NOT_READY');
      state.quests.push('Rune Mysteries');
      expect(evaluateEntityAccess('Rune Essence rock', 'object', loc, state, 'chunked', service).status).toBe('ALLOWED');
    }
  });

  it('preserves Hieve task restrictions and untracked deeper-dungeon conditions', () => {
    const upper = service.entityRequirementOptions('Iron dragon', 'monster', 42, 49, '10899');
    expect(upper.flat()).toContainEqual({ raw: 'Current Slayer assignment: Iron dragon', origin: 'ENTITY' });
    const state = { ...account(), chunks: ['42,49', '39,58'], quests: ['Underground Pass', 'Regicide'] };
    expect(evaluateEntityAccess('Iron dragon', 'monster', { cx: 42, cy: 49, sourceId: '10899' }, state, 'chunked', service).status)
      .toBe('UNKNOWN');
    expect(evaluateEntityAccess('Wallasalki', 'monster', { cx: 39, cy: 58, sourceId: '7492' }, state, 'chunked', service).status)
      .toBe('UNKNOWN');
  });

  it('restores Keldagrim banking while preserving its interior entry requirement', () => {
    const state = { ...account(), chunks: ['43,58'], banks: ['11066'] };
    const coord = { cx: 43, cy: 58 };
    const bankContent = service.contentFor(coord.cx, coord.cy)!;
    expect(service.hasBank(coord.cx, coord.cy)).toBe(true);
    const status = () => buildChunkPermissionSnapshot(bankContent, coord, { unlocks: state, gameModeId: 'chunked', contentService: service }).categories.BANKS?.[0].status;
    expect(evaluateBankRequirements(bankContent, coord, state, service).status).toBe('UNKNOWN');
    expect(status()).toBe('UNKNOWN');
    state.quests.push('The Giant Dwarf');
    expect(status()).toBe('ALLOWED');
    const missingBanks = Object.values(content.interiors).filter(entry =>
      ('p' in entry.content && entry.content.p.includes('Banker'))
      || ('o' in entry.content && entry.content.o.some(([name]) => /^(bank booth|bank chest|bank deposit box|bank deposit chest|deposit pool)$/i.test(String(name))))
    ).flatMap(entry => entry.entrances.filter(route => !content.banks.includes(route.chunkId)));
    expect(missingBanks).toEqual([]);
  });
  it('restores Keldagrim and Prifddinas shops through their own gated entrances', () => {
    const shop = service.entityLocations('Agmundi Quality Clothes', ['shop'])!;
    expect(shop.locations).toEqual(expect.arrayContaining([expect.objectContaining({ cx: 43, cy: 58, sourceId: '11423' })]));
    const state = { ...account(), chunks: ['43,58'], merchants: ['Clothes Shops'] };
    expect(evaluateEntityAccess(shop.name, 'shop', shop.locations[0], state, 'chunked', service).status).toBe('UNKNOWN');
    state.quests.push('The Giant Dwarf');
    expect(evaluateEntityAccess(shop.name, 'shop', shop.locations[0], state, 'chunked', service).status).toBe('ALLOWED');
    const prif = service.entityLocations("Amlodd's Magical Supplies", ['shop'])!;
    expect(prif.locations.every(loc => [34, 35].includes(loc.cx) && [51, 52].includes(loc.cy))).toBe(true);
    const prifState = { ...account(), chunks: ['34,52'], merchants: ['Magic Shops'] };
    expect(evaluateEntityAccess(prif.name, 'shop', { cx: 34, cy: 52 }, prifState, 'chunked', service).status).not.toBe('ALLOWED');
    prifState.quests.push('Song of the Elves');
    expect(evaluateEntityAccess(prif.name, 'shop', { cx: 34, cy: 52 }, prifState, 'chunked', service).status).toBe('ALLOWED');
  });

  it('locates every retained stock table and excludes removed shops', () => {
    const unlocated = Object.keys(content.shopItems).filter(name => !service.entityLocations(name, ['shop'])?.locations.length);
    expect(unlocated).toEqual([]);
    for (const name of ['Beach Cocktails', 'Beach Kit', 'Bunbridge General Store', "The Haymaker's Arms"]) expect(content.shopItems).not.toHaveProperty(name);
    expect(service.shopStock("Davon's Amulet Store")).toEqual([]);
    expect(service.shopStock("Grum's Gold Exchange")).toEqual([]);
    expect(service.shopStock('Forestry Shop')).toContain('Forestry kit');
    expect(service.shopStock('Castle Wars Ticket Exchange')).not.toHaveLength(0);
  });

  it('applies Oziach quest access identically to UI checks and exported permissions', () => {
    const state = { ...account(), merchants: ['Platebody Shops'] };
    const coord = { cx: 47, cy: 54 };
    expect(service.taskRequirements('Oziach (shop)', 'shop', 47, 54)).toContain('Dragon Slayer I Complete the quest');
    const status = () => buildChunkPermissionSnapshot(service.contentFor(47, 54)!, coord, { unlocks: state, contentService: service }).categories.SHOPS!.find(row => row.name === 'Oziach (shop)')!.status;
    expect(status()).toBe('NOT_READY');
    state.quests.push('Dragon Slayer I');
    expect(status()).toBe('ALLOWED');
  });

  it('keeps RFD stage identities and counts rescued guests, rather than all quest entries', () => {
    expect(canonicalQuestId("Recipe for Disaster/Freeing the Mountain Dwarf")).toBe('RFD: Dwarf');
    const gates = compileRawRequirements([{ raw: 'RFD Chest 3 Subquest', origin: 'ENTITY' }]);
    const state = { ...account(), quests: ['RFD: The Cook', 'RFD: Dwarf', 'RFD: Goblins', "Cook's Assistant"] };
    expect(evaluateRouteGates(gates, state).blockers).toHaveLength(1);
    state.quests.push('RFD: Pirate Pete');
    expect(evaluateRouteGates(gates, state).blockers).toHaveLength(0);
    expect(service.itemSourceRecords('Barrows gloves').some(row => row.rawRequirements.some(req => req.raw.includes('Defeating the Culinaromancer')))).toBe(true);
  });

  it('recognises the Mad Angel boss alias and quest display aliases', () => {
    expect(canonicalBossId('Mad Angel')).toBe('The Mad Angel');
    expect(canonicalQuestId('Desert Treasure II - The Fallen Empire')).toBe('Desert Treasure II');
    const state = { ...account(), chunks: ['39,34'] };
    const snapshot = buildChunkPermissionSnapshot(service.contentFor(39, 34)!, { cx: 39, cy: 34 }, { unlocks: state, gameModeId: 'chunked', contentService: service });
    expect(snapshot.categories.ACTIVITIES).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Mad Angel', status: 'LOCKED' })]));
    expect(snapshot.categories.COMBAT?.some(row => row.name === 'Mad Angel')).not.toBe(true);
  });

  it('matches Slayer families and preserves Konar location constraints', () => {
    for (const task of ['Bears', 'Dwarves', 'Trolls']) expect(service.slayerLocations(task).length, task).toBeGreaterThan(0);
    const tower = service.slayerLocations('Bloodvelds - Slayer Tower');
    expect(tower.length).toBeGreaterThan(0);
    expect(tower.every(hit => hit.location.locationName?.startsWith('Slayer Tower'))).toBe(true);
    expect(tower.some(hit => hit.location.locationName?.includes('Catacombs'))).toBe(false);
    expect(service.slayerReachIndex()['bloodvelds - slayer tower']).toEqual(expect.arrayContaining(tower.map(hit => ({ cx: hit.location.cx, cy: hit.location.cy }))));
    const state = account(); state.skills.Slayer = 10; state.levels.Slayer = 99;
    const reach = slayerReachability({ Example: { Bears: { weight: 1 } } }, state,
      () => ({ cx: 50, cy: 50, unlocked: false, accessStatus: 'UNKNOWN' }));
    expect(reach.masters[0].rows[0].status).toBe('access-unknown');
  });

  it('prefers an owned representative when a named place spans several chunks', () => {
    expect(summarisePlaces([{ cx: 49, cy: 50 }, { cx: 50, cy: 51 }], { ...account(), chunks: ['50,51'] }, 'chunked')[0]).toMatchObject({ cx: 50, cy: 51, unlocked: true });
  });

  it('keeps source coverage partial even after successfully loading the snapshot', () => {
    expect(service.ready).toBe(true);
    expect(service.itemSourceCoverage('Unknown future item')).toBe('PARTIAL');
  });
});

describe('ocean navigation and the complete land frontier', () => {
  it('gates ocean access and reaches all 624 land chunks without charging for water', () => {
    const state = account(); state.chunks = [];
    for (let i = 0; i < 100; i++) {
      const next = getChunkFrontier(state.chunks, state).map(chunkKey);
      if (!next.length) break; state.chunks.push(...next);
    }
    expect(state.chunks.length + 1).toBe(368);
    expect(checkUnlockAvailability(state).chunks).toBe(false);
    expect(chunkUnlocked(24, 41, state)).toBe(false);
    state.skills.Sailing = 10; state.levels.Sailing = 99; state.quests.push('Pandemonium');
    expect(chunkUnlocked(24, 41, state)).toBe(true);
    expect(checkUnlockAvailability(state).chunks).toBe(true);
    expect(randomUnlockPool(state, 'chunked', 'key', TableType.CHUNKS).map(row => row.item).sort()).toEqual(getChunkFrontier(state.chunks, state).map(chunkKey).sort());
    for (let i = 0; i < 100; i++) {
      const next = getChunkFrontier(state.chunks, state).map(chunkKey);
      if (!next.length) break; state.chunks.push(...next);
    }
    expect(new Set(['50,50', ...state.chunks])).toEqual(new Set(ALL_CHUNK_KEYS));
    expect(ALL_CHUNK_KEYS).toHaveLength(624);
    expect(checkUnlockAvailability(state).chunks).toBe(false);
  });
});

describe('collection identity and refresh failures', () => {
  it('folds duplicate Venator progress by max and never creates another reward ID', () => {
    expect(migrateClogIds({ 528089: 2, 532001: 1, 528090: 1 })).toEqual({ 532001: 2, 532002: 1 });
    const data = { Other: { name: 'Other', pages: { Venators: { name: 'Venators', items: [{ id: 532001, name: 'Venator tooth' }] }, Slayer: { name: 'Slayer', items: [{ id: 528001, name: 'Abyssal whip' }] } } } };
    expect(computeSync([{ id: 1, name: 'Venator tooth', tabs: ['Slayer'] }, { id: 2, name: 'Abyssal whip', tabs: ['Slayer'] }], data).additions).toEqual([]);
  });

  it('allocates globally unique finite IDs to empty pages and skips retired IDs', () => {
    const allocator = createCollectionIdAllocator([{ tab: 'Other', items: [{ id: 528088, name: 'Aquanite tendon' }] }]);
    const first = allocator('Other', []); const second = allocator('Other', []);
    expect(Number.isSafeInteger(first())).toBe(true); expect(second()).not.toBe(first());
    expect(allocator('Other', [{ id: 528088, name: 'Aquanite tendon' }])()).toBe(528091);
  });

  it('reports unknown freshness on outages and detects new quests independently of subquests', () => {
    const unavailable = buildReport({ quests: { app: 212, official: 184, wiki: null }, cas: { app: {}, wiki: null }, diaries: { app: {} } });
    expect(unavailable.status).toBe('UNKNOWN'); expect(unavailable.markdown).not.toContain('all tracked counts are consistent');
    const drift = buildReport({ quests: { app: 212, official: 184, wiki: { total: 185 } }, cas: { app: {}, wiki: {} }, diaries: { app: {} } });
    expect(drift.actions).toEqual(expect.arrayContaining([expect.stringContaining('Quests: wiki 185, app 184')]));
  });
});
