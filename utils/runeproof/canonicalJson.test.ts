import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonicalJson';

describe('canonicalJson', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(canonicalJson({
      z: { beta: 2, alpha: 1 },
      a: [{ y: true, x: false }, 'last'],
    })).toBe('{"a":[{"x":false,"y":true},"last"],"z":{"alpha":1,"beta":2}}');
  });

  it('normalizes negative zero without changing other JSON primitives', () => {
    expect(canonicalJson({
      negativeZero: -0,
      nullValue: null,
      text: 'RuneProof',
    })).toBe('{"negativeZero":0,"nullValue":null,"text":"RuneProof"}');
  });

  it.each([
    ['top-level undefined', undefined],
    ['object undefined', { value: undefined }],
    ['array undefined', [undefined]],
    ['non-finite number', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
    ['function', () => undefined],
    ['symbol', Symbol('value')],
    ['bigint', 1n],
  ])('rejects %s rather than silently omitting it', (_label, value) => {
    expect(() => canonicalJson(value)).toThrow('Unsupported canonical JSON value');
  });

  it('rejects sparse arrays and non-index array properties', () => {
    const sparse = Array(2);
    sparse[1] = 'present';
    const decorated = ['value'] as string[] & { metadata?: string };
    decorated.metadata = 'hidden';

    expect(() => canonicalJson(sparse)).toThrow('Sparse arrays are not canonical JSON');
    expect(() => canonicalJson(decorated)).toThrow(
      'Non-index array properties are not canonical JSON',
    );
  });

  it('rejects accessor-backed array indices', () => {
    const accessor = ['placeholder'];
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get: () => 'computed',
    });

    expect(() => canonicalJson(accessor)).toThrow(
      'Canonical JSON arrays require enumerable data properties',
    );
  });

  it('rejects cyclic structures', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(() => canonicalJson(cyclic)).toThrow('Cyclic canonical JSON value');
  });

  it('accepts only ordinary plain objects with enumerable data properties', () => {
    const nullPrototype = Object.create(null) as Record<string, unknown>;
    nullPrototype.value = 1;
    const accessor = Object.defineProperty({}, 'value', {
      enumerable: true,
      get: () => 1,
    });
    const hidden = Object.defineProperty({}, 'value', {
      enumerable: false,
      value: 1,
    });
    const symbolKey = { [Symbol('value')]: 1 };

    expect(() => canonicalJson(new Date(0))).toThrow(
      'Only plain objects are canonical JSON',
    );
    expect(() => canonicalJson(nullPrototype)).toThrow(
      'Only plain objects are canonical JSON',
    );
    expect(() => canonicalJson(accessor)).toThrow(
      'Canonical JSON objects require data properties',
    );
    expect(() => canonicalJson(hidden)).toThrow(
      'Canonical JSON objects require enumerable properties',
    );
    expect(() => canonicalJson(symbolKey)).toThrow(
      'Symbol keys are not canonical JSON',
    );
  });
});
