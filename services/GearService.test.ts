import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('retains upstream weapon categories and never invents missing ones', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
    { id: 4151, name: 'Abyssal whip', slot: 'weapon', category: 'Whip', speed: 4, bonuses: { str: 82 } },
    { id: 999999, name: 'Unclassified weapon', slot: 'weapon', speed: 4, bonuses: { str: 1 } },
  ] }));
  const { gearService } = await import('./GearService');
  await gearService.init();
  expect(gearService.byId(4151)?.category).toBe('Whip');
  expect(gearService.byId(999999)?.category).toBeUndefined();
});
