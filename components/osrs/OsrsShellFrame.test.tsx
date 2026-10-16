// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openOsrsScreen, setOsrsProgressionWide } from '../../utils/osrsNav';

vi.mock('./OsrsShellNotice', () => ({ OsrsShellNotice: () => <div>parchment line</div> }));
vi.mock('./OsrsChatbox', () => ({ OsrsChatbox: () => <div>chatbox</div> }));
vi.mock('./OsrsKeysWorkspace', () => ({ default: () => <div>keys workspace</div> }));
vi.mock('./OsrsJournalScreen', () => ({ default: () => <div>journal screen</div> }));

import { OsrsShellFrame } from './OsrsShellFrame';

const renderFrame = () => render(
  <OsrsShellFrame
    header={<header>header</header>}
    criticalBanners={null}
    journalCard={<div>journal card</div>}
    keysPanel={<div>keys panel</div>}
    progression={<div>progression</div>}
    durability={{ primary: 'saved', recovery: 'protected', savedAt: null }}
    showDurability
    exportBackup={() => undefined}
  />,
);

afterEach(() => {
  cleanup();
  act(() => { openOsrsScreen('home', 'farm'); setOsrsProgressionWide(false); });
});

describe('OsrsShellFrame', () => {
  it('draws the header, parchment line, home grid and chatbox in order', () => {
    const { container } = renderFrame();
    const text = container.textContent ?? '';
    expect(text.indexOf('header')).toBeLessThan(text.indexOf('parchment line'));
    expect(text.indexOf('parchment line')).toBeLessThan(text.indexOf('journal card'));
    expect(text.indexOf('journal card')).toBeLessThan(text.indexOf('keys panel'));
    expect(text.indexOf('progression')).toBeLessThan(text.indexOf('chatbox'));
    expect(container.querySelector('[data-osrs-screen="home"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('hides (but keeps) the left column while a full-width Progression tab shows', () => {
    const { container } = renderFrame();
    act(() => setOsrsProgressionWide(true));
    const left = container.querySelector('.osrs-shell-left');
    expect(left?.hasAttribute('hidden')).toBe(true);
    expect(left?.textContent).toContain('keys panel');
    expect(container.querySelector('.osrs-shell-grid')?.classList.contains('is-wide')).toBe(true);
  });

  it('mounts the Keys and Journal screens and keeps home mounted underneath', async () => {
    const { container } = renderFrame();
    act(() => openOsrsScreen('keys', 'spend'));
    expect(await screen.findByText('keys workspace')).toBeTruthy();
    expect(container.querySelector('[data-osrs-screen="home"]')?.hasAttribute('hidden')).toBe(true);
    expect(screen.getByText('keys panel')).toBeTruthy();

    act(() => openOsrsScreen('journal'));
    expect(await screen.findByText('journal screen')).toBeTruthy();
    expect(screen.queryByText('keys workspace')).toBeNull();

    act(() => openOsrsScreen('home'));
    expect(screen.queryByText('journal screen')).toBeNull();
    expect(container.querySelector('[data-osrs-screen="home"]')?.hasAttribute('hidden')).toBe(false);
  });
});
