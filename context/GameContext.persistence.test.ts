import { describe, expect, it } from 'vitest';
import * as GameContext from './GameContext';

type DurableWriter = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  data: string,
  pending: { current: number | null },
  cancel: (handle: number) => void,
) => void;

describe('explicit replacement persistence', () => {
  it('cancels the obsolete debounce only after a durable write succeeds', () => {
    const writeReplacementNow = (
      GameContext as unknown as { writeReplacementNow?: DurableWriter }
    ).writeReplacementNow;
    expect(writeReplacementNow).toBeTypeOf('function');
    if (!writeReplacementNow) return;

    const events: string[] = [];
    const pending = { current: 17 };
    writeReplacementNow({
      setItem: (_key, data) => { events.push('write:' + JSON.parse(data).keys); },
    }, 'profile', '{"keys":9}', pending, handle => { events.push('cancel:' + handle); });
    expect(events).toEqual(['write:9', 'cancel:17']);
    expect(pending.current).toBeNull();

    events.length = 0;
    pending.current = 23;
    expect(() => writeReplacementNow({
      setItem: () => {
        events.push('write');
        throw new Error('quota');
      },
    }, 'profile', '{"keys":9}', pending, handle => { events.push('cancel:' + handle); }))
      .toThrow('quota');
    expect(events).toEqual(['write']);
    expect(pending.current).toBe(23);
  });
});
