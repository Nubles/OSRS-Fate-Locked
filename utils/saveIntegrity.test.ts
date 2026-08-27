import { describe, expect, it } from 'vitest';
import { checksumSave, verifySaveChecksum } from './saveIntegrity';

describe('save integrity', () => {
  it('round-trips a UTF-8 save checksum and rejects a one-byte change', async () => {
    const data = JSON.stringify({ note: 'Rune Ω' });
    const checksum = await checksumSave(data);

    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifySaveChecksum(data, checksum)).resolves.toBe(true);
    await expect(verifySaveChecksum(`${data} `, checksum)).resolves.toBe(false);
  });
});
