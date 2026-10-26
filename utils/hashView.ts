/**
 * Which page the address asks for (index.tsx): the stream overlay at
 * `#/overlay`, a public Adventurer's Log at `#/log/<run id>`, else the app.
 * The page is picked once at load, so a link pasted into a tab that already
 * shows another page reloads it (watchHashView) instead of changing nothing.
 */
export type HashView =
  | { kind: 'overlay' }
  | { kind: 'log'; id: string }
  | { kind: 'app' };

export function hashView(hash: string): HashView {
  if (hash.startsWith('#/overlay')) return { kind: 'overlay' };
  if (hash.startsWith('#/log/')) {
    // Only the id: a chat app can tack a slash, query or stray text onto a pasted link.
    const id = hash.slice('#/log/'.length).match(/^[A-Za-z0-9_-]+/)?.[0] ?? '';
    return { kind: 'log', id };
  }
  return { kind: 'app' };
}

const sameView = (a: HashView, b: HashView) =>
  a.kind === b.kind && (a.kind !== 'log' || a.id === (b as { id: string }).id);

/** Reload when the hash moves to a different page than the one showing. */
export function watchHashView(shown: HashView, reload: () => void = () => window.location.reload()): () => void {
  const onChange = () => { if (!sameView(shown, hashView(window.location.hash))) reload(); };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
