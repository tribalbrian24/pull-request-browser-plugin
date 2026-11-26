import { describe, expect, it } from 'vitest';
import { applyDelta, commentKey, computeDelta, formatTime, hashText, prune, snapshotOf } from './delta';
import { renderMarkdown } from './markdown';
import type { CapturedThread } from './types';

const c = (id: string | null, text: string | null, author = 'sam') => ({ id, author, text, reason: '', via: 'menu' });
const t = (path: string, comments: ReturnType<typeof c>[], range = '1'): CapturedThread => ({
  path,
  range,
  comments,
  suggestionLines: [],
  suggestionBlocks: 0,
});

describe('hashText', () => {
  it('is stable and sensitive to edits', () => {
    expect(hashText('a')).toBe(hashText('a'));
    expect(hashText('a')).not.toBe(hashText('b'));
    expect(hashText('')).toHaveLength(8);
  });
});

describe('snapshotOf and keys', () => {
  it('keys by id when present and falls back to path|index|author', () => {
    const th = t('a.ts', [c('111111', 'x'), c(null, 'y', 'bot'), c('222222', null)]);
    expect(commentKey(th, 0)).toBe('c111111');
    expect(commentKey(th, 1)).toBe('a.ts|1|bot');
    expect(Object.keys(snapshotOf([th], 5).entries)).toEqual(['c111111', 'a.ts|1|bot']);
  });
});

describe('computeDelta', () => {
  const before = snapshotOf([t('a.ts', [c('111111', 'one')]), t('b.ts', [c('222222', 'two')]), t('c.ts', [c('333333', 'three')])], 1000);

  it('marks everything new without a snapshot', () => {
    const d = computeDelta([t('a.ts', [c('111111', 'one')])], null, new Map());
    expect(d.counts).toEqual({ new: 1, edited: 0, unchanged: 0 });
    expect(d.since).toBeNull();
  });

  it('classifies new, edited and unchanged comments', () => {
    const now = [t('a.ts', [c('111111', 'one')]), t('b.ts', [c('222222', 'two (edited)')]), t('d.ts', [c('444444', 'fresh')])];
    const d = computeDelta(now, before, new Map());
    expect(d.status.get('c111111')).toBe('unchanged');
    expect(d.status.get('c222222')).toBe('edited');
    expect(d.status.get('c444444')).toBe('new');
    expect(d.since).toBe(1000);
  });

  it('separates resolved from missing using the page scan', () => {
    const d = computeDelta([t('a.ts', [c('111111', 'one')])], before, new Map([['222222', true]]));
    expect(d.resolved.map(e => e.path)).toEqual(['b.ts']);
    expect(d.missing.map(e => e.path)).toEqual(['c.ts']);
  });

  it('ignores snapshot entries that are still open but not captured', () => {
    const d = computeDelta([], before, new Map([['111111', false], ['222222', false], ['333333', false]]));
    expect(d.resolved).toEqual([]);
    expect(d.missing).toEqual([]);
  });

  it('ignores the "Originally posted by" boilerplate when comparing', () => {
    const snap = snapshotOf([t('a.ts', [c('111111', 'one')])], 1);
    const d = computeDelta([t('a.ts', [c('111111', 'one\n\n_Originally posted by @x in #1_')])], snap, new Map());
    expect(d.status.get('c111111')).toBe('unchanged');
  });
});

describe('applyDelta', () => {
  const before = snapshotOf([t('a.ts', [c('111111', 'one')]), t('b.ts', [c('222222', 'two')]), t('gone.ts', [c('999999', 'x')], '7')], Date.now() - 60000);
  const now = [t('a.ts', [c('111111', 'one')]), t('b.ts', [c('222222', 'two v2')]), t('n.ts', [c('444444', 'new!')])];
  const delta = computeDelta(now, before, new Map([['999999', true]]));

  it('all mode leaves threads untouched and adds no header', () => {
    expect(applyDelta(now, delta, 'all')).toEqual({ threads: now, header: '' });
  });

  it('new-edited keeps only changed comments, tags them, and summarises', () => {
    const r = applyDelta(now, delta, 'new-edited');
    expect(r.threads.map(x => x.path)).toEqual(['b.ts', 'n.ts']);
    expect(r.header).toMatch(/^## Changes since \d{4}-\d{2}-\d{2} \d{2}:\d{2}\n- 1 new, 1 edited, 1 unchanged \(left out\)$/);
    expect(renderMarkdown(r.threads)).toBe('# `b.ts:1`\n\n**sam (edited):**\n\ntwo v2\n\n# `n.ts:1`\n\n**sam (new):**\n\nnew!');
  });

  it('changes mode also lists resolved and missing items', () => {
    const r = applyDelta(now, delta, 'changes');
    expect(r.header).toContain('- resolved: `gone.ts:7`');
  });

  it('first capture says so', () => {
    const r = applyDelta(now, computeDelta(now, null, new Map()), 'new-edited');
    expect(r.header).toMatch(/^## First capture of this PR/);
    expect(r.threads).toHaveLength(3);
  });
});

describe('helpers', () => {
  it('formats local time', () => {
    expect(formatTime(new Date(2025, 0, 15, 9, 5).getTime())).toBe('2025-01-15 09:05');
  });
  it('prunes to the newest snapshots', () => {
    const all = { a: { at: 1, entries: {} }, b: { at: 3, entries: {} }, c: { at: 2, entries: {} } };
    expect(Object.keys(prune(all, 2)).sort()).toEqual(['b', 'c']);
  });
});
