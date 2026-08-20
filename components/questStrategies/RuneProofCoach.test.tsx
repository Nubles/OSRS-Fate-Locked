// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChunkKey } from '../../utils/questRoutes/model';
import type { RuneProofCoachModel } from '../../utils/questStrategies/coach';
import { RuneProofCoach } from './RuneProofCoach';

afterEach(cleanup);

const proof: RuneProofCoachModel['proof'] = {
  source: {
    wikiTitle: "Cook's Assistant/Quick guide",
    wikiRevision: '123456',
    wikiRevisionTimestamp: '2026-08-20T00:00:00Z',
    wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=123456',
    wikiLicence: 'CC BY-NC-SA 3.0',
    wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    chunkPickerRepository: 'source-chunk/chunk-picker-v2',
    chunkPickerCommit: 'abc123',
    chunkPickerLicenceStatus: 'PERMISSION_RECORDED',
    permissionReference: 'review-record-1',
  },
  sourceLines: [{
    id: 'cooks-assistant-1',
    section: 'Quick guide',
    sourceOrder: 1,
    rawText: 'Bring a pot, bucket, and egg to the Cook.',
  }],
  diagnostics: ['Route budget and source wording are retained for proof.'],
};

const potInstruction = 'Pick up the empty pot beside the Cook in Lumbridge Castle.';

// This is intentionally a post-start model: visible-hierarchy assertions for
// the pot belong after cooks-assistant:start-quest is complete.
const modelWithPotNext: RuneProofCoachModel = {
  questId: "Cook's Assistant",
  recommendationReason: 'Recommended because this local quest is ready with your current unlocks.',
  progress: { completed: 1, total: 3 },
  nextAction: {
    id: 'cooks-assistant:take-pot',
    instruction: potInstruction,
    state: 'DO_NOW',
    locationLabel: 'Lumbridge Castle',
    mapChunks: ['50,50'],
    preferredMethodLabel: 'Pot',
    confirmationAllowed: false,
  },
  actions: [
    {
      id: 'cooks-assistant:start-quest',
      instruction: 'Talk to the Cook in Lumbridge Castle.',
      state: 'COMPLETED',
      mapChunks: ['50,50'],
      confirmationAllowed: true,
    },
    {
      id: 'cooks-assistant:take-pot',
      instruction: potInstruction,
      state: 'DO_NOW',
      locationLabel: 'Lumbridge Castle',
      mapChunks: ['50,50'],
      preferredMethodLabel: 'Pot',
      confirmationAllowed: false,
    },
    {
      id: 'cooks-assistant:take-bucket',
      instruction: 'Pick up the bucket from the Lumbridge Castle cellar.',
      state: 'AVAILABLE_NEXT',
      mapChunks: ['50,50'],
      confirmationAllowed: false,
    },
  ],
  alternativeSources: [{
    itemKey: 'pot of flour',
    itemName: 'Pot of flour',
    routes: [{
      variantCount: 4,
      id: 'black-knight-flour',
      label: 'Black Knight',
      sourceKind: 'Drop',
      outputQuantity: 1,
      isBest: true,
      requiresChunkUnlock: false,
      steps: [],
      blockers: [],
      deterministic: false,
      probabilityText: '50% chance',
    }],
  }],
  mainJourneyText: [
    'Talk to the Cook in Lumbridge Castle.',
    potInstruction,
    'Pick up the bucket from the Lumbridge Castle cellar.',
  ].join(' '),
  proof,
};

const freshModel: RuneProofCoachModel = {
  ...modelWithPotNext,
  progress: { completed: 0, total: 3 },
  nextAction: {
    id: 'cooks-assistant:start-quest',
    instruction: 'Talk to the Cook in Lumbridge Castle.',
    state: 'DO_NOW',
    locationLabel: 'Lumbridge Castle',
    mapChunks: ['50,50'],
    confirmationAllowed: true,
  },
  actions: [
    {
      id: 'cooks-assistant:start-quest',
      instruction: 'Talk to the Cook in Lumbridge Castle.',
      state: 'DO_NOW',
      locationLabel: 'Lumbridge Castle',
      mapChunks: ['50,50'],
      confirmationAllowed: true,
    },
    {
      ...modelWithPotNext.actions[1],
      state: 'AVAILABLE_NEXT',
    },
    ...modelWithPotNext.actions.slice(2),
  ],
};

const modelWithCurrentChunk = (chunk: string): RuneProofCoachModel => {
  if (!freshModel.nextAction) throw new Error('Fresh Cook model must have a current action.');
  return {
    ...freshModel,
    nextAction: {
      ...freshModel.nextAction,
      mapChunks: [chunk as ChunkKey],
    },
  };
};

const completedModel: RuneProofCoachModel = {
  ...modelWithPotNext,
  progress: { completed: 3, total: 3 },
  nextAction: undefined,
  actions: modelWithPotNext.actions.map(action => ({
    ...action,
    state: 'COMPLETED' as const,
    confirmationAllowed: false,
  })),
  alternativeSources: [],
};

const emptyRouteModel: RuneProofCoachModel = {
  ...completedModel,
  progress: { completed: 0, total: 0 },
  actions: [],
  proof: {
    ...proof,
    sourceLines: [],
    diagnostics: [],
  },
};

describe('RuneProofCoach', () => {
  it('puts the reviewed objective and current pot action before the compact route', () => {
    render(
      <RuneProofCoach
        model={modelWithPotNext}
        onConfirmAction={() => undefined}
        onOpenWorldChunk={() => undefined}
      />,
    );

    const objective = screen.getByRole('heading', { name: "Cook's Assistant" });
    const nextAction = screen.getByRole('heading', { name: 'Next action' });
    const route = screen.getByRole('list', { name: "Cook's Assistant route" });
    const nextActionSection = nextAction.closest('section');

    expect(objective).toBeTruthy();
    expect(screen.getByText('Recommended because this local quest is ready with your current unlocks.'))
      .toBeTruthy();
    expect(nextAction).toBeTruthy();
    expect(within(nextActionSection as HTMLElement).getByText(potInstruction)).toBeTruthy();
    expect(route).toBeTruthy();
    expect(screen.queryByText(/route budget/i)).toBeNull();
    expect(screen.queryByText(/Black Knight/i)).toBeNull();
    expect(nextAction.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const coach = objective.closest('section');
    expect(coach?.getAttribute('style') ?? '').not.toMatch(/width:\s*\d+px/i);
    expect(coach?.className).not.toMatch(/(?:^|\s)(?:w|min-w|max-w)-\[\d+px\]/);
    expect(screen.getAllByRole('button', { name: /on map/i })).toHaveLength(1);

    const routeRows = within(route).getAllByRole('listitem');
    expect(routeRows[0].querySelector('details')?.open).toBe(false);
    expect(routeRows[1].querySelector('details')?.open).toBe(true);
    expect(routeRows[2].querySelector('details')?.open).toBe(false);
  });

  it('keeps legal alternatives and proof outside the primary journey until opened', async () => {
    const user = userEvent.setup();
    render(
      <RuneProofCoach
        model={modelWithPotNext}
        onConfirmAction={() => undefined}
      />,
    );

    const alternatives = screen.getByRole('button', { name: 'Other legal sources' });
    const proofDrawer = screen.getByRole('button', { name: 'Proof and sources' });

    expect(alternatives.getAttribute('aria-expanded')).toBe('false');
    expect(proofDrawer.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Black Knight')).toBeNull();
    expect(screen.queryByText('Wiki revision: 123456')).toBeNull();
    expect(screen.queryByText('Route budget and source wording are retained for proof.')).toBeNull();

    await user.click(alternatives);
    expect(alternatives.getAttribute('aria-expanded')).toBe('true');
    const alternativesRegion = screen.getByRole('region', { name: 'Other legal sources' });
    expect(within(alternativesRegion).getAllByText('Black Knight')).toHaveLength(1);
    expect(within(alternativesRegion).getByText('4 route variants')).toBeTruthy();
    expect(within(alternativesRegion).getAllByRole('listitem')).toHaveLength(1);

    await user.click(proofDrawer);
    expect(proofDrawer.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Wiki revision: 123456')).toBeTruthy();
    expect(screen.getByText('Route budget and source wording are retained for proof.')).toBeTruthy();
  });

  it('keeps the fresh reviewed action primary and forwards its map and confirmation controls', async () => {
    const user = userEvent.setup();
    const onConfirmAction = vi.fn();
    const onOpenWorldChunk = vi.fn();
    render(
      <RuneProofCoach
        model={freshModel}
        onConfirmAction={onConfirmAction}
        onOpenWorldChunk={onOpenWorldChunk}
      />,
    );

    const nextActionSection = screen.getByRole('heading', { name: 'Next action' }).closest('section');
    expect(within(nextActionSection as HTMLElement).getByText('Talk to the Cook in Lumbridge Castle.'))
      .toBeTruthy();
    expect(screen.getAllByRole('button', { name: /on map/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', {
      name: 'Show Talk to the Cook in Lumbridge Castle. on map',
    }));
    await user.click(screen.getByRole('button', { name: 'Mark action complete' }));

    expect(onOpenWorldChunk).toHaveBeenCalledWith(50, 50);
    expect(onConfirmAction).toHaveBeenCalledWith('cooks-assistant:start-quest');
  });

  it('scopes objective, next-action, and route labels to each coach instance', () => {
    render(
      <>
        <RuneProofCoach model={modelWithPotNext} onConfirmAction={() => undefined} />
        <RuneProofCoach model={modelWithPotNext} onConfirmAction={() => undefined} />
      </>,
    );

    const coaches = screen.getAllByRole('heading', { name: "Cook's Assistant" })
      .map(heading => heading.closest('section'))
      .filter((coach): coach is HTMLElement => coach !== null);
    const labelledSections = (coach: HTMLElement): HTMLElement[] => [
      coach,
      ...Array.from(coach.querySelectorAll<HTMLElement>('section[aria-labelledby]')),
    ];
    const ids = coaches.flatMap(coach => labelledSections(coach)
      .map(section => section.getAttribute('aria-labelledby'))
      .filter((id): id is string => id !== null));

    expect(coaches).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
    coaches.forEach(coach => {
      labelledSections(coach).forEach(section => {
        const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
        expect(heading).toBeTruthy();
        expect(coach.contains(heading)).toBe(true);
      });
    });
  });

  it('withholds map controls for malformed, unsafe, and unmappable current chunks', () => {
    [
      '50,',
      ' 50,50',
      '5e1,50',
      '9007199254740992,50',
      '999,999',
    ].forEach(chunk => {
      const onOpenWorldChunk = vi.fn();
      const view = render(
        <RuneProofCoach
          model={modelWithCurrentChunk(chunk)}
          onConfirmAction={() => undefined}
          onOpenWorldChunk={onOpenWorldChunk}
        />,
      );

      expect(screen.queryByRole('button', { name: /on map/i })).toBeNull();
      expect(onOpenWorldChunk).not.toHaveBeenCalled();
      view.unmount();
    });
  });

  it('keeps an empty alternatives disclosure before proof in the coach sequence', async () => {
    const user = userEvent.setup();
    render(<RuneProofCoach model={emptyRouteModel} onConfirmAction={() => undefined} />);

    const alternatives = screen.getByRole('button', { name: 'Other legal sources' });
    const proofDrawer = screen.getByRole('button', { name: 'Proof and sources' });
    expect(alternatives.getAttribute('aria-expanded')).toBe('false');
    expect(alternatives.compareDocumentPosition(proofDrawer) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(alternatives);

    expect(alternatives.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('No other reviewed legal sources are available.')).toBeTruthy();
  });

  it('renders a completed route without a current action', () => {
    render(<RuneProofCoach model={completedModel} onConfirmAction={() => undefined} />);

    expect(screen.getByText('All reviewed actions are complete.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /on map/i })).toBeNull();
    expect(within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders an empty route without treating it as a completed journey', () => {
    render(<RuneProofCoach model={emptyRouteModel} onConfirmAction={() => undefined} />);

    expect(screen.getByText('No reviewed actions are available for this objective.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: "Cook's Assistant route" }))
      .queryAllByRole('listitem')).toHaveLength(0);
  });

  it('explains empty proof arrays after opening the proof disclosure', async () => {
    const user = userEvent.setup();
    render(<RuneProofCoach model={emptyRouteModel} onConfirmAction={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Proof and sources' }));

    expect(screen.getByText('No pinned source wording recorded.')).toBeTruthy();
    expect(screen.getByText('No route diagnostics recorded.')).toBeTruthy();
  });
});
