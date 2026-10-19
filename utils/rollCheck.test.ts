import { afterEach, describe, expect, it } from 'vitest';
import { askBeforeRoll, getRollCheck, setRollCheckOn } from './rollCheck';

describe('askBeforeRoll', () => {
  afterEach(() => setRollCheckOn(false));

  it('rolls at once while the check is off', async () => {
    await expect(askBeforeRoll()).resolves.toBe(true);
    expect(getRollCheck()).toBeNull();
  });

  it('waits for the answer while on', async () => {
    setRollCheckOn(true);
    const yes = askBeforeRoll('Did you reach Attack level 2 in game?');
    expect(getRollCheck()?.question).toBe('Did you reach Attack level 2 in game?');
    getRollCheck()!.answer(true);
    await expect(yes).resolves.toBe(true);

    const no = askBeforeRoll();
    expect(getRollCheck()?.question).toBe('Did you finish this in game?');
    getRollCheck()!.answer(false);
    await expect(no).resolves.toBe(false);
    expect(getRollCheck()).toBeNull();
  });

  it('a second click while one question waits does not roll', async () => {
    setRollCheckOn(true);
    const first = askBeforeRoll();
    await expect(askBeforeRoll()).resolves.toBe(false);
    getRollCheck()!.answer(true);
    await expect(first).resolves.toBe(true);
  });

  it('a question left waiting when the check goes off does not roll', async () => {
    setRollCheckOn(true);
    const waiting = askBeforeRoll();
    setRollCheckOn(false);
    await expect(waiting).resolves.toBe(false);
    expect(getRollCheck()).toBeNull();
  });
});
