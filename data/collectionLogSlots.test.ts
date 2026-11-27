import { describe, expect, it } from 'vitest';
import { COLLECTION_LOG_DATA } from './collectionLogData';
import { sharedSlotCount, sharedSlotIds, withSharedSlots } from './collectionLogSlots';

const entries = Object.entries(COLLECTION_LOG_DATA).flatMap(([tab, { pages }]) =>
  Object.entries(pages).flatMap(([page, { items }]) => items.map(item => ({ ...item, page: `${tab}/${page}` }))));
const byId = new Map(entries.map(entry => [entry.id, entry]));
const groups = [...new Set(entries.map(entry => sharedSlotIds(entry.id)).filter(ids => ids.length > 1))];
const named = (name: string) => entries.filter(entry => entry.name === name).map(entry => entry.id);

describe('which collection log entries are one item', () => {
  it('groups the same item across pages (Wiki: a slot is shared by every page that lists it)', () => {
    expect([...sharedSlotIds(109002)].sort()).toEqual([107003, 109002, 127006, 128003, 147003, 148003]);
    expect([...sharedSlotIds(110001)].sort()).toEqual([109001, 110001, 502005]);
    // The Wiki's own data (Module:Collection_log/data.json, fetched 24 Nov 2026)
    // lists 155 items on more than one page, 210 page entries beyond the first.
    expect(groups.length).toBeGreaterThanOrEqual(155);
    expect(groups.reduce((sum, ids) => sum + ids.length - 1, 0)).toBeGreaterThanOrEqual(210);
  });

  it('keeps every group to one item: one exact name, at most one entry per page', () => {
    for (const ids of groups) {
      expect(new Set(ids.map(id => byId.get(id)!.name)).size).toBe(1);
      expect(new Set(ids.map(id => byId.get(id)!.page)).size).toBe(ids.length);
    }
  });

  it('keeps same-name slots on one page apart, and their namesakes on other pages', () => {
    // My Notes: 13 "Ancient page" and 13 "Ancient page (2)" are different pages of the book;
    // "Ancient page 2" on Shared Treasure Trail Rewards is another item again.
    for (const name of ['Ancient page', 'Ancient page (2)', 'Ancient page 2', 'Mysterious page']) {
      const ids = named(name);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(sharedSlotIds(id)).toEqual([id]);
    }
    expect(named('Ancient page').length).toBe(13);
    expect(named('Mysterious page').length).toBe(5);
    // Names the Wiki tells apart stay apart.
    for (const name of ['Castlewars hood (Saradomin)', 'Castlewars hood (Zamorak)', 'Medallion fragment (1)', 'Medallion fragment (2)']) {
      const [id] = named(name);
      expect(sharedSlotIds(id)).toEqual([id]);
    }
  });

  it('reads a count across the group, never from or onto an id held for review', () => {
    const log = { 109002: 2 };
    expect(sharedSlotCount(log, 128003)).toBe(2);
    expect(sharedSlotCount(log, 128003, new Set([109002]))).toBe(0);
    expect(withSharedSlots(log, new Set([128003]))).toMatchObject({ 109002: 2, 107003: 2 });
    expect(withSharedSlots(log, new Set([128003]))[128003]).toBeUndefined();
    expect(withSharedSlots({ 101005: 1 })).toEqual({ 101005: 1 });
    expect(withSharedSlots({ 101001: 1 })).toEqual({ 101001: 1, 502001: 1 });
  });
});
