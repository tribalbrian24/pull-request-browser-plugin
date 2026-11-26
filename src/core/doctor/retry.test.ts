import { beforeEach, describe, expect, it } from 'vitest';
import { HOOK_ATTR } from '../clipboard';
import { LocatorRegistry } from '../locators/registry';
import { runDoctorWithRetry } from './retry';

const THREAD = (path: string) => `<review-thread-collapsible>${path}<button class="review-thread-chevron" aria-expanded="true"></button>
  <table class="diff-table"><tbody><tr><td data-line-number="5"></td></tr></tbody></table>
  <div class="review-comment"><a class="author">sam</a><button data-testid="comment-header-hamburger"></button><div class="comment-body">hi</div></div></review-thread-collapsible>`;
const PATH = '<a class="text-mono" href="#x">f.ts</a>';
const opts = { pathname: '/o/r/pull/1' };

beforeEach(() => {
  document.documentElement.setAttribute(HOOK_ATTR, '1');
  document.body.innerHTML = '';
});

describe('runDoctorWithRetry', () => {
  it('does not wait at all when everything is already fine', async () => {
    document.body.innerHTML = THREAD(PATH);
    const waits: number[] = [];
    const r = await runDoctorWithRetry(new LocatorRegistry(), opts, { sleep: async ms => void waits.push(ms) });
    expect([r.level, r.retries, waits]).toEqual(['ok', 0, []]);
  });

  it('settles to green when the page finishes loading during the back off', async () => {
    document.body.innerHTML = THREAD(''); // file path link not rendered yet
    const waits: number[] = [];
    const seen: number[] = [];
    const r = await runDoctorWithRetry(new LocatorRegistry(), opts, {
      onRetry: n => seen.push(n),
      sleep: async ms => {
        waits.push(ms);
        if (waits.length === 2) document.querySelector('review-thread-collapsible')!.insertAdjacentHTML('afterbegin', PATH);
      },
    });
    expect(r.level).toBe('ok');
    expect(r.retries).toBe(2);
    expect(waits).toEqual([250, 500]);
    expect(seen).toEqual([1, 2]);
  });

  it('stays red only after five growing retries when the selectors really do not work', async () => {
    document.body.innerHTML = THREAD('');
    const waits: number[] = [];
    const r = await runDoctorWithRetry(new LocatorRegistry(), opts, { sleep: async ms => void waits.push(ms) });
    expect(r.level).toBe('error');
    expect(r.retries).toBe(5);
    expect(waits).toEqual([250, 500, 1000, 2000, 3000]);
  });

  it('does not retry on pages that are not pull requests, or for problems that retrying cannot fix', async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    expect((await runDoctorWithRetry(new LocatorRegistry(), { pathname: '/o/r' }, { sleep })).retries).toBe(0);
    document.body.innerHTML = THREAD(PATH);
    const r = await runDoctorWithRetry(new LocatorRegistry(), { ...opts, lastCapture: [{ severity: 'warn', message: 'x' }] }, { sleep });
    expect([r.level, r.retries, waits]).toEqual(['warn', 0, []]);
  });
});
