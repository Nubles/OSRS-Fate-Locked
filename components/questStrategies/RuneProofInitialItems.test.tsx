// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RuneProofInitialItems } from './RuneProofInitialItems';
import { initialItemModel } from '../../utils/questStrategies/testFixtures';

afterEach(cleanup);

it('confirms and unconfirms the exact reviewed root option', () => {
  const onSetItemConfirmed = vi.fn();
  const model = initialItemModel({
    canonicalItemKey: 'bucket of milk',
    label: 'Bucket of milk',
    quantity: 2,
    evidenceIds: ['review:milk'],
    options: [
      { itemKey: 'bucket of milk', label: 'Bucket of milk', confirmed: false },
      { itemKey: 'milk substitute', label: 'Milk substitute', confirmed: false },
    ],
  });
  const { rerender } = render(<RuneProofInitialItems
    items={[model]}
    onSetItemConfirmed={onSetItemConfirmed}
  />);
  expect(screen.getByText(/2 × Bucket of milk/i)).toBeTruthy();
  expect(screen.getByText('0 of 2 proven')).toBeTruthy();
  expect(screen.getByText(/review:milk/)).toBeTruthy();
  const alternative = screen.getByRole('checkbox', { name: 'Milk substitute' }) as HTMLInputElement;
  fireEvent.click(alternative);
  expect(onSetItemConfirmed).toHaveBeenCalledWith('milk substitute', true);
  expect(alternative.checked).toBe(false);
  expect((screen.getByRole('checkbox', { name: 'Bucket of milk' }) as HTMLInputElement).checked)
    .toBe(false);
  rerender(<RuneProofInitialItems
    items={[{
      ...model,
      provenQuantity: 2,
      options: model.options.map(option => option.itemKey === 'milk substitute'
        ? { ...option, confirmed: true }
        : option),
    }]}
    onSetItemConfirmed={onSetItemConfirmed}
  />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Milk substitute' }));
  expect(onSetItemConfirmed).toHaveBeenLastCalledWith('milk substitute', false);
});

it('renders one labelled family per canonical item without conflating option keys', () => {
  render(<RuneProofInitialItems
    items={[
      initialItemModel(),
      initialItemModel({
        canonicalItemKey: 'egg',
        label: 'Egg',
        options: [{ itemKey: 'egg', label: 'Egg', confirmed: true }],
      }),
    ]}
    onSetItemConfirmed={vi.fn()}
  />);
  expect(screen.getAllByRole('group')).toHaveLength(2);
  expect(screen.getByRole('group', { name: 'Bucket of milk item family' })).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Egg item family' })).toBeTruthy();
});
