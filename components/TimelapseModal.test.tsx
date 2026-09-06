// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { TimelapseModal } from './TimelapseModal';
vi.mock('../context/GameContext', () => ({ useGame: () => ({ gameModeId: 'vanilla' }) }));
afterEach(cleanup);
it('keeps legacy history uncertain and calls the export a local history bundle', () => {
  render(<TimelapseModal history={[{ id: 'legacy', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' }]} onClose={() => {}} />);
  expect(screen.getByText('LOCAL CONSISTENCY: NEEDS REVIEW')).toBeTruthy();
  expect(screen.queryByText('LOCAL CONSISTENCY: OK')).toBeNull();
  expect(screen.getByRole('button', { name: 'Export History Bundle' })).toBeTruthy();
  expect(screen.queryByText('Export Verified Bundle')).toBeNull();
});
