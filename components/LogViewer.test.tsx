import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LogEntry } from '../types';
import * as logViewerModule from './LogViewer';

describe('LogViewer roll history', () => {
  it('renders mode-modified effective and base thresholds with a decimal roll', () => {
    const LogRow = (logViewerModule as Record<string, unknown>).LogRow as React.ComponentType<{
      index: number;
      style: React.CSSProperties;
      data: { entries: LogEntry[] };
    }>;
    expect(LogRow).toBeTypeOf('function');

    const entry: LogEntry = {
      id: 'mode-roll',
      timestamp: 0,
      type: 'ROLL_SUCCESS',
      message: 'Key Found!',
      details: 'Mode-modified roll.',
      result: 'SUCCESS',
      source: 'Attack level 42',
      rollValue: 8.4,
      baseThreshold: 8.4,
      threshold: 9.4,
    };
    const html = renderToStaticMarkup(
      <LogRow index={0} style={{}} data={{ entries: [entry] }} />,
    );

    expect(html).toContain('8.4');
    expect(html).toContain('9.4%');
    expect(html).toContain('(8.4% base)');
    expect(html).toContain('Base chance before mode modifiers');
  });
});