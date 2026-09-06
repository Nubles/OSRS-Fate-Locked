// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { QuestRequiredMap } from './QuestRequiredMap';
import type { QuestAccessNode } from './questAccess';
afterEach(cleanup);
const chunk = (cx: number, status: 'met' | 'locked'): QuestAccessNode => ({ id: String(cx), kind: 'chunk', label: `${cx},50`, cx, cy: 50, status });
it('counts unique selected chunks and keeps alternatives separate', async () => {
  const user = userEvent.setup();
  render(<QuestRequiredMap geography={{ id: 'root', kind: 'all', label: 'Required', status: 'locked', children: [
    { id: 'start', kind: 'any', label: 'Quest giver', status: 'met', children: [chunk(50,'met')] },
    { id: 'routes', kind: 'any', label: 'Travel route', status: 'locked', children: [
      { id: 'a', kind: 'all', label: 'North', status: 'locked', children: [chunk(50,'met'),chunk(51,'locked')] },
      { id: 'b', kind: 'all', label: 'South', status: 'locked', children: [chunk(52,'locked')] },
    ] },
  ] }} />);
  expect(screen.getByText('1 of 2 required chunks unlocked on the selected route')).toBeTruthy();
  const start = screen.getByRole('button', { name: /Chunk 50,50:/ });
  expect(start.getAttribute('stroke')).toBe('#4ade80');
  expect(screen.getByRole('button', { name: /Chunk 51,50:/ }).getAttribute('stroke')).toBe('#f87171');
  await user.click(start);
  expect(screen.getByRole('status').textContent).toContain('Quest giver');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Travel route' }), '1');
  expect(screen.queryByRole('button', { name: /Chunk 51,50:/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Chunk 52,50:/ })).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
