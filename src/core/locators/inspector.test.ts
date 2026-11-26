import { beforeEach, describe, expect, it } from 'vitest';
import { isUnstableClass, proposeSelectors, shadowPathOf, stablePrefix } from './inspector';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isUnstableClass', () => {
  it('flags hashed GitHub classes and keeps plain ones', () => {
    for (const c of ['diffLineRow__K43czL', 'UnifiedDiffLines-module__unifiedDiffLines__U966b', 'prc-Button-ButtonBase-9n-Xk']) {
      expect(isUnstableClass(c)).toBe(true);
    }
    for (const c of ['review-thread-chevron', 'text-mono', 'Button--small', 'js-comment']) {
      expect(isUnstableClass(c)).toBe(false);
    }
  });
});

describe('proposeSelectors', () => {
  it('prefers data-testid over everything', () => {
    document.body.innerHTML = '<button data-testid="save" class="Button__AbC123 mine">x</button><button class="mine">y</button>';
    const [top] = proposeSelectors(document.querySelector('[data-testid="save"]')!);
    expect(top.selector).toBe('[data-testid="save"]');
    expect(top.matchCount).toBe(1);
  });

  it('never proposes hashed classes', () => {
    document.body.innerHTML = '<div><button class="Button__AbC123 mine">x</button></div>';
    const cands = proposeSelectors(document.querySelector('button')!);
    expect(cands.some(c => c.selector.includes('AbC123'))).toBe(false);
    expect(cands.some(c => c.selector.includes('.mine'))).toBe(true);
  });

  it('scopes through a stable ancestor', () => {
    document.body.innerHTML =
      '<review-thread-collapsible><div><a aria-label="Open" href="#">l</a></div></review-thread-collapsible>';
    const cands = proposeSelectors(document.querySelector('a')!, 20);
    expect(cands.some(c => c.selector.startsWith('review-thread-collapsible '))).toBe(true);
  });

  it('falls back to a structural selector for bare elements', () => {
    document.body.innerHTML = '<div><span>a</span><span>b</span></div>';
    const cands = proposeSelectors(document.querySelectorAll('span')[1], 20);
    expect(cands.map(c => c.selector)).toEqual(['div > span:nth-of-type(2)']);
  });

  it('every candidate matches the element', () => {
    document.body.innerHTML = '<custom-el><a class="x y" aria-label="Open" href="#">l</a></custom-el>';
    const el = document.querySelector('a')!;
    for (const c of proposeSelectors(el, 20)) expect(Array.from(document.querySelectorAll(c.selector))).toContain(el);
  });
});

describe('shadowPathOf', () => {
  it('returns the chain of host selectors', () => {
    document.body.innerHTML = '<div id="outer"></div>';
    const sr = document.getElementById('outer')!.attachShadow({ mode: 'open' });
    sr.innerHTML = '<span id="in">z</span>';
    expect(shadowPathOf(sr.getElementById('in')!)).toEqual(['#outer']);
    expect(shadowPathOf(document.getElementById('outer')!)).toEqual([]);
  });
});

describe('volatile ids', () => {
  it('splits an id into its stable start', () => {
    expect(stablePrefix('pullrequestreview-1234567890')).toBe('pullrequestreview-');
    expect(stablePrefix('discussion_r123456')).toBe('discussion_r');
    expect(stablePrefix('changes-selector-button')).toBeNull();
    expect(stablePrefix('1234567')).toBe('');
  });

  it('never proposes the exact numeric id, but a prefix selector instead', () => {
    document.body.innerHTML = '<div id="pullrequestreview-1234567890" class="js-comment js-updatable-content"></div>';
    const cands = proposeSelectors(document.querySelector('div')!, 20).map(c => c.selector);
    expect(cands).toContain('[id^="pullrequestreview-"]');
    expect(cands).toContain('[id^="pullrequestreview-"].js-comment');
    expect(cands.some(c => c.includes('1234567890'))).toBe(false);
  });

  it('can tell apart two nested elements that share one id', () => {
    document.body.innerHTML =
      '<div id="pullrequestreview-1234567890" class="js-comment js-updatable-content"><div id="pullrequestreview-1234567890" class="timeline-comment-group timeline-comment"></div></div>';
    const inner = document.querySelectorAll('div')[1];
    const best = proposeSelectors(inner, 20).find(c => c.matchCount === 1);
    expect(best?.selector).toBe('[id^="pullrequestreview-"].timeline-comment-group');
  });

  it('keeps fully stable ids exact', () => {
    document.body.innerHTML = '<button id="changes-selector-button"></button>';
    expect(proposeSelectors(document.querySelector('button')!)[0].selector).toBe('#changes-selector-button');
  });
});

