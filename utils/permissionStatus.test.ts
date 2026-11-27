import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { evaluateEntityRequirements } from './entityAccess';
import { leastUsable, mostUsable, routeStatus } from './permissionStatus';
import { compileRawRequirements, evaluateRouteGates } from './questRoutes/accountRequirements';

describe('mostUsable', () => {
  it('takes the alternative closest to usable', () => {
    expect(mostUsable(['LOCKED', 'ALLOWED'])).toBe('ALLOWED');
    expect(mostUsable(['NOT_READY', 'UNKNOWN', 'LOCKED'])).toBe('UNKNOWN');
    expect(mostUsable(['LOCKED', 'NOT_READY'])).toBe('NOT_READY');
    expect(mostUsable(['LOCKED', 'LOCKED'])).toBe('LOCKED');
    expect(mostUsable([])).toBeUndefined();
  });
});

describe('leastUsable', () => {
  it('takes the condition furthest from usable', () => {
    expect(leastUsable('ALLOWED', 'LOCKED')).toBe('LOCKED');
    expect(leastUsable('UNKNOWN', 'NOT_READY')).toBe('NOT_READY');
    expect(leastUsable('ALLOWED', 'UNKNOWN')).toBe('UNKNOWN');
    expect(leastUsable('ALLOWED')).toBe('ALLOWED');
    expect(leastUsable()).toBe('ALLOWED');
  });
});

describe('routeStatus (status-precedence)', () => {
  const fresh = structuredClone(initialState.unlocks);
  const status = (requirements: string[], quests: string[] = []) =>
    routeStatus(evaluateRouteGates(compileRawRequirements(requirements.map((raw) => ({ raw, origin: 'ENTITY' as const }))),
      { ...fresh, quests }), quests);

  it('reads a route with one plainly unmet requirement as not ready, whatever else it has', () => {
    expect(status([])).toBe('ALLOWED');
    expect(status(['Cook\'s Assistant Complete the quest', 'Test: a task needs confirmation'])).toBe('NOT_READY');
    expect(status(['Mining level 99', 'Started Ratcatchers'])).toBe('NOT_READY');
    // A finished quest closes this room: definite, not a data gap.
    expect(status(['The Depths of Despair: lower chamber before quest completion'], ['The Depths of Despair'])).toBe('NOT_READY');
  });

  it('reads a route as unknown only when every blocker is one the save cannot answer', () => {
    expect(status(['Test: a task needs confirmation'])).toBe('UNKNOWN');
    expect(status(['Started Ratcatchers', 'Test: a task needs confirmation'])).toBe('UNKNOWN');
    expect(status(["Cook's Assistant Complete the quest", 'Test: a task needs confirmation'], ["Cook's Assistant"])).toBe('UNKNOWN');
  });

  it('is what an entity with source requirements reads as', () => {
    const source = (requirements: string[]) => ({ taskRequirements: () => requirements, chunkEntryRequirements: () => [] });
    const unknowable = source(['Test: a task needs confirmation']);
    expect(evaluateEntityRequirements('Test thing', 'object', { cx: 50, cy: 50 }, fresh, unknowable).status).toBe('UNKNOWN');
    const blocked = source(["Cook's Assistant Complete the quest", 'Test: a task needs confirmation']);
    expect(evaluateEntityRequirements('Test thing', 'object', { cx: 50, cy: 50 }, fresh, blocked).status).toBe('NOT_READY');
  });
});
