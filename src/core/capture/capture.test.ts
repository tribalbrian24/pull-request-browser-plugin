import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveAgents, DEFAULT_PREFS } from '../agents/agents';
import { LocatorRegistry } from '../locators/registry';
import { captureThreads } from './capture';
import { idOf, reviewIdOf } from './ids';

const thread = (path: string, id: number, author: string, body: string, resolved = false) => `
<review-thread-collapsible${resolved ? ' data-resolved="true"' : ''}>
  <a class="text-mono" href="#xR9">${path}</a>
  <div class="review-comment" id="discussion_r${id}"><a class="author">${author}</a><div class="comment-body"><p>${body}</p></div></div>
</review-thread-collapsible>`;

const defs = effectiveAgents(DEFAULT_PREFS);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('idOf', () => {
  it('reads numeric ids from containers and descendants', () => {
    document.body.innerHTML = '<div id="discussion_r1234567"><span id="in"></span></div><div id="x"></div><div data-comment-id="9876543"></div>';
    expect(idOf(document.getElementById('in')!)).toBe('1234567');
    expect(idOf(document.getElementById('x')!)).toBeNull();
    expect(idOf(document.querySelector('[data-comment-id]')!)).toBe('9876543');
    document.body.innerHTML = '<div id="pullrequestreview-1234567890"></div><div id="r1234567"></div><div id="issuecomment-7654321"></div>';
    expect(idOf(document.querySelectorAll('div')[0])).toBeNull();
    expect(idOf(document.querySelectorAll('div')[1])).toBe('1234567');
    expect(idOf(document.querySelectorAll('div')[2])).toBe('7654321');
  });
});

describe('captureThreads (DOM-only path)', () => {
  it('records ids, authors and agents', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'copilot-pull-request-reviewer[bot]', 'Fix this');
    const r = await captureThreads(new LocatorRegistry(), { agents: { defs, excluded: [] } });
    expect(r.expected).toBe(1);
    expect(r.threads[0].comments[0]).toEqual({ id: '1111111', author: 'copilot-pull-request-reviewer[bot]', agent: 'Copilot', agentId: 'copilot', text: 'Fix this', reason: '', via: 'rendered HTML' });
  });

  it('leaves out excluded agents and reports them separately from failures', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'Copilot', 'bot says') + thread('src/b.ts', 2222222, 'sam', 'human says');
    const r = await captureThreads(new LocatorRegistry(), { agents: { defs, excluded: ['copilot'] } });
    expect(r.threads.map(t => t.path)).toEqual(['src/b.ts']);
    expect([r.expected, r.excluded, r.skipped]).toEqual([2, 1, 0]);
  });

  it('skips resolved threads unless asked', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'sam', 'open') + thread('src/b.ts', 2222222, 'sam', 'done', true);
    const reg = new LocatorRegistry();
    expect((await captureThreads(reg)).threads).toHaveLength(1);
    expect((await captureThreads(reg, { includeResolved: true })).threads).toHaveLength(2);
  });
});

const review = (id: number, author: string, bodyHtml: string, when = '2025-01-15T12:00:00Z') => `
<div id="pullrequestreview-${id}" class="js-comment js-updatable-content js-socket-channel">
  <div class="header"><a class="author">${author}</a> reviewed <relative-time datetime="${when}">20 hours ago</relative-time></div>
  <div id="pullrequestreview-${id}" class="timeline-comment-group js-comment">
    <div class="timeline-comment-header"><a class="author">${author}</a> left a comment</div>
    <div class="comment-body">${bodyHtml}</div>
  </div>
</div>`;

const BODY = '<p>Looks good overall, two suggestions</p><details open><summary>2 open items</summary><ul><li>High <a href="#x">Validate empty input</a> · New</li></ul></details><button>Apply fix</button>';

describe('review ids', () => {
  it('reads the review id and nothing else', () => {
    document.body.innerHTML = '<div id="pullrequestreview-1234567890"></div><div id="r123"></div>';
    expect(reviewIdOf(document.querySelectorAll('div')[0])).toBe('review-1234567890');
    expect(reviewIdOf(document.querySelectorAll('div')[1])).toBeNull();
  });
});

describe('captureThreads: review summaries', () => {
  it('captures the summary once even though two nested elements share the review id', async () => {
    document.body.innerHTML = review(1234567890, 'Copilot', BODY);
    const r = await captureThreads(new LocatorRegistry(), { agents: { defs, excluded: [] } });
    expect(r.expected).toBe(1);
    const t = r.threads[0];
    expect(t.kind).toBe('review');
    expect(t.when).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(t.comments[0]).toMatchObject({ id: 'review-1234567890', author: 'Copilot', agent: 'Copilot', via: 'rendered HTML' });
    expect(t.comments[0].text).toBe('Looks good overall, two suggestions\n\n**2 open items**\n\n- High [Validate empty input](#x) · New');
  });

  it('puts reviews before inline threads', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'sam', 'inline') + review(1234567891, 'Copilot', BODY);
    const r = await captureThreads(new LocatorRegistry());
    expect(r.threads.map(t => t.kind ?? 'thread')).toEqual(['review', 'thread']);
  });

  it('leaves out an excluded agent and ignores reviews with an empty body', async () => {
    document.body.innerHTML = review(1111111, 'Copilot', BODY) + review(2222222, 'sam', '  ');
    const r = await captureThreads(new LocatorRegistry(), { agents: { defs, excluded: ['copilot'] } });
    expect(r.threads).toHaveLength(0);
    expect([r.expected, r.excluded, r.skipped]).toEqual([1, 1, 0]);
  });

  it('clicks the review menu, keeps the reason when it has no Copy Markdown, and stops clicking after that', async () => {
    let clicks = 0;
    const withMenu = (id: number) => review(id, 'sam', '<p>body</p>').replace(
      '<div class="comment-body">',
      '<button data-testid="comment-header-hamburger">⋯</button><div class="comment-body">',
    );
    document.body.innerHTML = withMenu(1111111) + withMenu(2222222);
    document.querySelectorAll('[data-testid="comment-header-hamburger"]').forEach(b =>
      b.addEventListener('click', () => {
        clicks++;
        if (!document.getElementById('portal')) document.body.insertAdjacentHTML('beforeend', '<div id="portal"><button role="menuitem">Copy link</button></div>');
      }),
    );
    const r = await captureThreads(new LocatorRegistry());
    expect(clicks).toBe(1);
    expect(r.threads).toHaveLength(2);
    expect(r.threads[0].comments[0].via).toBe('rendered HTML');
    expect(r.threads[0].comments[0].reason).toBe('no "Copy Markdown" in menu (items: Copy link)');
    expect(r.threads[1].comments[0].reason).toBe('');
  });

  it('counts resolved threads it left out, and can leave review summaries out', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'sam', 'open') + thread('src/b.ts', 2222222, 'sam', 'done', true) + review(3333333, 'Copilot', BODY);
    const reg = new LocatorRegistry();
    const r = await captureThreads(reg);
    expect([r.threads.length, r.resolvedSkipped]).toEqual([2, 1]);
    const noReviews = await captureThreads(reg, { includeReviews: false, includeResolved: true });
    expect(noReviews.threads.map(t => t.path)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(noReviews.resolvedSkipped).toBe(0);
  });

  it('reports progress one item at a time and stops when asked, keeping what was read', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'sam', 'one') + thread('src/b.ts', 2222222, 'sam', 'two') + thread('src/c.ts', 3333333, 'sam', 'three');
    const controller = new AbortController();
    const seen: string[] = [];
    const r = await captureThreads(new LocatorRegistry(), {
      signal: controller.signal,
      onProgress: p => {
        seen.push(`${p.done}/${p.total} ${p.label}`);
        if (p.done === 1) controller.abort();
      },
    });
    expect(seen).toEqual(['1/3 src/a.ts']);
    expect(r.threads.map(t => t.path)).toEqual(['src/a.ts']);
    expect([r.aborted, r.expected, r.skipped]).toEqual([true, 3, 0]);
  });

  it('finds replies in a thread even when the first comment is an automated one', async () => {
    document.body.innerHTML = `<review-thread-collapsible><a class="text-mono" href="#x">f.ts</a>
      <div id="discussion_r1111111"><span data-testid="avatar-name">Copilot</span><span comment-testid="Comment message html for automated comment 1111111"><p>bot says</p></span></div>
      <div class="review-comment" id="discussion_r2222222"><a class="author">sam</a><div class="comment-body"><p>human reply</p></div></div></review-thread-collapsible>`;
    const r = await captureThreads(new LocatorRegistry(), { agents: { defs, excluded: [] } });
    expect(r.threads[0].comments.map(c => [c.author, c.text])).toEqual([['Copilot', 'bot says'], ['sam', 'human reply']]);
  });

  it('waits for a thread that is still loading before giving up on its line range', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'sam', 'late preview').replace('href="#xR9"', 'href="#x"'); // no line anchor in the link either
    const el = document.querySelector('review-thread-collapsible')!;
    // The code preview arrives after the first read (a loading spinner in real life).
    setTimeout(() => el.insertAdjacentHTML('beforeend', '<table class="diff-table"><tbody><tr><td data-line-number="12"></td></tr></tbody></table>'), 1700);
    const r = await captureThreads(new LocatorRegistry(), { retryDelays: [100, 100, 100, 100, 100] });
    expect(r.threads[0].range).toBe('12');
  });

  it('reports no range only after the retries are used up', async () => {
    document.body.innerHTML = thread('src/a.ts', 1111111, 'sam', 'no preview ever').replace('href="#xR9"', 'href="#x"');
    const t0 = Date.now();
    const r = await captureThreads(new LocatorRegistry(), { retryDelays: [20, 20, 20, 20, 20] });
    expect(r.threads[0].range).toBe('');
    expect(Date.now() - t0 < 6000).toBe(true);
  });
});

