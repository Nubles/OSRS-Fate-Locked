// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashView, watchHashView } from './hashView';

describe('hashView', () => {
  it('picks the page the address asks for', () => {
    expect(hashView('')).toEqual({ kind: 'app' });
    expect(hashView('#/overlay?code=ABC')).toEqual({ kind: 'overlay' });
    expect(hashView('#/log/OoNe2GA1hYXwsYtC5HWEow')).toEqual({ kind: 'log', id: 'OoNe2GA1hYXwsYtC5HWEow' });
  });

  it('keeps only the id when a chat app adds to a pasted log link', () => {
    expect(hashView('#/log/OoNe2GA1hYXwsYtC5HWEow/')).toEqual({ kind: 'log', id: 'OoNe2GA1hYXwsYtC5HWEow' });
    expect(hashView('#/log/OoNe2GA1hYXwsYtC5HWEow?x=1')).toEqual({ kind: 'log', id: 'OoNe2GA1hYXwsYtC5HWEow' });
  });
});

describe('watchHashView', () => {
  let stop = () => {};
  afterEach(() => { stop(); window.location.hash = ''; });

  const changeHash = (hash: string) => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  it('reloads when a log link is pasted into a tab showing the app', () => {
    const reload = vi.fn();
    stop = watchHashView({ kind: 'app' }, reload);
    changeHash('#/log/OoNe2GA1hYXwsYtC5HWEow');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('leaves the page alone when the hash still means the page showing', () => {
    const reload = vi.fn();
    stop = watchHashView({ kind: 'log', id: 'OoNe2GA1hYXwsYtC5HWEow' }, reload);
    changeHash('#/log/OoNe2GA1hYXwsYtC5HWEow/');
    expect(reload).not.toHaveBeenCalled();
    changeHash('#/log/AAAAAAAAAAAAAAAAAAAAAA');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
