/**
 * Remembers a function's last call. When every argument is the same value
 * (Object.is) as on the call before, it returns the last result instead of
 * calling the function again.
 *
 * Meant for pure functions of game state. State is replaced, never edited in
 * place, so the same object means the same contents: a level-up hands back a
 * new state and a new unlocks object, and the next call works it out afresh.
 * Only the last call is kept, so nothing old is held on to.
 */
export function memoizeLast<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let last: { args: A; result: R } | null = null;
  return (...args: A): R => {
    if (
      last !== null
      && last.args.length === args.length
      && last.args.every((value, index) => Object.is(value, args[index]))
    ) return last.result;
    const result = fn(...args);
    last = { args, result };
    return result;
  };
}
