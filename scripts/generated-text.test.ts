import { describe, expect, it } from 'vitest';
import {
  generatedTextMatches,
  normalizeGeneratedText,
} from './generated-text.mjs';

describe('generated text comparison', () => {
  it('treats LF, CRLF, and lone CR as the same newline', () => {
    const expected = '{\n  "count": 140\n}\n';
    expect(generatedTextMatches('{\r\n  "count": 140\r\n}\r\n', expected)).toBe(true);
    expect(generatedTextMatches('{\r  "count": 140\r}\r', expected)).toBe(true);
    expect(normalizeGeneratedText(expected)).toBe(expected);
  });

  it('still rejects content, spacing, order, and trailing-newline drift', () => {
    const expected = '{\n  "count": 140\n}\n';
    expect(generatedTextMatches('{\n  "count": 139\n}\n', expected)).toBe(false);
    expect(generatedTextMatches('{\n "count": 140\n}\n', expected)).toBe(false);
    expect(generatedTextMatches('{\n  "count": 140\n}', expected)).toBe(false);
  });
});
