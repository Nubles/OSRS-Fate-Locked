import { describe, expect, it } from 'vitest';
import config from '../vitest.config.js';

describe('bot Vitest configuration', () => {
  it('uses a local Node test configuration with bot-only test discovery', () => {
    expect(config.test?.environment).toBe('node');
    expect(config.test?.include).toEqual(['tests/**/*.test.ts']);
  });
});
