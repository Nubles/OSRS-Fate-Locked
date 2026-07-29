const own = Object.prototype.hasOwnProperty;

export function canonicalJson(value: unknown): string {
  return serialize(value, new Set<object>());
}

function serialize(value: unknown, active: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError('Unsupported canonical JSON value: non-finite number');
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint':
      throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
    case 'object':
      return serializeObject(value, active);
  }
}

function serializeObject(value: object, active: Set<object>): string {
  if (active.has(value)) {
    throw new TypeError('Cyclic canonical JSON value');
  }
  active.add(value);
  try {
    if (Array.isArray(value)) return serializeArray(value, active);
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError('Only plain objects are canonical JSON');
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError('Symbol keys are not canonical JSON');
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors) as string[];
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable) {
        throw new TypeError('Canonical JSON objects require enumerable properties');
      }
      if (!own.call(descriptor, 'value')) {
        throw new TypeError('Canonical JSON objects require data properties');
      }
    }
    keys.sort(compareText);
    return `{${keys.map(key =>
      `${JSON.stringify(key)}:${serialize(descriptors[key].value, active)}`,
    ).join(',')}}`;
  } finally {
    active.delete(value);
  }
}

function serializeArray(value: unknown[], active: Set<object>): string {
  for (let index = 0; index < value.length; index += 1) {
    if (!own.call(value, index)) {
      throw new TypeError('Sparse arrays are not canonical JSON');
    }
  }
  const expectedKeys = new Set([
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    'length',
  ]);
  if (Reflect.ownKeys(value).some(key =>
    typeof key !== 'string' || !expectedKeys.has(key))) {
    throw new TypeError('Non-index array properties are not canonical JSON');
  }
  return `[${value.map(child => serialize(child, active)).join(',')}]`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
