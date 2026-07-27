import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TableType, UnlockState } from '../types';
import { setStartArea } from '../utils/freeAreas';
import { ActivityAccessWarning, shouldShowActivityAccessWarning } from './ActivityAccessWarning';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';

const baseUnlocks: UnlockState = {
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
};

beforeEach(() => {
  setStartArea('none');
});

afterEach(() => {
  setStartArea(undefined);
});

describe('ActivityAccessWarning', () => {
  it('warns when a vanilla Omni selection is outside its required area', () => {
    const markup = renderToStaticMarkup(
      <ActivityAccessWarning activity="Giant Mole" table={TableType.BOSSES} unlocks={baseUnlocks} modeId="vanilla" />,
    );

    expect(markup).toContain('Omni Keys can unlock this now, but you still need access to: Falador.');
  });

  it('uses the shared Omni warning and availability decisions', () => {
    const silent: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      omniDirect: { allowsLocationIneligible: true, warnsPlayer: false },
    };
    const restricted: VanillaRandomAccessPolicy = {
      ...VANILLA_RANDOM_ACCESS_POLICY,
      omniDirect: { allowsLocationIneligible: false, warnsPlayer: true },
    };

    expect(shouldShowActivityAccessWarning(TableType.BOSSES, true, 'vanilla')).toBe(true);
    expect(shouldShowActivityAccessWarning(TableType.BOSSES, true, 'vanilla', silent)).toBe(false);
    expect(shouldShowActivityAccessWarning(TableType.BOSSES, true, 'vanilla', restricted)).toBe(false);
  });
  it('does not warn when the direct selection is accessible or outside vanilla', () => {
    const accessible = renderToStaticMarkup(
      <ActivityAccessWarning
        activity="Giant Mole"
        table={TableType.BOSSES}
        unlocks={{ ...baseUnlocks, regions: ['Falador'] }}
        modeId="vanilla"
      />,
    );
    const nonVanilla = renderToStaticMarkup(
      <ActivityAccessWarning activity="Giant Mole" table={TableType.BOSSES} unlocks={baseUnlocks} modeId="chunked" />,
    );

    expect(accessible).toBe('');
    expect(nonVanilla).toBe('');
  });
});
