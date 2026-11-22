// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../types';

const game = vi.hoisted(() => ({
  history: [{ id: 'a', timestamp: Date.UTC(2026, 9, 1), type: 'ROLL_FAIL', message: 'No Key.' }] as LogEntry[],
  unlocks: { regions: [], chunks: [], skills: { Hitpoints: 10 }, equipment: {}, levels: {} },
  gameModeId: 'vanilla',
}));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ activeProfileName: 'Test' }) }));
vi.mock('./rituals/ritualAssets', () => ({ loadRitualFonts: async () => undefined, RS_FONT: 'a', RS_BOLD: 'b' }));
vi.mock('../utils/runFilm/painter', async (orig) => {
  const real = await orig<typeof import('../utils/runFilm/painter')>();
  class FilmPainter { paint() {} }
  return { ...real, FilmPainter };
});
// The encoder: draws every frame, then "finalises" until we let it go (as mediabunny's finalize does).
const gate = vi.hoisted(() => ({ release: null as null | (() => void) }));
vi.mock('../utils/runFilm/encode', async (orig) => {
  const real = await orig<typeof import('../utils/runFilm/encode')>();
  return {
    ...real,
    encodeFilm: async (o: any) => {
      for (let i = 0; i < o.frames; i++) { o.draw(i); o.onProgress?.(i + 1, o.frames); }
      await new Promise<void>(r => { gate.release = r; });
      return { blob: new Blob(['x'], { type: 'video/mp4' }), ext: 'mp4', mime: 'video/mp4' };
    },
  };
});
class FakeImage { onload: any; onerror: any; decoding = ''; width = 25; height = 25; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } }
(globalThis as any).Image = FakeImage;
(URL as any).createObjectURL = () => 'blob:x';
(URL as any).revokeObjectURL = () => undefined;

import { RunFilmModal } from './RunFilmModal';
afterEach(cleanup);

describe('RunFilmModal Stop', () => {
  it('goes back to the start when Stop lands while the film is finalising', async () => {
    render(<RunFilmModal onClose={() => undefined} />);
    fireEvent.click(screen.getByText(/Make my film/));
    await waitFor(() => expect(gate.release).not.toBeNull());
    fireEvent.click(screen.getByText('Stop'));
    await act(async () => { gate.release!(); await new Promise(r => setTimeout(r, 20)); });
    expect(screen.queryByText(/Making your film/)).toBeNull();
    expect(screen.queryByText('Stop')).toBeNull();
    expect((screen.getByText(/Make my film/).closest('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
