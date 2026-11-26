import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, effectiveAgents } from '../agents/agents';
import { ARM_ATTR, CLIPBOARD_EVENT, HOOK_ATTR } from '../clipboard';
import { runDoctor } from '../doctor/checks';
import { LocatorRegistry } from '../locators/registry';
import { captureThreads } from './capture';
import { COPILOT_COMMENT_MARKDOWN, COPILOT_COMMENT_TITLE, COPILOT_SUGGESTION_LINES, copilotThread } from './fixtures';
import { renderMarkdown } from './markdown';

const defs = effectiveAgents(DEFAULT_PREFS);
const opts = { agents: { defs, excluded: [] as string[] } };

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(ARM_ATTR);
});

describe('a Copilot inline thread', () => {
  it('finds the path, range, author, agent, id and code suggestion with line numbers (page text only)', async () => {
    document.body.innerHTML = copilotThread({ hamburger: false });
    const r = await captureThreads(new LocatorRegistry(), opts);
    expect([r.expected, r.skipped, r.excluded]).toEqual([1, 0, 0]);
    const t = r.threads[0];
    expect(t.path).toBe('src/utils/format.ts');
    expect(t.range).toBe('40');
    expect(t.suggestionBlocks).toBe(1);
    expect(t.suggestionLines).toEqual(COPILOT_SUGGESTION_LINES);
    expect(t.comments).toHaveLength(1);
    expect(t.comments[0]).toMatchObject({ id: '1000001', author: 'Copilot', agent: 'Copilot', agentId: 'copilot', via: 'rendered HTML' });
    expect(t.comments[0].text).toBe(`**${COPILOT_COMMENT_TITLE}**\n\n${COPILOT_COMMENT_MARKDOWN}`);
  });

  it('uses the comment menu: opens it, chooses Copy Markdown, and reads what the page copies', async () => {
    document.body.innerHTML = copilotThread();
    const copied = `${COPILOT_COMMENT_TITLE}\n\n${COPILOT_COMMENT_MARKDOWN}`;
    document.querySelector('[data-testid="comment-header-hamburger"]')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<div id="portal"><ul role="menu"><li><button role="menuitem">Copy link</button></li><li><button role="menuitem">Copy Markdown</button></li></ul></div>');
      document.querySelector('#portal li:last-child button')!.addEventListener('click', () => {
        if (document.documentElement.hasAttribute(ARM_ATTR)) document.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT, { detail: copied }));
      });
    });
    const r = await captureThreads(new LocatorRegistry(), opts);
    expect(r.threads[0].comments[0]).toMatchObject({ via: 'menu', text: copied, agent: 'Copilot' });
    expect(r.threads[0].suggestionLines).toEqual(COPILOT_SUGGESTION_LINES);
  });

  it('renders markdown plus the numbered code suggestion', async () => {
    document.body.innerHTML = copilotThread({ hamburger: false });
    const r = await captureThreads(new LocatorRegistry(), opts);
    const md = renderMarkdown(r.threads);
    expect(md.startsWith('# `src/utils/format.ts:40`\n\n**Copilot:**\n\n**Always show two decimal places')).toBe(true);
    expect(md).toContain(COPILOT_SUGGESTION_LINES[3]);
    expect(md).toContain(COPILOT_SUGGESTION_LINES[0]);
  });

  it('is healthy according to the Doctor', () => {
    document.documentElement.setAttribute(HOOK_ATTR, '1');
    document.body.innerHTML = copilotThread();
    const r = runDoctor(new LocatorRegistry(), { pathname: '/acme/widgets/pull/1326' });
    expect(r.checks.filter(c => c.status === 'fail' || c.status === 'warn')).toEqual([]);
    expect(r.level).toBe('ok');
    document.documentElement.removeAttribute(HOOK_ATTR);
  });

  it('expands a collapsed (resolved) thread so its menu can open, captures through the menu, and collapses it again', async () => {
    document.body.innerHTML = copilotThread({ resolved: true, collapsed: true });
    const chevron = document.querySelector('button.review-thread-chevron')!;
    const hamburger = document.querySelector('[data-testid="comment-header-hamburger"]') as HTMLElement & { checkVisibility?: () => boolean };
    const moves: string[] = [];
    let visible = false;
    chevron.addEventListener('click', () => {
      const open = chevron.getAttribute('aria-expanded') === 'true';
      chevron.setAttribute('aria-expanded', open ? 'false' : 'true');
      visible = !open;
      moves.push(open ? 'collapse' : 'expand');
    });
    hamburger.checkVisibility = () => visible;
    const copied = `${COPILOT_COMMENT_TITLE}\n\n${COPILOT_COMMENT_MARKDOWN}`;
    hamburger.addEventListener('click', () => {
      if (!visible) return; // a hidden button cannot open a menu
      document.body.insertAdjacentHTML('beforeend', '<div id="portal"><button role="menuitem">Copy Markdown</button></div>');
      document.querySelector('#portal button')!.addEventListener('click', () => {
        if (document.documentElement.hasAttribute(ARM_ATTR)) document.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT, { detail: copied }));
      });
    });
    const r = await captureThreads(new LocatorRegistry(), { ...opts, includeResolved: true });
    expect(moves).toEqual(['expand', 'collapse']);
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    expect(r.threads[0].comments[0]).toMatchObject({ via: 'menu', text: copied });
    expect(r.threads[0].suggestionLines).toEqual(COPILOT_SUGGESTION_LINES);
  });

  it('skips resolved threads unless asked, and says how many it left out', async () => {
    document.body.innerHTML = copilotThread({ resolved: true, collapsed: true });
    const r = await captureThreads(new LocatorRegistry(), opts);
    expect([r.threads.length, r.resolvedSkipped]).toEqual([0, 1]);
  });

  it('ignores the hidden menu items of closed popovers, so a menu that never opened is reported as such', async () => {
    document.body.innerHTML = copilotThread();
    // GitHub keeps every thread's closed "Resolve with reason" menu in the page, hidden.
    document.body.insertAdjacentHTML('beforeend', '<ul id="closed" role="menu"><li><button role="menuitem">Addressed</button></li></ul>');
    const hidden = document.querySelector('#closed button') as HTMLElement & { checkVisibility?: () => boolean };
    hidden.checkVisibility = () => false;
    const r = await captureThreads(new LocatorRegistry(), opts);
    const c = r.threads[0].comments[0];
    expect(c.reason).toBe('menu never opened');
    expect(c.via).toBe('rendered HTML');
  });
});

