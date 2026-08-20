// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  PresentedQuestWalkthrough,
  PresentedWalkthroughAction,
} from '../../utils/questWalkthroughs/presenter';
import { QuestWalkthrough } from './QuestWalkthrough';

const action = (
  overrides: Partial<PresentedWalkthroughAction> & Pick<PresentedWalkthroughAction, 'id' | 'instruction'>,
): PresentedWalkthroughAction => ({
  anchorId: overrides.id,
  section: 'QUEST',
  sourceOrder: 1,
  statusText: 'Ready here',
  blockerNotes: [],
  itemNotes: [],
  evidenceText: 'Location evidence: exact entity (npc Doric). Source lines: dorics-quest-walkthrough-1.',
  sourceWording: [{
    id: 'dorics-quest-walkthrough-1',
    text: 'Talk to Doric north of Falador.',
  }],
  mapChunks: ['46,53'],
  canShowOnMap: true,
  ...overrides,
});

const presentedMixed = (): PresentedQuestWalkthrough => {
  const actions = [
    action({
      id: 'doric:prepare',
      section: 'PREPARE',
      sourceOrder: 2,
      instruction: 'Prepare the clay, copper ore, and iron ore.',
      statusText: 'Prepare first',
      blockerNotes: ['Unlock Mining training.', 'Reach level 15 Mining.'],
      itemNotes: [
        'Obtain 6 Clay using the Preparation routes.',
        'Obtain 4 Copper ore using the Preparation routes.',
      ],
      canShowOnMap: false,
      mapChunks: [],
      evidenceText: 'Location evidence: unresolved evidence. Source lines: dorics-quest-walkthrough-2, dorics-quest-walkthrough-3.',
      sourceWording: [
        { id: 'dorics-quest-walkthrough-2', text: 'Mine 6 clay and 4 copper ore.' },
        { id: 'dorics-quest-walkthrough-3', text: 'Mine 2 iron ore.' },
      ],
    }),
    action({
      id: 'doric:talk',
      sourceOrder: 1,
      instruction: 'Talk to Doric.',
    }),
    action({
      id: 'elemental:unresolved',
      sourceOrder: 9,
      instruction: 'Unresolved workshop action.',
      statusText: 'Location needs review',
      blockerNotes: ['The workshop location has not been reviewed.'],
      canShowOnMap: false,
      mapChunks: [],
      evidenceText: 'Location evidence: unresolved evidence. Candidate chunks: 42,50, 43,50. Source lines: elemental-workshop-i-workshop-3.',
      sourceWording: [{
        id: 'elemental-workshop-i-workshop-3',
        text: 'There is a knife spawn in the house north of the church if you forgot to bring one.',
      }],
    }),
  ];
  return {
    questId: "Doric's Quest",
    prepareActions: actions.filter(candidate => candidate.section === 'PREPARE'),
    questActions: actions.filter(candidate => candidate.section === 'QUEST'),
    actions,
    attribution: {
      wikiLabel: "Old School RuneScape Wiki — Doric's Quest/Quick guide (revision 15240921)",
      wikiUrl: 'https://oldschool.runescape.wiki/w/index.php?title=Doric%27s_Quest/Quick_guide&oldid=15240921',
      licenceLabel: 'Wiki licence: CC BY-NC-SA 3.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      chunkPickerLabel: 'Chunk Picker — source-chunk/chunk-picker-v2',
      chunkPickerCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
      reuseStatusText: 'PREVIEW_ONLY; Chunk Picker reuse: UNVERIFIED.',
    },
  };
};

afterEach(cleanup);

describe('QuestWalkthrough', () => {
  it('renders every Prepare and Quest action, including unresolved actions', () => {
    const walkthrough = presentedMixed();
    render(<QuestWalkthrough walkthrough={walkthrough} onShowActionOnMap={() => undefined} />);

    const region = screen.getByRole('region', { name: 'Quest walkthrough' });
    expect(within(region).getByRole('heading', { name: 'Prepare' })).toBeTruthy();
    expect(within(region).getByRole('heading', { name: 'Quest walkthrough' })).toBeTruthy();
    expect(within(region).getAllByRole('listitem')).toHaveLength(walkthrough.actions.length);
    expect(within(region).getByText('Location needs review')).toBeTruthy();
  });

  it('offers map focus only for authoritative action chunks with coordinate-free labels', async () => {
    const onShowActionOnMap = vi.fn();
    render(<QuestWalkthrough walkthrough={presentedMixed()} onShowActionOnMap={onShowActionOnMap} />);

    const button = screen.getByRole('button', { name: 'Show Talk to Doric. on map' });
    expect(button.getAttribute('aria-label')).not.toMatch(/\d{1,3},\d{1,3}/);
    await userEvent.click(button);

    expect(onShowActionOnMap).toHaveBeenCalledWith('doric:talk');
    expect(screen.queryByRole('button', { name: /show unresolved workshop action on map/i }))
      .toBeNull();
  });

  it('keeps source-order numbers, statuses, blockers, and item notes on their rows', () => {
    render(<QuestWalkthrough walkthrough={presentedMixed()} onShowActionOnMap={() => undefined} />);

    const prepareRow = screen.getByText('Prepare the clay, copper ore, and iron ore.').closest('li');
    const talkRow = screen.getByText('Talk to Doric.').closest('li');
    const unresolvedRow = screen.getByText('Unresolved workshop action.').closest('li');
    if (!prepareRow || !talkRow || !unresolvedRow) throw new Error('Missing walkthrough row');

    expect(within(prepareRow).getByText('Step 2')).toBeTruthy();
    expect(within(prepareRow).getByText('Prepare first')).toBeTruthy();
    expect(within(prepareRow).getByText('Unlock Mining training.')).toBeTruthy();
    expect(within(prepareRow).getByText('Reach level 15 Mining.')).toBeTruthy();
    expect(within(prepareRow).getByText('Obtain 6 Clay using the Preparation routes.')).toBeTruthy();
    expect(within(prepareRow).getByText('Obtain 4 Copper ore using the Preparation routes.')).toBeTruthy();
    expect(within(talkRow).getByText('Step 1')).toBeTruthy();
    expect(within(unresolvedRow).getByText('Step 9')).toBeTruthy();
  });

  it('uses native disclosures for evidence and source wording details', () => {
    const { container } = render(
      <QuestWalkthrough walkthrough={presentedMixed()} onShowActionOnMap={() => undefined} />,
    );

    const disclosures = [...container.querySelectorAll('details')];
    expect(disclosures).toHaveLength(presentedMixed().actions.length);
    expect(disclosures.every(disclosure => disclosure.querySelector('summary') !== null)).toBe(true);
    expect(screen.getByText(/exact entity \(npc Doric\)/i)).toBeTruthy();
    expect(screen.getByText(/Candidate chunks: 42,50, 43,50/i)).toBeTruthy();
    expect(screen.getByText(/dorics-quest-walkthrough-2, dorics-quest-walkthrough-3/i)).toBeTruthy();
    expect(screen.getByText('Mine 6 clay and 4 copper ore.')).toBeTruthy();
    expect(screen.getByText('Mine 2 iron ore.')).toBeTruthy();
    expect(screen.getByText(
      'There is a knife spawn in the house north of the church if you forgot to bring one.',
    )).toBeTruthy();
  });

  it('renders source attribution once at the end with permanent and licence links', () => {
    const { container } = render(
      <QuestWalkthrough walkthrough={presentedMixed()} onShowActionOnMap={() => undefined} />,
    );
    const region = screen.getByRole('region', { name: 'Quest walkthrough' });
    const wiki = within(region).getByRole('link', { name: /Old School RuneScape Wiki/i });
    const licence = within(region).getByRole('link', { name: 'Wiki licence: CC BY-NC-SA 3.0' });

    expect(wiki.getAttribute('href')).toContain('oldid=15240921');
    expect(licence.getAttribute('href')).toBe('https://creativecommons.org/licenses/by-nc-sa/3.0/');
    expect(within(region).getByText(/Chunk Picker — source-chunk\/chunk-picker-v2/)).toBeTruthy();
    expect(within(region).getByText(/ba2fcebf8b26c84c74f8d9ab328a0ede802be926/)).toBeTruthy();
    expect(within(region).getByText(/PREVIEW_ONLY; Chunk Picker reuse: UNVERIFIED/)).toBeTruthy();
    expect(container.querySelectorAll('[data-runeproof-walkthrough-attribution]')).toHaveLength(1);
    expect(region.lastElementChild?.hasAttribute('data-runeproof-walkthrough-attribution')).toBe(true);
  });

  it('keeps long instructions readable without hiding the row controls', () => {
    const longInstruction = 'Use the battered key on the odd-looking wall, descend the stairs, inspect every machine, and retain the battered book while following the complete workshop sequence.'.repeat(4);
    const longAction = action({ id: 'elemental:long', sourceOrder: 12, instruction: longInstruction });
    render(
      <QuestWalkthrough
        walkthrough={{
          ...presentedMixed(),
          prepareActions: [],
          questActions: [longAction],
          actions: [longAction],
        }}
        onShowActionOnMap={() => undefined}
      />,
    );

    const row = screen.getByText(longInstruction).closest('li');
    if (!row) throw new Error('Missing long walkthrough row');
    expect(within(row).getByRole('button', { name: /show .* on map/i })).toBeTruthy();
    expect(within(row).getByText('Evidence and source wording')).toBeTruthy();
    expect(screen.getByText(longInstruction).className).toContain('break-words');
  });
});
