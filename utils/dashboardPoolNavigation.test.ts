import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { dashboardPoolTarget } from './dashboardPoolNavigation';

describe('dashboardPoolTarget', () => {
  it.each([
    [TableType.EQUIPMENT, { target: 'tab:CHARACTER' }],
    [TableType.SKILLS, { target: 'tab:CHARACTER' }],
    [TableType.REGIONS, { target: 'tab:WORLD' }],
    [TableType.CHUNKS, { target: 'tab:WORLD' }],
    [TableType.BOSSES, { target: 'tab:ACTIVITIES', activityCategory: 'BOSSES' }],
    [TableType.MINIGAMES, { target: 'tab:ACTIVITIES', activityCategory: 'MINIGAMES' }],
    [TableType.FARMING_LAYERS, { target: 'tab:ACTIVITIES', activityCategory: 'FARMING' }],
    [TableType.MOBILITY, { target: 'tab:ACTIVITIES', activityCategory: 'MOBILITY' }],
    [TableType.GUILDS, { target: 'tab:ACTIVITIES', activityCategory: 'GUILDS' }],
    [TableType.ARCANA, { target: 'tab:ACTIVITIES', activityCategory: 'ARCANA' }],
    [TableType.POH, { target: 'tab:ACTIVITIES', activityCategory: 'POH' }],
    [TableType.STORAGE, { target: 'tab:ACTIVITIES', activityCategory: 'STORAGE' }],
    [TableType.MERCHANTS, { target: 'tab:ACTIVITIES', activityCategory: 'MERCHANTS' }],
    [TableType.SLAYER_UNLOCKS, { target: 'tab:ACTIVITIES', activityCategory: 'SLAYER' }],
    [TableType.BANKS, { target: 'tab:ACTIVITIES', activityCategory: 'BANKS' }],
  ])('maps %s to its existing dashboard pool', (table, expected) => {
    expect(dashboardPoolTarget(table)).toEqual(expected);
  });

  it('throws rather than guessing for an unmapped table', () => {
    expect(() => dashboardPoolTarget(TableType.QUESTS)).toThrow(/No dashboard pool target/);
  });
});
