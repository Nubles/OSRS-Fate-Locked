/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ChunkInfoSection } from './ChunkInfoSection';

afterEach(cleanup);

describe('ChunkInfoSection', () => {
  it('uses accessible disclosure state and allows independent expansion', async () => {
    render(
      <>
        <ChunkInfoSection id="quests" label="Quests" summary="2 ready" icon={<span>Q</span>} defaultOpen>
          <span>Demon Slayer</span>
        </ChunkInfoSection>
        <ChunkInfoSection id="combat" label="Combat" summary="1 locked" icon={<span>C</span>} defaultOpen={false}>
          <span>Dark wizard</span>
        </ChunkInfoSection>
      </>,
    );
    const quests = screen.getByRole('button', { name: /Quests.*2 ready/ });
    const combat = screen.getByRole('button', { name: /Combat.*1 locked/ });
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(combat);
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Dark wizard')).toBeTruthy();
  });
});
