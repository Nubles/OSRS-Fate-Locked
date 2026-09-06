import { useEffect, useState } from 'react';
type Instructions = { questId: string; revision: string; sources: string[]; chunks: Record<string, string[]> };
export function QuestChunkInstructions({ questId, chunk }: { questId: string; chunk: string }) {
  const [data, setData] = useState<Instructions | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setFailed(false);
    const file = questId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    fetch(`${import.meta.env.BASE_URL}runeproof/chunk-instructions/${file}.json`, { signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable');
        const value = await response.json();
        if (value.questId !== questId || typeof value.revision !== 'string' || !value.chunks || typeof value.chunks !== 'object'
          || !Object.values(value.chunks).every(rows => Array.isArray(rows) && rows.every(row => typeof row === 'string'))) throw new Error('invalid');
        if (!abort.signal.aborted) setData(value);
      }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [questId, attempt]);
  const lines = data?.questId === questId ? data.chunks[chunk] ?? [] : [];
  return <section className="rp-chunk-instructions" aria-label={`Quest instructions in chunk ${chunk}`}>
    <h4>What happens here</h4>
    {failed ? <p>Instructions could not be loaded. <button className="rp-text-button" onClick={() => setAttempt(value => value + 1)}>Retry instructions</button></p>
      : !data ? <p>Loading quest instructions...</p> : lines.length ? <><ul>{lines.map(line => <li key={line}>{line}</li>)}</ul><p>Follow the steps for your chosen route and quest progress.</p></>
        : <p>Instructions for this location are not available yet.</p>}
  </section>;
}
