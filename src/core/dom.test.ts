import { describe, expect, it } from 'vitest';
import { retryBackoff } from './dom';

describe('retryBackoff', () => {
  it('returns at once when the first try is good', async () => {
    const waits: number[] = [];
    const r = await retryBackoff(() => 'ok', v => v === 'ok', [10, 20], async ms => void waits.push(ms));
    expect([r.value, r.retries, waits]).toEqual(['ok', 0, []]);
  });
  it('retries with each delay until the result is good', async () => {
    let n = 0;
    const waits: number[] = [];
    const r = await retryBackoff(() => ++n, v => v >= 3, [10, 20, 40, 80], async ms => void waits.push(ms));
    expect([r.value, r.retries, waits]).toEqual([3, 2, [10, 20]]);
  });
  it('gives up after the last delay and returns the last result', async () => {
    const r = await retryBackoff(() => 'bad', () => false, [1, 2, 3], async () => undefined);
    expect([r.value, r.retries]).toEqual(['bad', 3]);
  });
});
