import { useEffect, useState } from 'react';
import { loadModelManifest, modelFor, modelManifestLoaded } from '../data/entityModels';

/** Re-renders once the on-demand model manifest has loaded; true when it is in. */
export const useModelManifest = (): boolean => {
  const [ready, setReady] = useState(modelManifestLoaded);
  useEffect(() => {
    if (ready) return;
    let live = true;
    loadModelManifest().then(() => { if (live) setReady(true); }, () => {});
    return () => { live = false; };
  }, [ready]);
  return ready;
};

/** modelFor(name), answering undefined (2D picture) until the manifest loads. */
export const useModelFor = (name: string): string | undefined => {
  useModelManifest();
  return modelFor(name);
};

// Fetch the manifest once the app is idle, so a reveal rarely has to wait for it.
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(() => { loadModelManifest().catch(() => {}); }, { timeout: 5000 });
}
