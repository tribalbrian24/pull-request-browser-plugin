import { beforeEach, describe, expect, it } from 'vitest';
import { HOOK_ATTR } from '../clipboard';
import { row, rowNew } from '../filters/testing';
import { LocatorRegistry } from '../locators/registry';
import { keysForCheck, pageKind, runDoctor } from './checks';

const THREAD = `<review-thread-collapsible>
  <a class="text-mono" href="#xR9">f.ts</a>
  <button class="review-thread-chevron" aria-expanded="true"></button>
  <div>Comment on lines +1 to +2</div>
  <div class="review-comment"><a class="author">sam</a><button data-testid="comment-header-hamburger"></button>
    <div class="comment-body">hi</div></div>
</review-thread-collapsible>`;

const run = (path = '/o/r/pull/1') => runDoctor(new LocatorRegistry(), { pathname: path });
const status = (r: ReturnType<typeof run>, id: string) => r.checks.find(c => c.id === id)?.status;

beforeEach(() => {
  document.documentElement.removeAttribute(HOOK_ATTR);
  document.body.innerHTML = '';
});

describe('pageKind', () => {
  it('classifies PR pages', () => {
    expect(pageKind('/o/r/pull/1')).toBe('conversation');
    expect(pageKind('/o/r/pull/1/files')).toBe('files');
    expect(pageKind('/o/r/pull/1/changes')).toBe('files');
    expect(pageKind('/o/r/pull/1/commits')).toBe('commits');
    expect(pageKind('/o/r')).toBe('other');
  });
});

describe('runDoctor', () => {
  it('skips non-PR pages without errors', () => {
    const r = run('/o/r');
    expect(r.level).toBe('ok');
    expect(r.checks).toHaveLength(1);
  });

  it('errors when the clipboard hook is missing', () => {
    document.body.innerHTML = THREAD;
    const r = run();
    expect(status(r, 'hook')).toBe('fail');
    expect(r.level).toBe('error');
  });

  it('is ok for a healthy thread', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = THREAD;
    const r = run();
    expect(r.checks.filter(c => c.status === 'fail' || c.status === 'warn')).toEqual([]);
    expect(r.level).toBe('ok');
  });

  it('warns when a PR page shows no review threads', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    const r = run();
    expect(status(r, 'thread.all')).toBe('warn');
    expect(r.level).toBe('warn');
  });

  it('fails when a thread has no path link or menu button', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = '<review-thread-collapsible><div>nothing</div></review-thread-collapsible>';
    const r = run();
    expect(status(r, 'thread.path')).toBe('fail');
    expect(status(r, 'comment.menu')).toBe('fail');
    expect(r.level).toBe('error');
  });

  it('only warns when the sample thread is collapsed', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML =
      '<review-thread-collapsible><a class="text-mono" href="#xR1">f</a><button class="review-thread-chevron" aria-expanded="false"></button></review-thread-collapsible>';
    expect(status(run(), 'comment.menu')).toBe('warn');
  });

  it('flags a stale override that falls back to the default', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = THREAD;
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.path': { selectors: ['a.gone'] } });
    const r = runDoctor(reg, { pathname: '/o/r/pull/1' });
    expect(r.checks.find(c => c.id === 'thread.path')?.status).toBe('warn');
  });

  it('checks suggestions only when present', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = THREAD.replace('</review-thread-collapsible>', '<div data-testid="automated-review-suggestion"></div></review-thread-collapsible>');
    expect(status(run(), 'suggestion.table')).toBe('fail');
    expect(status(run(), 'suggestion')).toBeUndefined();
  });

  it('checks the virtualized list only on the files tab', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    expect(status(run('/o/r/pull/1'), 'files.row')).toBeUndefined();
    expect(status(run('/o/r/pull/1/files'), 'files.row')).toBe('warn');
    document.body.innerHTML = '<div data-path-digest="abc" data-index="0"></div>';
    expect(status(run('/o/r/pull/1/files'), 'files.row')).toBe('ok');
  });

  it('folds the last capture result into the level', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = THREAD;
    const reg = new LocatorRegistry();
    const r = runDoctor(reg, { pathname: '/o/r/pull/1', lastCapture: [{ severity: 'warn', message: 'x' }] });
    expect(r.level).toBe('warn');
    const e = runDoctor(reg, { pathname: '/o/r/pull/1', lastCapture: [{ severity: 'error', message: 'x' }] });
    expect(e.level).toBe('error');
  });

  it('checks file header and hunk locators when Files rows are rendered', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = row(1, 'src/a.ts', '@@ -1 +1 @@') + row(2, 'src/b.ts', null);
    const r = run('/o/r/pull/1/files');
    expect(status(r, 'files.path')).toBe('ok');
    expect(status(r, 'files.hunk')).toBe('ok');
    expect(r.checks.find(c => c.id === 'files.hunk')?.detail).toMatch(/1 of 2/);

    document.body.innerHTML = '<div data-path-digest="abc" data-index="0"></div>';
    expect(status(run('/o/r/pull/1/files'), 'files.path')).toBe('fail');

    document.body.innerHTML = row(1, 'src/a.ts', null);
    expect(status(run('/o/r/pull/1/files'), 'files.hunk')).toBe('warn');
  });

  it('maps failing checks to the locator keys that can repair them', () => {
    expect(keysForCheck({ id: 'thread.path', status: 'fail' })).toEqual(['thread.path']);
    expect(keysForCheck({ id: 'comment.menu', status: 'warn' })).toEqual(['comment.menu.react', 'comment.menu.details']);
    expect(keysForCheck({ id: 'thread.range', status: 'warn' })).toEqual(['thread.rangeHeader']);
    expect(keysForCheck({ id: 'hook', status: 'fail' })).toEqual([]);
    expect(keysForCheck({ id: 'thread.path', status: 'ok' })).toEqual([]);
  });

  it('picks a thread whose menu button exists, and explains when every thread is collapsed', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    const collapsed = '<review-thread-collapsible><a class="text-mono" href="#xR1">a</a><button class="review-thread-chevron" aria-expanded="false"></button></review-thread-collapsible>';
    document.body.innerHTML = collapsed + THREAD;
    expect(status(run(), 'comment.menu')).toBe('ok');
    document.body.innerHTML = collapsed;
    const r = run();
    expect(status(r, 'comment.menu')).toBe('warn');
    expect(r.checks.find(c => c.id === 'comment.menu')?.detail).toMatch(/collapsed/);
  });

  it('reports when the menu and range come from your override', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = `<review-thread-collapsible><a class="text-mono" href="#x">f</a><button class="review-thread-chevron" aria-expanded="true"></button>
      <span class="my-range">+7 to +9</span><div class="review-comment"><summary class="my-menu"></summary></div></review-thread-collapsible>`;
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'comment.menu.details': { selectors: ['summary.my-menu'] }, 'thread.rangeHeader': { selectors: ['span.my-range'] } });
    const r = runDoctor(reg, { pathname: '/o/r/pull/1' });
    expect(r.checks.find(c => c.id === 'comment.menu')?.detail).toBe('human/legacy via override');
    expect(r.checks.find(c => c.id === 'thread.range')?.detail).toBe('7-9 (from your selector)');
  });

  it('checks review summaries on the Conversation tab and does not warn about missing threads when they exist', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = `<div id="pullrequestreview-1111111" class="timeline-comment-group js-comment"><a class="author">Copilot</a><div class="comment-body">x</div></div>`;
    const r = run();
    expect(status(r, 'review.box')).toBe('ok');
    expect(status(r, 'comment.author')).toBe('ok');
    expect(status(r, 'comment.body')).toBe('ok');
    expect(status(r, 'thread.all')).toBe('skip');
    expect(r.level).toBe('ok');
    document.body.innerHTML = '<div id="pullrequestreview-1111111" class="timeline-comment-group js-comment"></div>';
    expect(status(run(), 'comment.author')).toBe('warn');
    expect(status(run('/o/r/pull/1/files'), 'review.box')).toBeUndefined();
  });

  it('warns when a saved line-range selector matches things that hold no range, instead of claiming it was used', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = `<review-thread-collapsible><a class="text-mono" href="#x">f</a><button class="review-thread-chevron" aria-expanded="true"></button>
      <table class="diff-table"><tbody><tr><td data-line-number="236"></td></tr></tbody></table>
      <div class="review-comment"><a class="author">sam</a><button data-testid="comment-header-hamburger"></button><div class="comment-body">x</div></div></review-thread-collapsible>`;
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.rangeHeader': { selectors: ['button[data-testid="comment-header-hamburger"]'] } });
    const r = runDoctor(reg, { pathname: '/o/r/pull/1' });
    const line = r.checks.find(c => c.id === 'thread.range')!;
    expect(line.status).toBe('warn');
    expect(line.detail).toMatch(/^236 \(from the thread's code preview\)\. Your saved selector for "thread.rangeHeader" matches 1 element/);
    expect(line.detail).toMatch(/Reset it/);
  });

  it('lists saved selectors and points at them when the Doctor finds problems', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = THREAD;
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.all': { selectors: ['button[data-testid="comment-header-hamburger"]'] }, 'review.box': { selectors: ['div.gone'] } });
    const r = runDoctor(reg, { pathname: '/o/r/pull/1' });
    const line = r.checks.find(c => c.id === 'overrides')!;
    expect(line.status).toBe('warn');
    expect(line.detail).toMatch(/^2 saved: thread\.all, review\.box\./);
    expect(line.detail).toMatch(/match nothing on this page: review\.box/);
    expect(line.detail).toMatch(/most common cause/);
    expect(runDoctor(new LocatorRegistry(), { pathname: '/o/r/pull/1' }).checks.some(c => c.id === 'overrides')).toBe(false);
  });

  it('does not call a missing suggestion "none" when the threads are collapsed and may hold some', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML =
      '<review-thread-collapsible data-resolved="true"><a class="text-mono" href="#xR1">a</a><button class="review-thread-chevron" aria-expanded="false"></button></review-thread-collapsible>';
    const line = runDoctor(new LocatorRegistry(), { pathname: '/o/r/pull/1' }).checks.find(c => c.id === 'suggestion')!;
    expect(line.status).toBe('skip');
    expect(line.detail).toMatch(/^not checked: none is loaded yet\. 1 collapsed or resolved thread/);
    document.body.innerHTML = THREAD;
    expect(runDoctor(new LocatorRegistry(), { pathname: '/o/r/pull/1' }).checks.find(c => c.id === 'suggestion')!.detail).toBe('none on this page');
  });

  it('recognises the newer Files changed layout and does not expect conversation threads there', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = '<button id="changes-selector-button">All commits</button>' + rowNew(1, 'src/a.ts', '@@ -1 +1 @@') + rowNew(2, 'src/b.ts', '@@ -1 +1 @@');
    const r = runDoctor(new LocatorRegistry(), { pathname: '/o/r/pull/1/changes/abc..def' });
    expect(status(r, 'files.row')).toBe('ok');
    expect(status(r, 'files.path')).toBe('ok');
    expect(status(r, 'files.hunk')).toBe('ok');
    expect(status(r, 'thread.all')).toBe('skip');
    expect(r.level).toBe('ok');
  });

  it('reports the file tree when it is shown and a neutral skip when it is not', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    const tree = '<ul role="tree" aria-label="File Tree"><li role="treeitem" id="a/b.ts"></li><li role="treeitem" id="a" aria-expanded="true"></li></ul>';
    document.body.innerHTML = tree + '<button id="changes-selector-button">x</button>' + rowNew(1, 'a/b.ts', '@@ -1 +1 @@');
    const shown = runDoctor(new LocatorRegistry(), { pathname: '/o/r/pull/1/changes/a..b' });
    expect(shown.checks.find(c => c.id === 'tree.root')).toMatchObject({ status: 'ok', detail: '2 entries' });
    document.body.innerHTML = '<button id="changes-selector-button">x</button>' + rowNew(1, 'a/b.ts', '@@ -1 +1 @@');
    const hidden = runDoctor(new LocatorRegistry(), { pathname: '/o/r/pull/1/changes/a..b' });
    expect(hidden.checks.find(c => c.id === 'tree.root')!.status).toBe('skip');
    expect(hidden.level).toBe('ok');
  });
});

