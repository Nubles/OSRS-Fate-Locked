import { describe, expect, it } from 'vitest';
import {
  ENTRY_GZIP_BUDGET_KB,
  entryScriptPath,
  evaluateEntryBudget,
} from './check-entry-budget.mjs';

describe('entry chunk budget', () => {
  it('finds the module entry script that index.html loads', () => {
    const html = '<script type="module" crossorigin src="/OSRS-Fate-Locked/assets/index-AbC123.js"></script>'
      + '<link rel="modulepreload" href="/OSRS-Fate-Locked/assets/vendor-react-X.js">';
    expect(entryScriptPath('dist', html)).toBe('dist/assets/index-AbC123.js');
    expect(() => entryScriptPath('dist', '<html></html>')).toThrow('no module entry script');
  });

  it('passes at the budget and fails above it', () => {
    expect(evaluateEntryBudget(ENTRY_GZIP_BUDGET_KB * 1000).ok).toBe(true);
    expect(evaluateEntryBudget(ENTRY_GZIP_BUDGET_KB * 1000 + 1).ok).toBe(false);
    expect(evaluateEntryBudget(216_300)).toEqual({ ok: true, gzipKb: 216.3, budgetKb: ENTRY_GZIP_BUDGET_KB });
  });
});
