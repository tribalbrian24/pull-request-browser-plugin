import { describe, expect, it } from 'vitest';
import { validateCapture, worstSeverity } from './validate';
import type { CapturedThread } from './types';

const thread = (over: Partial<CapturedThread> = {}): CapturedThread => ({
  path: 'src/a.ts',
  range: '10-12',
  comments: [{ id: null, author: 'bot', text: 'Fix this', reason: '', via: 'menu' }],
  suggestionLines: [],
  suggestionBlocks: 0,
  ...over,
});

describe('validateCapture', () => {
  it('passes a clean capture', () => {
    expect(validateCapture({ threads: [thread()], expected: 1, skipped: 0, excluded: 0, resolvedSkipped: 0 })).toEqual([]);
  });

  it('errors when no threads are on the page', () => {
    const issues = validateCapture({ threads: [], expected: 0, skipped: 0, excluded: 0, resolvedSkipped: 0 });
    expect(worstSeverity(issues)).toBe('error');
    expect(issues[0].message).toMatch(/thread\.all/);
  });

  it('errors on skipped threads and failed comments', () => {
    const t = thread({ comments: [{ id: null, author: '', text: null, reason: 'menu never opened', via: 'none' }] });
    const issues = validateCapture({ threads: [t], expected: 2, skipped: 1, excluded: 0, resolvedSkipped: 0 });
    expect(issues.map(i => i.message)).toEqual([
      '1 of 2 thread(s) skipped: no file path found (locator "thread.path")',
      'src/a.ts:10-12: menu never opened',
    ]);
    expect(worstSeverity(issues)).toBe('error');
  });

  it('warns on missing range, empty suggestion parse and unnumbered lines', () => {
    const issues = validateCapture({
      threads: [
        thread({ range: '' }),
        thread({ suggestionBlocks: 1 }),
        thread({ suggestionLines: ['+ no number'], suggestionBlocks: 1 }),
      ],
      expected: 3,
      skipped: 0,
      excluded: 0,
      resolvedSkipped: 0,
    });
    expect(issues.map(i => i.severity)).toEqual(['warn', 'warn', 'warn']);
    expect(worstSeverity(issues)).toBe('warn');
  });

  it('notes rendered-HTML fallbacks as info', () => {
    const t = thread({ comments: [{ id: null, author: 'h', text: 'ok text', reason: '', via: 'rendered HTML' }] });
    const issues = validateCapture({ threads: [t], expected: 1, skipped: 0, excluded: 0, resolvedSkipped: 0 });
    expect(issues).toEqual([{ severity: 'info', message: '1 comment(s) came from rendered HTML (less exact than Copy Markdown)' }]);
    expect(worstSeverity(issues)).toBe('info');
  });

  it('caps long lists', () => {
    const many = Array.from({ length: 12 }, (_, i) => thread({ path: `f${i}.ts`, range: '' }));
    const issues = validateCapture({ threads: many, expected: 12, skipped: 0, excluded: 0, resolvedSkipped: 0 });
    expect(issues).toHaveLength(9);
    expect(issues[8].message).toBe('+4 more');
  });

  it('returns null severity for no issues', () => {
    expect(worstSeverity([])).toBeNull();
  });

  it('reports threads left out by the agent filter as info only', () => {
    const issues = validateCapture({ threads: [thread()], expected: 2, skipped: 0, excluded: 1, resolvedSkipped: 0 });
    expect(issues).toEqual([{ severity: 'info', message: '1 thread(s) left out by the agent filter' }]);
  });

  it('does not ask a review summary for a line range', () => {
    const r = thread({ kind: 'review', path: 'Review summary', range: '' });
    expect(validateCapture({ threads: [r], expected: 1, skipped: 0, excluded: 0, resolvedSkipped: 0 })).toEqual([]);
  });

  it('says why the menu did not supply Copy Markdown', () => {
    const c = (reason: string) => ({ id: null, author: 'h', text: 'ok text', reason, via: 'rendered HTML' });
    const t = thread({ comments: [c('no "Copy Markdown" in menu (items: Copy link)'), c('no "Copy Markdown" in menu (items: Copy link)')] });
    expect(validateCapture({ threads: [t], expected: 1, skipped: 0, excluded: 0, resolvedSkipped: 0 })).toEqual([
      { severity: 'info', message: '2 comment(s) came from rendered HTML (less exact than Copy Markdown). The menu said: no "Copy Markdown" in menu (items: Copy link)' },
    ]);
  });

  it('tells you when resolved threads were left out', () => {
    const base = { expected: 1, skipped: 0, excluded: 0, resolvedSkipped: 3 };
    const review = thread({ kind: 'review', path: 'Review summary', range: '' });
    const onlyReview = validateCapture({ ...base, threads: [review] });
    expect(onlyReview).toEqual([{ severity: 'warn', message: '3 resolved thread(s) left out. Tick "Include resolved threads" to capture them.' }]);
    expect(validateCapture({ ...base, threads: [review, thread()] })[0].severity).toBe('info');
    expect(validateCapture({ ...base, expected: 0, threads: [] })).toEqual(onlyReview);
  });

  it('warns when a capture was stopped early', () => {
    const issues = validateCapture({ threads: [thread()], expected: 5, skipped: 0, excluded: 0, resolvedSkipped: 0, aborted: true });
    expect(issues).toEqual([{ severity: 'warn', message: 'Capture was stopped early: 1 of 5 item(s) were read.' }]);
  });
});

