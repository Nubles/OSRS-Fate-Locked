import { afterEach, describe, expect, it } from 'vitest';
import { UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import { getActivityAccess } from './activityAccess';

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

const makeUnlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({ ...baseUnlocks, ...overrides });

afterEach(() => {
  setStartArea(undefined);
});

describe('getActivityAccess', () => {
  it('requires the literal named area for Pest Control and Last Man Standing', () => {
    setStartArea('none');

    expect(getActivityAccess('Pest Control', makeUnlocks(), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: ["Void Knights' Outpost"],
      explanation: "Needs Void Knights' Outpost",
    });
    expect(getActivityAccess('Pest Control', makeUnlocks({ regions: ["Void Knights' Outpost"] }), 'vanilla').eligible).toBe(
      true,
    );

    expect(getActivityAccess('Last Man Standing', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Last Man Standing', makeUnlocks({ regions: ['Ferox Enclave'] }), 'vanilla').eligible).toBe(
      true,
    );
  });

  it('uses Falador for Giant Mole and Edgeville for Obor', () => {
    setStartArea('none');

    expect(getActivityAccess('Giant Mole', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Giant Mole', makeUnlocks({ regions: ['Falador'] }), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Obor', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Obor', makeUnlocks({ regions: ['Edgeville'] }), 'vanilla').eligible).toBe(true);
  });

  it("requires Wizards' Tower for Guardians of the Rift rather than Al Kharid", () => {
    setStartArea('none');

    expect(getActivityAccess('Guardians of the Rift', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Guardians of the Rift', makeUnlocks({ regions: ['Al Kharid'] }), 'vanilla').eligible).toBe(
      false,
    );
    expect(
      getActivityAccess('Guardians of the Rift', makeUnlocks({ regions: ["Wizards' Tower"] }), 'vanilla').eligible,
    ).toBe(true);
  });

  it('requires Forgotten Cemetery for Crazy Archaeologist', () => {
    setStartArea('none');

    expect(getActivityAccess('Crazy Archaeologist', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(
      getActivityAccess('Crazy Archaeologist', makeUnlocks({ regions: ['Forgotten Cemetery'] }), 'vanilla').eligible,
    ).toBe(true);
  });

  it('allows any declared geographic gateway', () => {
    setStartArea('none');

    expect(getActivityAccess('Temple Trekking', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Burgh de Rott'] }), 'vanilla').eligible).toBe(
      true,
    );
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Paterdomus'] }), 'vanilla').eligible).toBe(true);
  });

  it('keeps explicit non-gates eligible without any area unlocks', () => {
    setStartArea('none');

    for (const activity of ['Mimic', 'Shooting Stars', 'Mahogany Homes', 'Forestry', 'Rat Pits']) {
      expect(getActivityAccess(activity, makeUnlocks(), 'vanilla')).toEqual({
        eligible: true,
        requiredAreas: [],
        explanation: '',
      });
    }
  });

  it('does not consider skills, quests, items, or combat state', () => {
    setStartArea('none');

    const geographicOnly = getActivityAccess(
      'Pest Control',
      makeUnlocks({ regions: ["Void Knights' Outpost"] }),
      'vanilla',
    );
    const withOtherRequirements = getActivityAccess(
      'Pest Control',
      makeUnlocks({
        regions: ["Void Knights' Outpost"],
        equipment: { Bronze: 0 },
        skills: { Combat: 1 },
        levels: { Combat: 3 },
        quests: [],
      }),
      'vanilla',
    );

    expect(withOtherRequirements).toEqual(geographicOnly);
  });

  it('preserves eligibility in non-vanilla modes', () => {
    setStartArea('none');

    expect(getActivityAccess('Pest Control', makeUnlocks(), 'chunked')).toEqual({
      eligible: true,
      requiredAreas: [],
      explanation: '',
    });
  });

  it('fails closed for a missing vanilla activity declaration', () => {
    setStartArea('none');

    expect(getActivityAccess('Unknown activity', makeUnlocks(), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: [],
      explanation: 'Missing location declaration',
    });
  });

  it('fails closed for inherited object property names', () => {
    setStartArea('none');

    for (const activity of ['toString', '__proto__']) {
      expect(getActivityAccess(activity, makeUnlocks(), 'vanilla')).toEqual({
        eligible: false,
        requiredAreas: [],
        explanation: 'Missing location declaration',
      });
    }
  });
});
