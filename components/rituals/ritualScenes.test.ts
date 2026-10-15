// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RITUALS, type Ritual } from '../../config/economy';
import { RITUAL_SCENES, type RitualSceneInput } from './ritualScenes';
import { playScene } from './ritualStage';

// jsdom has no Web Animations or canvas; the scenes only need them to exist.
beforeAll(() => {
  Element.prototype.animate = function animate() {
    return { finish() {}, cancel() {} } as unknown as Animation;
  };
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => { document.body.innerHTML = ''; });

const lastFrame = (ritual: Ritual['id'], input: RitualSceneInput) => {
  const host = document.createElement('div');
  document.body.append(host);
  const onDone = vi.fn();
  const player = playScene(host, RITUAL_SCENES[ritual], input, { reducedMotion: true, onDone });
  const read = (sel: string) => host.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
  const frame = { title: read('.ritual-title'), dialog: read('.ritual-dialog-text'), text: host.textContent ?? '' };
  player.destroy();
  expect(onDone).toHaveBeenCalledTimes(1);
  return frame;
};

describe('ritual scenes', () => {
  it('gives every Void Altar ritual its own scene', () => {
    expect(Object.keys(RITUAL_SCENES).sort()).toEqual(RITUALS.map(r => r.id).sort());
    expect(new Set(Object.values(RITUAL_SCENES)).size).toBe(RITUALS.length);
  });

  it.each(RITUALS.map(r => [r.id, r.name] as const))('%s lands on its title and a dialog that can be clicked through', (id, name) => {
    const frame = lastFrame(id, { meta: { type: id }, ownedChunks: [] });
    expect(frame.title).toBe(name);
    expect(frame.dialog).toMatch(/Click here to continue$/);
  });

  it('shows what a Gambit won or lost', () => {
    expect(lastFrame('GAMBIT', { meta: { type: 'GAMBIT', won: true, stake: 48, keysWon: 3 }, ownedChunks: [] }).dialog)
      .toContain('The Void blinks. You win 3 Keys.');
    expect(lastFrame('GAMBIT', { meta: { type: 'GAMBIT', won: false, stake: 48, keysWon: 0 }, ownedChunks: [] }).dialog)
      .toContain('The Void keeps your 48 Fate.');
  });

  it('names the chunk the Cartographer charted', () => {
    const frame = lastFrame('CARTOGRAPHER', { meta: { type: 'CARTOGRAPHER', chunk: '48,51' }, ownedChunks: ['49,51', '48,51'] });
    expect(frame.dialog).toContain('You chart a course to Draynor Village.');
    expect(frame.text).toContain('Draynor Village');
  });
});
