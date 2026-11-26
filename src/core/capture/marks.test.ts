import { beforeEach, describe, expect, it } from 'vitest';
import { computeDelta, snapshotOf } from './delta';
import { DELTA_ATTR, clearMarks, markThreads } from './marks';
import type { CapturedThread } from './types';

const comment = (id: string, text: string) => ({ id, author: 'sam', text, reason: '', via: 'menu' });
const thread = (path: string, c: ReturnType<typeof comment>): CapturedThread => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return { path, range: '1', comments: [c], suggestionLines: [], suggestionBlocks: 0, el };
};

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-prc-marks]').forEach(s => s.remove());
});

describe('markThreads', () => {
  const before = snapshotOf(
    [{ path: 'a.ts', range: '1', comments: [comment('111111', 'one')], suggestionLines: [], suggestionBlocks: 0 },
     { path: 'b.ts', range: '1', comments: [comment('222222', 'two')], suggestionLines: [], suggestionBlocks: 0 }],
    1,
  );

  it('outlines new and edited threads only', () => {
    const now = [thread('a.ts', comment('111111', 'one')), thread('b.ts', comment('222222', 'two v2')), thread('c.ts', comment('333333', 'fresh'))];
    expect(markThreads(now, computeDelta(now, before, new Map()))).toBe(2);
    expect(now.map(t => t.el!.getAttribute(DELTA_ATTR))).toEqual([null, 'edited', 'new']);
    expect(document.querySelectorAll('style[data-prc-marks]')).toHaveLength(1);
  });

  it('marks nothing on a first capture and replaces earlier marks', () => {
    const now = [thread('a.ts', comment('111111', 'one'))];
    expect(markThreads(now, computeDelta(now, null, new Map()))).toBe(0);
    expect(document.querySelector(`[${DELTA_ATTR}]`)).toBeNull();
    expect(document.querySelector('style[data-prc-marks]')).toBeNull();
  });

  it('clears every mark and the stylesheet', () => {
    const now = [thread('c.ts', comment('333333', 'fresh'))];
    markThreads(now, computeDelta(now, before, new Map()));
    clearMarks();
    expect(document.querySelector(`[${DELTA_ATTR}]`)).toBeNull();
    expect(document.querySelector('style[data-prc-marks]')).toBeNull();
  });
});
