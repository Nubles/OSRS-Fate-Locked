import { TableType } from '../types';

export interface DashboardPoolTarget {
  target: 'tab:CHARACTER' | 'tab:WORLD' | 'tab:ACTIVITIES';
  activityCategory?: string;
}

const ACTIVITY_CATEGORY: Partial<Record<TableType, string>> = {
  [TableType.BOSSES]: 'BOSSES',
  [TableType.MINIGAMES]: 'MINIGAMES',
  [TableType.FARMING_LAYERS]: 'FARMING',
  [TableType.MOBILITY]: 'MOBILITY',
  [TableType.GUILDS]: 'GUILDS',
  [TableType.ARCANA]: 'ARCANA',
  [TableType.POH]: 'POH',
  [TableType.STORAGE]: 'STORAGE',
  [TableType.MERCHANTS]: 'MERCHANTS',
  [TableType.SLAYER_UNLOCKS]: 'SLAYER',
  [TableType.BANKS]: 'BANKS',
};

export const dashboardPoolTarget = (table: TableType): DashboardPoolTarget => {
  if (table === TableType.EQUIPMENT || table === TableType.SKILLS) {
    return { target: 'tab:CHARACTER' };
  }
  if (table === TableType.REGIONS || table === TableType.CHUNKS) {
    return { target: 'tab:WORLD' };
  }
  const activityCategory = ACTIVITY_CATEGORY[table];
  if (!activityCategory) {
    throw new Error(`No dashboard pool target for ${table}`);
  }
  return { target: 'tab:ACTIVITIES', activityCategory };
};

export const openDashboardPool = (table: TableType): void => {
  window.dispatchEvent(new CustomEvent('fate:nav', {
    detail: dashboardPoolTarget(table),
  }));
};
