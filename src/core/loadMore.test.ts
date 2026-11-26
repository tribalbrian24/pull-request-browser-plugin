import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry } from './locators/registry';
import { clickAllLoadMore } from './loadMore';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('clickAllLoadMore', () => {
  it('clicks buttons until none remain, following newly added ones', async () => {
    document.body.innerHTML = '<button id="a">Load more…</button><button id="skip">Reply</button>';
    let loads = 0;
    const bind = (id: string, next?: string) =>
      document.getElementById(id)!.addEventListener('click', e => {
        loads++;
        (e.target as HTMLElement).remove();
        if (next) {
          document.body.insertAdjacentHTML('beforeend', `<button id="${next}">Load diff</button>`);
          bind(next);
        }
      });
    bind('a', 'b');
    const r = await clickAllLoadMore(new LocatorRegistry(), { quietMs: 20 });
    expect(loads).toBe(2);
    expect(r).toEqual({ clicks: 2, rounds: 2, capped: false });
    expect(document.getElementById('skip')).not.toBeNull();
  });

  it('ignores disabled and expanded toggles, and respects the per-button cap', async () => {
    document.body.innerHTML =
      '<button disabled>Load more</button><button aria-expanded="true">Show hidden</button><button id="s">Load more</button>';
    const r = await clickAllLoadMore(new LocatorRegistry(), { quietMs: 10, maxClicksPerButton: 3 });
    expect(r.clicks).toBe(3);
  });
});
