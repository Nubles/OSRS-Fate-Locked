import nacl from 'tweetnacl';

const HEX = /^[0-9a-f]+$/i;

export const verifyDiscordRequest = (
  body: string,
  timestamp: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean => {
  if (
    typeof body !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof signatureHex !== 'string' ||
    typeof publicKeyHex !== 'string' ||
    !HEX.test(signatureHex) ||
    !HEX.test(publicKeyHex) ||
    signatureHex.length !== 128 ||
    publicKeyHex.length !== 64
  ) {
    return false;
  }

  return nacl.sign.detached.verify(
    new TextEncoder().encode(`${timestamp}${body}`),
    Buffer.from(signatureHex, 'hex'),
    Buffer.from(publicKeyHex, 'hex'),
  );
};
