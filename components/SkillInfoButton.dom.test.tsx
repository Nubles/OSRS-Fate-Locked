/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SkillInfoButton } from './SkillInfoButton';
import { skillLevelKeyChance } from '../utils/keyRoll';

afterEach(cleanup);
// The box is a separate file fetched on first use. Fetch it up front, so the first
// test is not timing that download against findByRole's one second on a busy machine.
beforeAll(async () => { await import('./SkillInfoBox'); });

const renderCard = (onCardClick = vi.fn()) => {
  render(
    <div data-skill-card="Attack" onClick={onCardClick}>
      <SkillInfoButton skill="Attack" level={47} tier={5} chance={skillLevelKeyChance(48)} variant="classic" />
    </div>,
  );
  return { button: screen.getByRole('button', { name: 'Attack roll odds' }), onCardClick };
};

describe('SkillInfoButton', () => {
  it('shows the odds while the mouse points at it', async () => {
    const { button } = renderCard();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    expect((await screen.findByRole('tooltip')).textContent).toContain('9.6%');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerLeave(button, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens the odds outside the card, and a click on it does not level the skill', async () => {
    const { button, onCardClick } = renderCard();
    fireEvent.click(button);
    const box = await screen.findByRole('tooltip');
    expect(box.closest('[data-skill-card]')).toBeNull();
    expect(box.style.position).toBe('fixed');
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('stays open after a click until a click elsewhere or Escape', async () => {
    const { button } = renderCard();
    fireEvent.click(button);
    fireEvent.pointerLeave(button, { pointerType: 'mouse' });
    const box = await screen.findByRole('tooltip');
    // Clicks inside the box keep it open.
    fireEvent.pointerDown(box);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    act(() => { fireEvent.pointerDown(document.body); });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.click(button);
    await screen.findByRole('tooltip');
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes on Escape while the info button still has focus', async () => {
    // Where focus is right after a click or Enter opened the box. The button
    // stops its key presses from reaching the card, so the press starts there.
    const { button, onCardClick } = renderCard();
    fireEvent.click(button);
    await screen.findByRole('tooltip');
    button.focus();
    act(() => { fireEvent.keyDown(button, { key: 'Escape' }); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('closes on Escape while the mouse still points at it', async () => {
    const { button } = renderCard();
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    await screen.findByRole('tooltip');
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    // Pointing at it again brings the box back.
    fireEvent.pointerLeave(button, { pointerType: 'mouse' });
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    expect(await screen.findByRole('tooltip')).toBeTruthy();
  });

  it('keeps Enter and Space on the button from reaching the card', async () => {
    const onCardKey = vi.fn();
    render(
      <div data-skill-card="Attack" onKeyDown={onCardKey}>
        <SkillInfoButton skill="Attack" level={47} tier={5} chance={skillLevelKeyChance(48)} variant="classic" />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Attack roll odds' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(onCardKey).not.toHaveBeenCalled();
  });

  it('opens on a tap without needing hover', async () => {
    const { button } = renderCard();
    fireEvent.pointerEnter(button, { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(button);
    await screen.findByRole('tooltip');
    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
