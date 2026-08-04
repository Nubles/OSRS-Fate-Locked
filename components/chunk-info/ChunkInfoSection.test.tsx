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
    expect(screen.getByRole('heading', { name: /Quests.*2 ready/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Combat.*1 locked/ })).toBeTruthy();
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('false');

    const questsPanel = document.getElementById(quests.getAttribute('aria-controls')!);
    const combatPanel = document.getElementById(combat.getAttribute('aria-controls')!);
    expect(questsPanel).toBeTruthy();
    expect(combatPanel).toBeTruthy();
    expect(questsPanel?.hidden).toBe(false);
    expect(combatPanel?.hidden).toBe(true);

    await userEvent.click(combat);
    expect(quests.getAttribute('aria-expanded')).toBe('true');
    expect(combat.getAttribute('aria-expanded')).toBe('true');
    expect(combatPanel?.hidden).toBe(false);
    expect(screen.getByText('Dark wizard')).toBeTruthy();
  });
});
