export type RunelitePairingPhase = 'confirm' | 'uploading' | 'success' | 'error';

/**
 * Every phase but an in-flight send can be closed, including a failed one.
 * It lives apart from the dialog, which loads only when a pairing starts.
 */
export const canDismissRunelitePairing = (phase: RunelitePairingPhase): boolean =>
  phase !== 'uploading';
