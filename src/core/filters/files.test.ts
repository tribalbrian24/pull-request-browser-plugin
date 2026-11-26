import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry } from '../locators/registry';
import { hunkKind, parsePathText, readFileEntries, statusOf } from './files';
import { row, rowNew } from './testing';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('hunkKind', () => {
  it('detects added, deleted and modified files', () => {
    expect(hunkKind('@@ -0,0 +1,10 @@')).toBe('added');
    expect(hunkKind('@@ -0,0 +1 @@')).toBe('added');
    expect(hunkKind('@@ -1,10 +0,0 @@')).toBe('deleted');
    expect(hunkKind('@@ -1 +0,0 @@')).toBe('deleted');
    expect(hunkKind('@@ -1,5 +1,5 @@')).toBe('modified');
    expect(hunkKind('@@ -12,3 +12,4 @@ function f() {')).toBe('modified');
    expect(hunkKind('not a hunk')).toBeNull();
  });
});

describe('statusOf', () => {
  it('combines rename and hunk information', () => {
    expect(statusOf('@@ -1,5 +1,5 @@', true)).toBe('renamed-modified');
    expect(statusOf(null, true)).toBe('renamed');
    expect(statusOf(null, false)).toBe('unknown');
    expect(statusOf('@@ -1,5 +1,5 @@', false)).toBe('modified');
  });
});

describe('parsePathText', () => {
  it('reads plain, renamed and arrow forms', () => {
    expect(parsePathText('\u200esrc/a.ts\u200e')).toEqual({ path: 'src/a.ts' });
    expect(parsePathText('src/a.ts renamed to packages/x/src/a.ts ')).toEqual({ oldPath: 'src/a.ts', path: 'packages/x/src/a.ts' });
    expect(parsePathText('old.ts → new.ts')).toEqual({ oldPath: 'old.ts', path: 'new.ts' });
  });
});

describe('readFileEntries', () => {
  it('reads path, rename and status from rows', () => {
    document.body.innerHTML = [
      row(1, 'src/new.ts', '@@ -0,0 +1,3 @@'),
      row(2, 'src/gone.test.ts', '@@ -1,3 +0,0 @@'),
      row(3, 'packages/ui/src/Button.ts', '@@ -1,5 +1,5 @@', 'src/Button.ts'),
      row(4, 'src/big.ts', null),
      '<div data-path-digest="x" data-index="9"></div>',
    ].join('');
    const entries = readFileEntries(new LocatorRegistry());
    expect(entries.map(e => [e.index, e.status, e.path, e.oldPath])).toEqual([
      [1, 'added', 'src/new.ts', undefined],
      [2, 'deleted', 'src/gone.test.ts', undefined],
      [3, 'renamed-modified', 'packages/ui/src/Button.ts', 'src/Button.ts'],
      [4, 'unknown', 'src/big.ts', undefined],
    ]);
  });

  it('flags binary files from the page notice only when no hunk is present', () => {
    document.body.innerHTML = row(1, 'a.bin', null).replace('</h3>', '</h3><div>Binary file not shown.</div>') + row(2, 'b.ts', null) + row(3, 'c.ts', '@@ -1 +1 @@');
    expect(readFileEntries(new LocatorRegistry()).map(e => e.binary)).toEqual([true, false, false]);
  });

  it('reads the newer layout, where the digest is the section id and there is no data-index', () => {
    document.body.innerHTML = [rowNew(1, 'src/new.ts', '@@ -0,0 +1,3 @@'), rowNew(2, 'src/gone.ts', '@@ -1,3 +0,0 @@'), '<div id="diff-notahex"><h3><a><code>x</code></a></h3></div>'].join('');
    const entries = readFileEntries(new LocatorRegistry());
    expect(entries.map(e => [e.index, e.status, e.path])).toEqual([[0, 'added', 'src/new.ts'], [1, 'deleted', 'src/gone.ts']]);
    expect(entries[0].digest).toBe('0'.repeat(63) + '1');
  });
});

