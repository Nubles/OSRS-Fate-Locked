import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TableType, UnlockState } from '../types';
import { setStartArea } from '../utils/freeAreas';
import { ActivityAccessWarning } from './ActivityAccessWarning';

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
