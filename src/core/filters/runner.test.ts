import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry } from '../locators/registry';
import { digest, row, rowNew } from './testing';
import { HideController } from './hide';
import { BUILTIN_LAYER } from './lists';
import { PRESETS, decide, type Filter } from './presets';
import { FilterRunner } from './runner';

const preset = (id: string) => PRESETS.find(p => p.id === id)!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function setup() {
  const hide = new HideController();
  const runner = new FilterRunner({ reg: new LocatorRegistry(), getLayers: () => [BUILTIN_LAYER], repo: () => 'o/r', hide });
  return { hide, runner };
}
const css = () => document.querySelector('style[data-prc-hide]')?.textContent ?? '';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-prc-hide]').forEach(s => s.remove());
});

describe('presets', () => {
  it('every preset explains itself on hover', () => {
    for (const p of PRESETS) expect((p.hint ?? '').length > 20).toBe(true);
  });
});

describe('decide', () => {
  const never = () => false;
  const always = () => true;
  it('show-only keeps matches and hides the rest', () => {
    const f = preset('tests-removed');
    expect(decide(f, 'deleted', always)).toBe('keep');
    expect(decide(f, 'modified', always)).toBe('hide');
    expect(decide(f, 'deleted', never)).toBe('hide');
  });
  it('hide mode hides matches', () => {
    expect(decide(preset('hide-tests'), 'modified', always)).toBe('hide');
    expect(decide(preset('hide-tests'), 'modified', never)).toBe('keep');
  });
  it('never hides files whose status is unknown under a status filter', () => {
    expect(decide(preset('only-new'), 'unknown', never)).toBe('keep');
    expect(decide(preset('hide-tests'), 'unknown', never)).toBe('keep');
  });
  it('renamed presets include renamed-modified', () => {
    expect(decide(preset('only-renamed'), 'renamed-modified', never)).toBe('keep');
    expect(decide(preset('only-edited'), 'renamed', never)).toBe('hide');
  });
  it('supports a custom filter', () => {
    const f: Filter = { id: 'x', label: 'x', mode: 'hide', statuses: ['added'], list: { id: 'docs', in: true } };
    expect(decide(f, 'added', always)).toBe('hide');
    expect(decide(f, 'added', never)).toBe('keep');
  });
});

describe('HideController', () => {
  it('injects one stylesheet and removes it on clear', () => {
    const hide = new HideController();
    hide.set([digest(1), digest(2), 'not-hex"]{}']);
    expect(document.querySelectorAll('style[data-prc-hide]')).toHaveLength(1);
    expect(css()).toContain(`[data-path-digest="${digest(1)}"][data-index],#diff-${digest(1)}{display:none !important}`);
    expect(css()).not.toContain('not-hex');
    expect(hide.size).toBe(2);
    hide.clear();
    expect(document.querySelector('style[data-prc-hide]')).toBeNull();
  });
});

describe('FilterRunner', () => {
  it('"tests removed" hides everything except deleted test files and reports undetermined rows', () => {
    document.body.innerHTML = [
      row(1, 'src/a.test.ts', '@@ -1,3 +0,0 @@'),
      row(2, 'src/b.test.ts', '@@ -1,3 +1,4 @@'),
      row(3, 'src/c.ts', '@@ -1,3 +0,0 @@'),
      row(4, 'src/d.test.ts', null),
    ].join('');
    const { runner, hide } = setup();
    runner.start(preset('tests-removed'));
    expect(hide.has(digest(1))).toBe(false);
    expect(hide.has(digest(2))).toBe(true);
    expect(hide.has(digest(3))).toBe(true);
    expect(hide.has(digest(4))).toBe(false);
    const s = runner.stats();
    expect(s).toEqual({ rendered: 4, hidden: 2, undetermined: 1, byStatus: { added: 0, deleted: 2, modified: 1, renamed: 0, 'renamed-modified': 0, unknown: 1 } });
    runner.stop();
  });

  it('keeps decisions for rows that scroll out and applies the filter to rows that scroll in', async () => {
    document.body.innerHTML = row(1, 'src/a.test.ts', '@@ -1,3 +1,4 @@');
    const { runner, hide } = setup();
    runner.start(preset('hide-tests'));
    expect(hide.has(digest(1))).toBe(true);

    document.body.innerHTML = '';
    runner.refresh();
    expect(hide.has(digest(1))).toBe(true);

    document.body.insertAdjacentHTML('beforeend', row(2, 'src/z.test.ts', '@@ -1 +1 @@') + row(3, 'src/z.ts', '@@ -1 +1 @@'));
    await sleep(300);
    expect(hide.has(digest(2))).toBe(true);
    expect(hide.has(digest(3))).toBe(false);
    runner.stop();
  });

  it('restores everything on stop without re-reading the page', () => {
    document.body.innerHTML = row(1, 'src/a.test.ts', '@@ -1,3 +1,4 @@');
    const { runner } = setup();
    runner.start(preset('hide-tests'));
    expect(css()).not.toBe('');
    runner.stop();
    expect(css()).toBe('');
    expect(runner.active).toBeNull();
  });

  it('matches a renamed file by its old path too', () => {
    document.body.innerHTML = row(1, 'packages/x/a.ts', '@@ -1 +1 @@', 'src/a.test.ts');
    const { runner, hide } = setup();
    runner.start(preset('hide-tests'));
    expect(hide.has(digest(1))).toBe(true);
    runner.stop();
  });

  it('hides images and SVGs but not code, and "hide binary" also honours the page notice', () => {
    document.body.innerHTML = [
      row(1, 'assets/logo.SVG', '@@ -1 +1 @@'),
      row(2, 'assets/photo.png', null),
      row(3, 'src/a.ts', '@@ -1 +1 @@'),
      row(4, 'data/blob.dat', null).replace('</h3>', '</h3><div>Binary file not shown.</div>'),
    ].join('');
    const { runner, hide } = setup();
    runner.start(preset('hide-images'));
    expect([1, 2, 3, 4].map(n => hide.has(digest(n)))).toEqual([true, true, false, false]);
    runner.start(preset('hide-binary'));
    expect([1, 2, 3, 4].map(n => hide.has(digest(n)))).toEqual([true, true, false, true]);
    runner.stop();
  });

  it('hides sections of the newer layout through their id', () => {
    document.body.innerHTML = [rowNew(1, 'src/a.test.ts', '@@ -1 +1 @@'), rowNew(2, 'src/a.ts', '@@ -1 +1 @@')].join('');
    const { runner, hide } = setup();
    runner.start(preset('hide-tests'));
    expect([hide.has(digest(1)), hide.has(digest(2))]).toEqual([true, false]);
    expect(css()).toContain(`#diff-${digest(1)}{display:none !important}`);
    const hiddenEl = document.getElementById(`diff-${digest(1)}`)!;
    expect(getComputedStyle(hiddenEl).display).toBe('none');
    expect(getComputedStyle(document.getElementById(`diff-${digest(2)}`)!).display).not.toBe('none');
    runner.stop();
  });
});

