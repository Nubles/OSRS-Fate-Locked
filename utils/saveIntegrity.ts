import { sha256Hex } from './integrity';

/** Hash the exact serialized save bytes with the repository's SHA-256 helper. */
export const checksumSave = (data: string): Promise<string> => sha256Hex(data);

/** Verify the exact serialized save bytes against a stored checksum. */
export const verifySaveChecksum = async (data: string, expected: string): Promise<boolean> => (
  await checksumSave(data) === expected
);
