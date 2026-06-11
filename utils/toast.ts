/** App-wide imperative toast: anywhere can `showToast('Saved')` instead of a
 *  blocking `alert()`. ToastNotification (App.tsx) listens for the event and
 *  renders it through the same pipeline as game-event toasts, so feedback
 *  looks identical everywhere. Plain DOM event — safe to call from contexts,
 *  services, and non-React code. */
export const showToast = (message: string) =>
  window.dispatchEvent(new CustomEvent('fate:toast', { detail: { message } }));
