import { describe, expect, it } from 'vitest';
import type { TravelMethod } from '../data/travelMethods';
import { hasDiaryTier, hasTravelUnlock, travelDecisions, type TravelContext } from './travelDecisions';

const nothing = { mobility: [], arcana: [], housing: [], diaries: [] };
const context = (changes: Partial<TravelContext> = {}): TravelContext => ({
  unlocks: nothing,
  entries: { '50,50': 'ALLOWED', '46,52': 'LOCKED', '52,52': 'NOT_READY' },
  ...changes,
});
const method = (changes: Partial<TravelMethod>): TravelMethod => ({
  id: 'test', label: 'Test', unlocks: [], match: { items: [1] }, options: {}, source: 'test', ...changes,
});

describe('hasTravelUnlock', () => {
  it('looks an unlock up in the list it belongs to', () => {
    const unlocks = { mobility: ['Teleport Tablets'], arcana: ['Ancient Magicks'], housing: ['Mounted Glory'], diaries: [] };
    expect(['Teleport Tablets', 'Ancient Magicks', 'Mounted Glory'].map((id) => hasTravelUnlock(unlocks, id)))
      .toEqual([true, true, true]);
    expect(hasTravelUnlock(nothing, 'Teleport Tablets')).toBe(false);
    // An arcana id held under mobility doesn't count, and nor does an unknown id.
    expect(hasTravelUnlock({ ...nothing, mobility: ['Ancient Magicks'] }, 'Ancient Magicks')).toBe(false);
    expect(hasTravelUnlock({ ...nothing, mobility: ['Not An Unlock'] }, 'Not An Unlock')).toBe(false);
  });
});

describe('hasDiaryTier', () => {
  it('counts the tier, or a harder tier of the same diary', () => {
    expect(hasDiaryTier(['Varrock Medium'], 'Varrock Medium')).toBe(true);
    expect(hasDiaryTier(['Varrock Hard'], 'Varrock Medium')).toBe(true);
    expect(hasDiaryTier(['Varrock Elite'], 'Varrock Medium')).toBe(true);
    expect(hasDiaryTier(['Varrock Easy'], 'Varrock Medium')).toBe(false);
    expect(hasDiaryTier([], 'Varrock Medium')).toBe(false);
  });

  it("doesn't count another diary, even one in the same region", () => {
    // The Ardougne and Kandarin diaries are both in Kandarin.
    expect(hasDiaryTier(['Kandarin Elite'], 'Ardougne Hard')).toBe(false);
    expect(hasDiaryTier(['Falador Elite'], 'Varrock Medium')).toBe(false);
  });

  it('matches a diary it has no data for by its id only', () => {
    expect(hasDiaryTier(['Made Up Hard'], 'Made Up Hard')).toBe(true);
    expect(hasDiaryTier(['Made Up Elite'], 'Made Up Hard')).toBe(false);
  });
});

describe('travelDecisions', () => {
  it('locks every option while an unlock the method needs is locked, whatever the destination', () => {
    const tablet = method({
      unlocks: ['Teleport Tablets'],
      options: { Break: { to: ['50,50'] }, Rub: { to: ['50,50', '46,52'] } },
    });
    expect(travelDecisions([tablet], context()).test.options).toEqual({
      Break: { to: ['50,50'], status: 'LOCKED', reason: 'Needs Teleport Tablets' },
      Rub: { to: ['50,50', '46,52'], status: 'LOCKED', reason: 'Needs Teleport Tablets' },
    });
  });

  it("gives an option with one destination that chunk's entry", () => {
    const options = {
      Here: { to: ['50,50'] }, Falador: { to: ['46,52'] }, Senntisten: { to: ['52,52'] }, Nowhere: { to: ['1,1'] },
    };
    const decided = travelDecisions([method({ options })], context({ reasons: { '46,52': 'Unlock Falador' } })).test.options;
    expect(decided.Here).toEqual({ to: ['50,50'], status: 'ALLOWED' });
    expect(decided.Falador).toEqual({ to: ['46,52'], status: 'LOCKED', reason: 'Unlock Falador' });
    expect(decided.Senntisten).toEqual({ to: ['52,52'], status: 'NOT_READY', reason: "The destination isn't ready" });
    expect(decided.Nowhere).toEqual({ to: ['1,1'], status: 'UNKNOWN', reason: "The destination's access needs review" });
  });

  it('leaves an option with several destinations, or none, UNKNOWN', () => {
    const options = { Rub: { to: ['50,50', '46,52'] }, Same: { to: ['50,50', '50,50'] }, Anywhere: { to: [] } };
    const decided = travelDecisions([method({ options })], context()).test.options;
    expect(decided.Rub).toEqual({ to: ['50,50', '46,52'], status: 'UNKNOWN', reason: 'Goes to one of several places' });
    expect(decided.Same).toEqual({ to: ['50,50'], status: 'ALLOWED' });
    expect(decided.Anywhere).toEqual({ to: [], status: 'UNKNOWN', reason: 'Where it goes is unknown' });
  });

  it('adds the destination a diary lets the player switch to, once it is done', () => {
    const varrock = method({ options: { Cast: { to: ['50,50'], afterDiary: { diary: 'Varrock Medium', to: ['46,52'] } } } });
    expect(travelDecisions([varrock], context()).test.options.Cast).toEqual({ to: ['50,50'], status: 'ALLOWED' });
    expect(travelDecisions([varrock], context({ unlocks: { ...nothing, diaries: ['Varrock Medium'] } })).test.options.Cast)
      .toEqual({ to: ['50,50', '46,52'], status: 'UNKNOWN', reason: 'Goes to one of several places' });
    expect(travelDecisions([varrock], context({ unlocks: { ...nothing, diaries: ['Varrock Elite'] } })).test.options.Cast.to)
      .toEqual(['50,50', '46,52']);
  });

  it("asks for an option's own quests on top of its destination", () => {
    const crystal = method({
      unlocks: ['Crystal Teleport Seed'],
      options: { Done: { to: ['50,50'], quests: ['Song of the Elves'] }, Locked: { to: ['46,52'], quests: ['Song of the Elves'] } },
    });
    const decide = (quests?: string[], mobility = ['Crystal Teleport Seed']) =>
      travelDecisions([crystal], context({ unlocks: { ...nothing, mobility, ...(quests ? { quests } : {}) } })).test.options;
    expect(decide([])).toEqual({
      Done: { to: ['50,50'], status: 'NOT_READY', reason: 'Needs Song of the Elves' },
      // A locked destination stays locked, quest or not.
      Locked: { to: ['46,52'], status: 'LOCKED', reason: 'The destination is locked' },
    });
    // A run whose quests the context doesn't give hasn't done them.
    expect(decide().Done.status).toBe('NOT_READY');
    expect(decide(['Song of the Elves']).Done).toEqual({ to: ['50,50'], status: 'ALLOWED' });
    // The method's unlock comes first.
    expect(decide(['Song of the Elves'], []).Done).toEqual({ to: ['50,50'], status: 'LOCKED', reason: 'Needs Crystal Teleport Seed' });
  });

  it('leaves an allowed option UNKNOWN while a quest it needs only started is not done', () => {
    const crystal = method({
      options: {
        Here: { to: ['50,50'], startedQuests: ["Mourning's End Part I"] },
        Later: { to: ['52,52'], startedQuests: ["Mourning's End Part I"] },
      },
    });
    const decide = (quests: string[]) => travelDecisions([crystal], context({ unlocks: { ...nothing, quests } })).test.options;
    expect(decide([])).toEqual({
      Here: { to: ['50,50'], status: 'UNKNOWN', reason: "Needs Mourning's End Part I started" },
      Later: { to: ['52,52'], status: 'NOT_READY', reason: "The destination isn't ready" },
    });
    expect(decide(["Mourning's End Part I"]).Here).toEqual({ to: ['50,50'], status: 'ALLOWED' });
  });

  it('keeps what identifies a method, and decides fairy ring codes like options', () => {
    const ring = method({
      id: 'network:fairy-ring', label: 'Fairy ring', unlocks: ['Fairy Rings'], match: { objects: [29495] },
      options: { Zanaris: { to: ['37,69'] } }, advisory: true, codes: { CKS: { to: ['54,54'] } },
    });
    const decided = travelDecisions([ring], context({ unlocks: { ...nothing, mobility: ['Fairy Rings'] } }))['network:fairy-ring'];
    expect(decided).toEqual({
      label: 'Fairy ring', unlocks: ['Fairy Rings'], match: { objects: [29495] }, advisory: true,
      options: { Zanaris: { to: ['37,69'], status: 'UNKNOWN', reason: "The destination's access needs review" } },
      codes: { CKS: { to: ['54,54'], status: 'UNKNOWN', reason: "The destination's access needs review" } },
    });
  });
});
