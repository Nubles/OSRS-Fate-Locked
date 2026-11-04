import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DropSource } from '../../types';
import { DROP_RATES } from '../../config/rules';
import { completionDenominator } from '../../utils/completion';
import { MINIGAMES_LIST } from '../../data/items';
import { balanceInputs } from './inputs';
import { run, simulate, SCENARIOS, scenarioName } from './roll-sim.mjs';
import { diffPaths, renderReport, runAll } from './report.mjs';

const inputs = JSON.parse(JSON.stringify(balanceInputs()));

describe('balance check inputs', () => {
  it('reads the live rules and content', () => {
    // Hitpoints' ten tiers are free.
    expect(inputs.content.unlocks.vanilla).toBe(completionDenominator('vanilla') - 10);
    expect(inputs.content.unlocks.chunked).toBe(completionDenominator('chunked') - 10);
    expect(inputs.rules.quest[DropSource.QUEST_MASTER].rate).toBe(DROP_RATES[DropSource.QUEST_MASTER]);
    expect(inputs.rules.slayer.duradel.rate).toBe(DROP_RATES[DropSource.SLAYER_DURADEL]);
    expect(inputs.rules.levelChance[99]).toBeGreaterThan(inputs.rules.levelChance[2]);
    expect(inputs.content.minigames).toHaveLength(MINIGAMES_LIST.length);
    for (const mg of inputs.content.minigames) expect(mg.rates.length).toBeGreaterThan(0);
  });
});

describe('roll simulation', () => {
  it('plays the same run for the same seed and always finishes', () => {
    const a = run(inputs, { mode: 'vanilla', profile: 'main', seed: 7 });
    const b = run(inputs, { mode: 'vanilla', profile: 'main', seed: 7 });
    expect(a).toEqual(b);
    expect(a.unlockedEnd).toBe(a.S);
    expect(a.rollsAt100).toBeGreaterThan(0);
    const c = run(inputs, { mode: 'chunked', profile: 'bare', seed: 7 });
    expect(c.unlockedEnd).toBe(c.S);
    expect(c.keysFrom['chunk exploring']).toBeGreaterThan(0);
  });

  it('needs more rolls when Keys get harder to win', () => {
    const harder = JSON.parse(JSON.stringify(inputs));
    for (const src of Object.values(harder.rules.slayer) as { rate: number }[]) src.rate /= 2;
    const s = { mode: 'vanilla', profile: 'main' };
    expect(simulate(harder, s, 20).rollsAt100.med).toBeGreaterThan(simulate(inputs, s, 20).rollsAt100.med);
  });
});

describe('balance report', () => {
  it('flags a move past 5% and names the numbers that changed', () => {
    const results = runAll(inputs, 5);
    const name = scenarioName(SCENARIOS[0]);
    const old = JSON.parse(JSON.stringify({ runs: 5, inputs, results }));
    old.results[name].rollsAt100.med = Math.round(results[name].rollsAt100.med * 0.8);
    old.inputs.rules.quest[DropSource.QUEST_NOVICE].rate = 20;
    const { markdown, flags } = renderReport({ inputs, results, runs: 5, baseline: old });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toContain(name);
    expect(markdown).toContain('`rules.quest.Quest (Novice).rate` | 20 | 25');
  });

  it('says so when nothing changed', () => {
    const results = runAll(inputs, 3);
    const { markdown, flags } = renderReport({ inputs, results, runs: 3, baseline: { runs: 3, inputs, results } });
    expect(flags).toEqual([]);
    expect(markdown).toContain('No rule or content numbers changed.');
  });

  it('diffs nested values by path', () => {
    expect(diffPaths({ a: { b: 1, c: [1] } }, { a: { b: 2, c: [1] }, d: 3 })).toEqual([
      { path: 'a.b', was: 1, now: 2 },
      { path: 'd', was: undefined, now: 3 },
    ]);
  });

  it('keeps a baseline for every play style', () => {
    const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
    expect(Object.keys(baseline.results).sort()).toEqual(SCENARIOS.map(scenarioName).sort());
  });
});
