import { describe, expect, it, vi } from 'vitest';
import { downloadFateSave, type FateSaveDownloadEnvironment } from './fateSaveFile';

const makeEnvironment = () => {
  const anchor = { href: '', download: '', click: vi.fn() };
  const markExported = vi.fn();
  const revokeObjectURL = vi.fn();
  const environment: FateSaveDownloadEnvironment = {
    now: () => 123,
    createObjectURL: () => 'blob:test-save',
    revokeObjectURL,
    createAnchor: () => anchor,
    markExported,
  };
  return { anchor, environment, markExported, revokeObjectURL };
};

describe('downloadFateSave', () => {
  it('downloads encoded current state and marks the profile exported', () => {
    const test = makeEnvironment();

    const result = downloadFateSave('{"keys":9}', 'profile', test.environment);

    expect(result).toEqual({ ok: true });
    expect(test.anchor.href).toBe('blob:test-save');
    expect(test.anchor.download).toBe('fate_locked_123.fate');
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.markExported).toHaveBeenCalledWith('profile');
    expect(test.revokeObjectURL).toHaveBeenCalledWith('blob:test-save');
  });

  it('returns a safe error without marking export for invalid data', () => {
    const test = makeEnvironment();

    const result = downloadFateSave('{bad', 'profile', test.environment);

    expect(result).toEqual({ ok: false, message: 'Export failed' });
    expect(test.anchor.click).not.toHaveBeenCalled();
    expect(test.markExported).not.toHaveBeenCalled();
    expect(test.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('releases the object URL and does not mark export when download fails', () => {
    const test = makeEnvironment();
    test.anchor.click.mockImplementation(() => { throw new Error('blocked'); });

    const result = downloadFateSave('{"keys":9}', 'profile', test.environment);

    expect(result).toEqual({ ok: false, message: 'Export failed' });
    expect(test.revokeObjectURL).toHaveBeenCalledWith('blob:test-save');
    expect(test.markExported).not.toHaveBeenCalled();
  });
});
