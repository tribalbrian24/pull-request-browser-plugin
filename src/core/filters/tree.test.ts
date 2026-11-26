import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry } from '../locators/registry';
import { HideController } from './hide';
import { BUILTIN_LAYER } from './lists';
import { PRESETS } from './presets';
import { FilterRunner } from './runner';
import { digest, rowNew } from './testing';

// Shape taken from GitHub's file tree: ul[role=tree] > li[role=treeitem][id=<path>] (folders have aria-expanded) > ul[role=group] > files.
const file = (path: string) => `<li role="treeitem" id="${path}" aria-level="2" aria-label="${path.split('/').pop()}"></li>`;
const folder = (path: string, children: string) => `<li role="treeitem" id="${path}" aria-level="1" aria-expanded="true"><ul role="group">${children}</ul></li>`;
const TREE = `<ul role="tree" aria-label="File Tree">
  ${folder('.github/workflows', file('.github/workflows/ci.yml'))}
  ${folder('src', folder('src/__tests__', file('src/__tests__/a.test.ts') + file('src/__tests__/b.test.ts')) + file('src/a.ts'))}
  ${folder('docs', file('docs/guide.md'))}
</ul>`;

const preset = (id: string) => PRESETS.find(p => p.id === id)!;
const shown = (path: string) => getComputedStyle(document.getElementById(path)!).display !== 'none';

function setup() {
  const hide = new HideController();
  const runner = new FilterRunner({ reg: new LocatorRegistry(), getLayers: () => [BUILTIN_LAYER], repo: () => 'o/r', hide });
  return { hide, runner };
}

beforeEach(() => {
  document.body.innerHTML = TREE;
  document.head.querySelectorAll('style[data-prc-hide]').forEach(s => s.remove());
});

describe('file tree filtering', () => {
  it('hides test files in the tree even when their diffs are not rendered, and folders that become empty', () => {
    const { runner } = setup();
    runner.start(preset('hide-tests'));
    expect(shown('src/__tests__/a.test.ts')).toBe(false);
    expect(shown('src/__tests__/b.test.ts')).toBe(false);
    expect(shown('src/__tests__')).toBe(false); // every file in it is hidden
    expect(shown('src')).toBe(true); // still has src/a.ts
    expect(shown('src/a.ts')).toBe(true);
    expect(shown('.github/workflows/ci.yml')).toBe(true);
    runner.stop();
    expect(document.querySelector('style[data-prc-hide]')).toBeNull();
    expect(shown('src/__tests__/a.test.ts')).toBe(true);
  });

  it('"only tests" keeps only folders that still contain a test', () => {
    const { runner } = setup();
    runner.start(preset('only-tests'));
    expect(shown('src/__tests__/a.test.ts')).toBe(true);
    expect(shown('src')).toBe(true);
    expect(shown('src/a.ts')).toBe(false);
    expect(shown('.github/workflows')).toBe(false);
    expect(shown('docs')).toBe(false);
    runner.stop();
  });

  it('status filters only affect tree files whose diff is known, and leave the rest visible', () => {
    document.body.insertAdjacentHTML('beforeend', rowNew(1, 'src/__tests__/a.test.ts', '@@ -1,3 +1,4 @@') + rowNew(2, 'src/a.ts', '@@ -1,3 +0,0 @@'));
    const { runner } = setup();
    runner.start(preset('tests-removed')); // deleted test files only
    expect(shown('src/__tests__/a.test.ts')).toBe(false); // known: edited, not deleted
    expect(shown('src/a.ts')).toBe(false); // known: deleted but not a test
    expect(shown('src/__tests__/b.test.ts')).toBe(true); // status not known yet: left alone
    expect(shown('docs/guide.md')).toBe(true);
    runner.stop();
  });

  it('copes with paths that need CSS escaping and with a page that has no tree', () => {
    document.body.innerHTML = '<ul role="tree" aria-label="File Tree"><li role="treeitem"></li></ul>';
    document.querySelector('li')!.id = 'weird "dir"\\x/x.test.ts'; // quotes and a backslash in a path
    const { runner } = setup();
    runner.start(preset('hide-tests'));
    expect(shown('weird "dir"\\x/x.test.ts')).toBe(false);
    runner.stop();
    document.body.innerHTML = rowNew(1, 'src/a.test.ts', '@@ -1 +1 @@');
    runner.start(preset('hide-tests'));
    expect(document.getElementById(`diff-${digest(1)}`) !== null).toBe(true);
    runner.stop();
  });
});
