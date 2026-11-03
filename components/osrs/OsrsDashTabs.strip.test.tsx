// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOsrsNav, openOsrsScreen, setOsrsProgressionWide } from '../../utils/osrsNav';

vi.mock('./OsrsShellNotice', () => ({ OsrsShellNotice: () => <div>parchment line</div> }));
vi.mock('./OsrsChatbox', () => ({ OsrsChatbox: () => <div>chatbox</div> }));
vi.mock('./OsrsKeysWorkspace', () => ({ default: () => <div>keys workspace</div> }));
vi.mock('./OsrsJournalScreen', () => ({ default: () => <div>journal screen</div> }));
vi.mock('../SectionGuide', () => ({ SectionGuide: () => null }));

import { OsrsShellFrame } from './OsrsShellFrame';
import { OsrsDashTabs } from './OsrsDashChrome';

const TABS = [{ id: 'CHARACTER', label: 'Character' }, { id: 'WORLD', label: 'World' }, { id: 'JOURNAL', label: 'Journal' }];

const renderFrame = (onTab: (id: string) => void) => render(
  <OsrsShellFrame
    header={<header>header</header>}
    criticalBanners={null}
    journalCard={<div>journal card</div>}
    keysPanel={<div>keys panel</div>}
    progression={(
      <OsrsDashTabs
        tabs={TABS} activeTab="CHARACTER" onTab={onTab}
        searchQuery="" onSearch={() => undefined}
        showOnlyActionable={false} onToggleActionable={() => undefined} suspendModals={false}
      />
    )}
    durability={{ primary: 'saved', recovery: 'protected', savedAt: null }}
    showDurability
    exportBackup={() => undefined}
  />,
);

afterEach(() => {
  cleanup();
  act(() => { openOsrsScreen('home', 'farm'); setOsrsProgressionWide(false); });
});

describe('OSRS layout fixed tab strip (#23)', () => {
  it('draws the Progression tabs in one strip above every screen, the filter stays in the window', () => {
    const { container } = renderFrame(() => undefined);
    const strip = container.querySelector('[data-osrs-tabstrip]');
    expect(strip?.querySelector('[data-tour="dashtabs"]')).not.toBeNull();
    expect(strip?.querySelector('input')).toBeNull();
    expect(container.querySelector('.osrs-shell-right input[aria-label="Filter unlocks"]')).not.toBeNull();
    act(() => openOsrsScreen('keys', 'history'));
    expect(container.querySelector('[data-osrs-tabstrip] [data-tour="dashtabs"]')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Character' }).getAttribute('aria-selected')).toBe('false');
  });

  it('marks Journal on the Journal screen and brings a tab click home from other screens', () => {
    const onTab = vi.fn();
    renderFrame(onTab);
    act(() => openOsrsScreen('journal'));
    expect(screen.getByRole('tab', { name: 'Journal' }).getAttribute('aria-selected')).toBe('true');
    act(() => openOsrsScreen('keys', 'spend'));
    fireEvent.click(screen.getByRole('tab', { name: 'World' }));
    expect(getOsrsNav().screen).toBe('home');
    expect(onTab).toHaveBeenCalledWith('WORLD');
  });
});
