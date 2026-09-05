import { afterEach, beforeEach, vi } from 'vitest';

let errors: unknown[][] = [];
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errors = [];
  errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args); });
});
afterEach(() => {
  errorSpy.mockRestore();
  if (errors.length) throw new Error(`Unexpected console.error (${errors.length}): ${errors.map(args => args.map(String).join(' ')).join('\n')}`);
});
