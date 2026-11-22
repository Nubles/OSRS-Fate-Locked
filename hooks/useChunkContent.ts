import { useCallback, useEffect, useState } from 'react';
import { chunkContentService } from '../services/ChunkContentService';

/**
 * All content consumers observe successful retries, including retries in another panel.
 * `load = false` holds off the first fetch (a panel that only needs the content in some
 * modes) while still following a load another panel starts.
 */
export function useChunkContent(load = true) {
  const read = () => ({ ready: chunkContentService.ready, error: chunkContentService.error });
  const [state, setState] = useState(read);
  const retry = useCallback(() => {
    void chunkContentService.init();
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => { if (active) setState(read()); };
    const unsubscribe = chunkContentService.subscribe(update);
    update();
    if (load && !chunkContentService.ready) void chunkContentService.init().then(update);
    return () => { active = false; unsubscribe(); };
  }, [load]);
  return { ...state, retry };
}
