import { beforeEach, describe, expect, it } from 'vitest';
import { buildDiagnostics, chainOf, skeleton } from './diagnostics';
import { LocatorRegistry } from './locators/registry';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('skeleton', () => {
  it('keeps structure and drops text, links and number-bearing ids', () => {
    document.body.innerHTML = `<div id="pullrequestreview-1234567890" class="js-comment" data-testid="x">Secret code review text
      <a href="https://github.com/private/repo/pull/1" aria-label="Open src/secret/file.ts">link text</a><button aria-label="Show options" data-resolved="false">go</button></div>`;
    const out = skeleton(document.querySelector('div')!);
    expect(out).toContain('div#pullrequestreview-N.js-comment [data-testid=x] "text"');
    expect(out).toContain('a [href aria-label=…] "text"');
    expect(out).toContain('button [aria-label=Show options data-resolved=false] "text"');
    expect(out).not.toMatch(/Secret|secret|private|1234567890|link text/);
  });

  it('limits depth and fan-out', () => {
    document.body.innerHTML = `<div>${'<i></i>'.repeat(15)}</div><p><b><u><s>x</s></u></b></p>`;
    expect(skeleton(document.querySelector('div')!, 5, 3)).toContain('… +12 more');
    expect(skeleton(document.querySelector('p')!, 1)).toContain('… 1 child element(s)');
  });

  it('shows shadow roots', () => {
    document.body.innerHTML = '<div id="h"></div>';
    document.getElementById('h')!.attachShadow({ mode: 'open' }).innerHTML = '<span class="in"></span>';
    expect(skeleton(document.getElementById('h')!)).toContain('{shadow}');
    expect(skeleton(document.getElementById('h')!)).toContain('span.in');
  });
});

describe('chainOf', () => {
  it('lists ancestors', () => {
    document.body.innerHTML = '<section class="a"><div id="x1234"><b class="c"></b></div></section>';
    expect(chainOf(document.querySelector('b')!, 3)).toBe('b.c < div#xN < section.a');
  });
});

describe('buildDiagnostics', () => {
  it('reports counts, locators and samples without any page text', () => {
    document.body.innerHTML = `<review-thread-collapsible data-resolved="false"><a class="text-mono" href="#x">SECRET/path.ts</a>
      <button data-testid="comment-header-hamburger"></button></review-thread-collapsible>
      <div id="pullrequestreview-111111" class="timeline-comment-group js-comment"><a class="author">somebody</a><div class="comment-body">private words</div></div>`;
    const { text } = buildDiagnostics(new LocatorRegistry(), document, '/o/r/pull/12');
    const data = JSON.parse(text);
    expect(data.page).toEqual({ path: '/o/r/pull/N', kind: 'conversation', doctor: data.page.doctor });
    expect(data.counts['review-thread-collapsible']).toBe(1);
    expect(data.counts['data-resolved=false']).toBe(1);
    expect(data.counts['comment menu buttons (react)']).toBe(1);
    expect(data.customElements).toEqual({ 'review-thread-collapsible': 1 });
    expect(data.testIds).toEqual({ 'comment-header-hamburger': 1 });
    expect(data.maskedIds).toEqual({ 'pullrequestreview-N': 1 });
    expect(data.locators['review.box']).toMatch(/^1 via default/);
    expect(data.samples.firstThread).toContain('review-thread-collapsible');
    expect(data.samples.firstReviewBox).toContain('div#pullrequestreview-N.timeline-comment-group');
    expect(text).not.toMatch(/SECRET|private words|somebody/);
  });

  it('shows what is on the page when there is no thread element at all', () => {
    document.body.innerHTML = '<div class="wrap"><div class="review-comment" id="discussion_r1234567"><span>hi</span></div></div>';
    const data = JSON.parse(buildDiagnostics(new LocatorRegistry(), document, '/o/r/pull/1').text);
    expect(data.samples.firstThread).toBeNull();
    expect(data.samples.firstCommentLike.chain).toContain('div#discussion_rN.review-comment');
  });
});
