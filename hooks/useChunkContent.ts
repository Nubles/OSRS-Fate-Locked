import { useCallback, useEffect, useState } from 'react';
import { chunkContentService } from '../services/ChunkContentService';

/** All content consumers observe successful retries, including retries in another panel. */
export function useChunkContent() {
  const read = () => ({ ready: chunkContentService.ready, error: chunkContentService.error });
  const [state, setState] = useState(read);
  const retry = useCallback(() => {
    void chunkContentService.init();
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => { if (active) setState(read()); };
    const unsubscribe = chunkContentService.subscribe(update);
    if (!chunkContentService.ready) void chunkContentService.init().then(update);
    return () => { active = false; unsubscribe(); };
  }, []);
  return { ...state, retry };
}
