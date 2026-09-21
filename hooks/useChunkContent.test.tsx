/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../services/ChunkContentService', async () => {
  const actual = await vi.importActual<typeof import('../services/ChunkContentService')>('../services/ChunkContentService');
  return { ...actual, chunkContentService: new actual.ChunkContentService() };
});
import { useChunkContent } from './useChunkContent';

function Consumer({ name }: { name: string }) {
  const { ready, error, retry } = useChunkContent();
  return <section aria-label={name}>
    <output>{name}: {ready ? 'ready' : error ? 'failed' : 'loading'}</output>
    {error && <button onClick={retry}>Retry {name}</button>}
  </section>;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shares a failed load and publishes a successful retry to every mounted consumer', async () => {
  const fetchContent = vi.fn()
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ version: 9, chunks: {} }) });
  vi.stubGlobal('fetch', fetchContent);
  render(<><Consumer name="shops" /><Consumer name="Slayer" /></>);
  await screen.findByText('shops: failed');
  expect(screen.getByText('Slayer: failed')).toBeTruthy();
  expect(fetchContent).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Retry shops' }));
  await waitFor(() => {
    expect(screen.getByText('shops: ready')).toBeTruthy();
    expect(screen.getByText('Slayer: ready')).toBeTruthy();
  });
  expect(fetchContent).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'Retry Slayer' })).toBeNull();
});
