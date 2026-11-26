import type { AgentDef } from '../agents/agents';
import { agentOf } from '../agents/agents';
import { armClipboard, createClipboardListener, type ClipboardListener } from '../clipboard';
import { isRendered, retryBackoff, sleep, waitFor } from '../dom';
import type { LocatorRegistry } from '../locators/registry';
import { formatTime } from './delta';
import { idOf, reviewIdOf } from './ids';
import { htmlToMarkdown } from './markdown';
import { copyViaMenu, findTriggers, type Trigger } from './menu';
import { suggestionLines, threadRange } from './thread';
import type { CapturedComment, CaptureResult, CapturedThread } from './types';

export interface CaptureOptions {
  includeResolved?: boolean;
  includeReviews?: boolean;
  /** 'swallow' (default): GitHub's own copy is intercepted and never reaches the clipboard. 'passthrough': it still copies. */
  clipboard?: 'swallow' | 'passthrough';
  agents?: { defs: AgentDef[]; excluded: string[] };
  /** Waits between re-reads of a thread's line range while it may still be loading. Default: five retries. */
  retryDelays?: number[];
  /** Stop after the item in progress. Whatever was captured so far is returned. */
  signal?: AbortSignal;
  onProgress?: (p: { done: number; total: number; label: string }) => void;
}

interface Who {
  container: Element;
  author: string;
  agent: AgentDef | null;
}

function copyViaDom(reg: LocatorRegistry, container: Element): { text: string | null; via: string } {
  const ta = reg.first('comment.textarea', container, { track: false }) as HTMLTextAreaElement | null;
  const raw = ta?.value?.trim();
  if (raw) return { text: raw, via: 'edit textarea' };
  const body = reg.first('comment.body', container, { track: false });
  const md = body ? htmlToMarkdown(body) : '';
  if (!md) return { text: null, via: '' };
  const title = reg.first('comment.title', container, { track: false })?.textContent?.trim();
  return { text: title ? `**${title}**\n\n${md}` : md, via: 'rendered HTML' };
}

function whoIs(reg: LocatorRegistry, container: Element, opts: CaptureOptions): Who {
  const author = reg.first('comment.author', container, { track: false })?.textContent?.trim() ?? '';
  return { container, author, agent: opts.agents ? agentOf(author, opts.agents.defs) : null };
}

const isExcluded = (who: Who, opts: CaptureOptions) => !!who.agent && !!opts.agents?.excluded.includes(who.agent.id);

const base = (who: Who) => ({ id: idOf(who.container), author: who.author, ...(who.agent ? { agent: who.agent.label, agentId: who.agent.id } : {}) });

async function captureViaMenu(reg: LocatorRegistry, trigger: Trigger, who: Who, clip: ClipboardListener): Promise<CapturedComment> {
  const menu = await copyViaMenu(reg, trigger, clip);
  if (menu.text) return { ...base(who), text: menu.text, reason: '', via: 'menu' };
  const dom = copyViaDom(reg, who.container);
  // reason is kept even when the page text rescued the comment: it says why the menu did not supply Copy Markdown.
  return { ...base(who), text: dom.text, reason: menu.reason, via: dom.text ? dom.via : 'none' };
}

function captureViaDom(reg: LocatorRegistry, who: Who): CapturedComment {
  const dom = copyViaDom(reg, who.container);
  return {
    ...base(who),
    text: dom.text,
    reason: dom.text ? '' : 'no menu button and no readable comment body',
    via: dom.text ? dom.via : 'none',
  };
}

type Outcome = { thread: CapturedThread } | { excluded: true } | null;

async function captureThread(reg: LocatorRegistry, thread: Element, clip: ClipboardListener, opts: CaptureOptions): Promise<Outcome> {
  const path = reg.first('thread.path', thread)?.textContent?.trim();
  if (!path) return null;
  const chevron = reg.first('thread.chevron', thread) as HTMLElement | null;
  let weExpanded = false;

  // A collapsed thread keeps its buttons in the page but hidden, and a menu cannot open from a hidden button.
  // So expand it first and wait until the button is really on screen. It is collapsed again afterwards.
  const collapsed = chevron?.getAttribute('aria-expanded') === 'false';
  if (collapsed && chevron) {
    chevron.click();
    weExpanded = true;
  }
  const getTriggers = () => {
    const t = findTriggers(reg, thread).filter(x => isRendered(x.el));
    return t.length ? t : null;
  };
  for (const type of ['mouseover', 'mouseenter', 'pointerover', 'pointerenter']) {
    thread.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  }
  const triggers = await waitFor(getTriggers, collapsed ? 3000 : 1500);
  // The code preview can still be loading (spinner) right after a thread opens: re-read its range with back off before giving up.
  const { value: range } = await retryBackoff(() => threadRange(reg, thread), r => r !== '', opts.retryDelays ?? [150, 300, 600, 1200, 2400]);

  try {
    const comments: CapturedComment[] = [];
    let seen = 0;
    if (triggers) {
      for (const t of triggers) {
        seen++;
        const who = whoIs(reg, reg.closest('comment.container', t.el) ?? thread, opts);
        if (!isExcluded(who, opts)) comments.push(await captureViaMenu(reg, t, who, clip));
      }
    } else {
      const bodies = reg.all('comment.body', thread, { track: false });
      if (!bodies.length) comments.push({ id: null, author: '', text: null, reason: 'no comment menu or body found', via: 'none' });
      for (const body of bodies) {
        seen++;
        const who = whoIs(reg, reg.closest('comment.container', body) ?? thread, opts);
        if (!isExcluded(who, opts)) comments.push(captureViaDom(reg, who));
      }
    }
    if (seen > 0 && comments.length === 0) return { excluded: true };
    return {
      thread: {
        path,
        range,
        comments,
        suggestionLines: suggestionLines(reg, thread),
        suggestionBlocks: reg.all('suggestion.block', thread, { track: false }).length,
        el: thread,
      },
    };
  } finally {
    if (weExpanded && chevron?.getAttribute('aria-expanded') === 'true') {
      chevron.click();
      await sleep(50);
    }
  }
}

interface ReviewRun {
  reviews: CapturedThread[];
  excluded: number;
}

type Step = (label: string) => boolean;

const hasBody = (reg: LocatorRegistry, box: Element) => {
  const body = reg.first('comment.body', box, { track: false });
  return !!body && !!(body.textContent ?? '').trim();
};

/** Review summary comments (for example Copilot's "left a comment" box): the feedback often lives here, not in inline threads. */
async function captureReviews(reg: LocatorRegistry, clip: ClipboardListener, opts: CaptureOptions, boxes: Element[], step: Step): Promise<ReviewRun> {
  const run: ReviewRun = { reviews: [], excluded: 0 };
  let menuUsable = true;
  for (const box of boxes) {
    if (!step('review summary')) break;
    const who = whoIs(reg, box, opts);
    if (isExcluded(who, opts)) {
      run.excluded++;
      continue;
    }
    const trigger = menuUsable ? findTriggers(reg, box)[0] : undefined;
    let comment: CapturedComment;
    if (trigger) {
      comment = await captureViaMenu(reg, trigger, who, clip);
      // Stop clicking only when the menu opened and truly has no Copy Markdown; a slow or failed open is retried on the next review.
      if (comment.via !== 'menu' && /no "Copy Markdown" in menu/.test(comment.reason)) menuUsable = false;
    } else {
      comment = captureViaDom(reg, who);
    }
    comment.id = reviewIdOf(box);

    const wrapper = reg.closest('review.item', box);
    const stamp = reg.first('review.time', wrapper ?? box, { track: false })?.getAttribute('datetime');
    const ms = stamp ? Date.parse(stamp) : NaN;
    run.reviews.push({
      kind: 'review',
      path: 'Review summary',
      range: '',
      comments: [comment],
      suggestionLines: [],
      suggestionBlocks: 0,
      ...(Number.isNaN(ms) ? {} : { when: formatTime(ms) }),
      el: box,
    });
  }
  return run;
}

export async function captureThreads(reg: LocatorRegistry, opts: CaptureOptions = {}): Promise<CaptureResult> {
  reg.resetReport();
  const clip = createClipboardListener();
  const disarm = armClipboard({ passthrough: opts.clipboard === 'passthrough' });
  const threads: CapturedThread[] = [];
  let excluded = 0;
  let resolvedSkipped = 0;
  let expected = 0;
  let started = 0;
  let aborted = false;
  try {
    const boxes = opts.includeReviews === false ? [] : reg.all('review.box').filter(b => hasBody(reg, b));
    const all = reg.all('thread.all');
    const found = all.filter(t => opts.includeResolved || t.getAttribute('data-resolved') !== 'true');
    resolvedSkipped = all.length - found.length;
    expected = boxes.length + found.length;

    // Items are read one at a time: there is one shared menu and one clipboard listener, so they cannot overlap.
    const step: Step = label => {
      if (opts.signal?.aborted) {
        aborted = true;
        return false;
      }
      started++;
      opts.onProgress?.({ done: started, total: expected, label });
      return true;
    };

    const run = await captureReviews(reg, clip, opts, boxes, step);
    threads.push(...run.reviews);
    excluded = run.excluded;
    for (const thread of found) {
      if (!step(reg.first('thread.path', thread, { track: false })?.textContent?.trim() || 'thread')) break;
      const outcome = await captureThread(reg, thread, clip, opts);
      if (outcome && 'thread' in outcome) threads.push(outcome.thread);
      else if (outcome && 'excluded' in outcome) excluded++;
    }
  } finally {
    disarm();
    clip.dispose();
  }
  const notStarted = expected - started;
  return { threads, expected, excluded, resolvedSkipped, aborted, skipped: expected - threads.length - excluded - notStarted };
}
