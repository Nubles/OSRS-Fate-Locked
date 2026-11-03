import { afterEach, describe, expect, it, vi } from 'vitest';
import { paletteShortcut } from './paletteShortcut';

afterEach(() => vi.unstubAllGlobals());

describe('paletteShortcut', () => {
  it('shows Ctrl+K on Windows and ⌘K on a Mac', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows NT 10.0' });
    expect(paletteShortcut()).toBe('Ctrl+K');
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Macintosh' });
    expect(paletteShortcut()).toBe('⌘K');
  });
});
