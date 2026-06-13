import { describe, it, expect } from 'vitest';
import { runTurn } from './dispatcher';
import { LocalBackend } from './localBackend';
import type { AssistantContext } from '../types';

const ctx = (regions: string[] = []): AssistantContext =>
  ({ unlocks: { regions, quests: [], skills: {}, levels: {} } as any });

const backend = new LocalBackend();

describe('runTurn (local backend, grounded tools)', () => {
  it('answers a navigation request with a map action', async () => {
    const r = await runTurn('go to Varrock', backend, ctx());
    expect(r.text).toMatch(/Varrock/);
    expect(r.actions.some(a => a.kind === 'map')).toBe(true);
  });

  it('opens a tab via a tab action', async () => {
    const r = await runTurn('open the Journal tab', backend, ctx());
    expect(r.actions[0]).toMatchObject({ kind: 'tab', payload: { target: 'tab:JOURNAL' } });
  });

  it('explains an unknown quest gracefully', async () => {
    const r = await runTurn('why is Totally Fake Quest locked?', backend, ctx());
    expect(r.text).toMatch(/don't have a quest/i);
  });

  it('falls back with examples when it cannot parse', async () => {
    const r = await runTurn('hello', backend, ctx());
    expect(r.text).toMatch(/where can I find/i);
    expect(r.actions).toHaveLength(0);
  });
});
