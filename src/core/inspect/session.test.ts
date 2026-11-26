import { beforeEach, describe, expect, it } from 'vitest';
import { InspectSession, MARK_ATTR, labelOf, looksLike, navTarget } from './session';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('InspectSession', () => {
  it('consumes the marked element and clears every mark', () => {
    document.body.innerHTML = `<div id="a"></div><span id="b" ${MARK_ATTR}="1"></span>`;
    const s = new InspectSession();
    expect(s.consumeMarked()?.id).toBe('b');
    expect(document.querySelector(`[${MARK_ATTR}]`)).toBeNull();
    expect(s.consumeMarked()).toBeNull();
  });

  it('finds a mark inside an open shadow root and reports the shadow path', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const sr = document.getElementById('host')!.attachShadow({ mode: 'open' });
    sr.innerHTML = `<button class="b" ${MARK_ATTR}="1">go</button>`;
    const s = new InspectSession();
    expect(s.consumeMarked()?.className).toBe('b');
    const d = s.describe()!;
    expect(d.shadowPath).toEqual(['#host']);
    expect(d.candidates[0].selector).toContain('button');
  });

  it('navigates parent across the shadow boundary and into a shadow root', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = '<p id="in">x</p>';
    const s = new InspectSession();
    s.current = sr.getElementById('in');
    expect(s.move('parent')).toBe(host);
    expect(s.current).toBe(host);
    expect(s.move('shadow')?.id).toBe('in');
  });

  it('moves between siblings and children, and stays put when there is no target', () => {
    document.body.innerHTML = '<ul id="u"><li id="a"></li><li id="b"></li></ul>';
    const s = new InspectSession();
    s.current = document.getElementById('u');
    expect(s.move('child')?.id).toBe('a');
    expect(s.move('next')?.id).toBe('b');
    expect(s.move('next')).toBeNull();
    expect(s.current?.id).toBe('b');
    expect(s.move('prev')?.id).toBe('a');
  });

  it('describes availability of each direction', () => {
    document.body.innerHTML = '<div id="only"></div>';
    const s = new InspectSession();
    s.current = document.getElementById('only');
    expect(s.describe()!.can).toEqual({ parent: true, child: false, prev: false, next: false, shadow: false });
  });
});

describe('helpers', () => {
  it('labels elements', () => {
    document.body.innerHTML = '<div id="x" class="a b c"></div>';
    expect(labelOf(document.getElementById('x')!)).toBe('div#x.a.b');
  });
  it('html has no parent target', () => {
    expect(navTarget(document.documentElement, 'parent')).toBeNull();
  });
});

describe('looksLike', () => {
  it('names the built-in locators an element already matches', () => {
    document.body.innerHTML = '<button data-testid="comment-header-hamburger" id="a"></button><a class="text-mono" id="b"></a><i id="c"></i>';
    expect(looksLike(document.getElementById('a')!)).toEqual(['comment.menu.react']);
    expect(looksLike(document.getElementById('b')!)).toEqual(['thread.path']);
    expect(looksLike(document.getElementById('c')!)).toEqual([]);
  });
  it('shows up in the description', () => {
    document.body.innerHTML = '<button data-testid="comment-header-hamburger"></button>';
    const s = new InspectSession();
    s.current = document.querySelector('button');
    expect(s.describe()!.looksLike).toEqual(['comment.menu.react']);
  });
});

