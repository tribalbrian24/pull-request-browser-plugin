import { deepQuerySelectorAll } from './dom';
import { runDoctor } from './doctor/checks';
import { DEFAULT_LOCATORS, type LocatorKey } from './locators/defaults';
import type { LocatorRegistry } from './locators/registry';

const SAFE_ATTRS = ['role', 'type', 'name', 'data-resolved', 'data-testid', 'data-component', 'data-view-component', 'data-diff-cell', 'data-diff-side', 'data-diff-type'];
const norm = (s: string) => s.replace(/(?=[0-9a-f]*[a-f])[0-9a-f]{8,}/gi, 'H').replace(/\d+/g, 'N');

function attrsOf(el: Element): string {
  const out: string[] = [];
  for (const a of Array.from(el.attributes)) {
    const name = a.name;
    if (SAFE_ATTRS.includes(name)) out.push(`${name}=${a.value.length <= 60 ? a.value : '…'}`);
    else if (name.startsWith('aria-')) out.push(`${name}=${a.value.length <= 30 && !a.value.includes('/') ? a.value : '…'}`);
    else if (name === 'href' || name === 'src') out.push(name);
    else if (name.startsWith('data-') && a.value.length <= 30) out.push(`${name}=${norm(a.value)}`);
  }
  return out.length ? ` [${out.join(' ')}]` : '';
}

/** Structure only: tags, ids (numbers masked), classes and safe attributes. Text and links are never included. */
export function skeleton(el: Element, maxDepth = 7, maxChildren = 10): string {
  const lines: string[] = [];
  const walk = (node: Element, depth: number) => {
    const id = node.id ? `#${norm(node.id)}` : '';
    const cls = Array.from(node.classList).slice(0, 8).map(c => `.${c}`).join('');
    const text = Array.from(node.childNodes).filter(n => n.nodeType === 3 && (n.textContent ?? '').trim()).length;
    lines.push(`${'  '.repeat(depth)}${node.tagName.toLowerCase()}${id}${cls}${attrsOf(node)}${text ? ' "text"' : ''}${node.shadowRoot ? ' {shadow}' : ''}`);
    if (depth >= maxDepth) {
      if (node.children.length) lines.push(`${'  '.repeat(depth + 1)}… ${node.children.length} child element(s)`);
      return;
    }
    const kids = Array.from(node.children);
    kids.slice(0, maxChildren).forEach(k => walk(k, depth + 1));
    if (kids.length > maxChildren) lines.push(`${'  '.repeat(depth + 1)}… +${kids.length - maxChildren} more`);
    if (node.shadowRoot) Array.from(node.shadowRoot.children).slice(0, maxChildren).forEach(k => walk(k, depth + 1));
  };
  walk(el, 0);
  return lines.join('\n');
}

export function chainOf(el: Element, max = 10): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && parts.length < max) {
    const cls = Array.from(cur.classList).slice(0, 4).map(c => `.${c}`).join('');
    parts.push(`${cur.tagName.toLowerCase()}${cur.id ? `#${norm(cur.id)}` : ''}${cls}`);
    cur = cur.parentElement;
  }
  return parts.join(' < ');
}

function top(counts: Map<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(Array.from(counts).sort((a, b) => b[1] - a[1]).slice(0, n));
}

export interface Diagnostics {
  text: string;
}

export function buildDiagnostics(reg: LocatorRegistry, doc: Document = document, pathname: string = location.pathname): Diagnostics {
  const report = runDoctor(reg, { doc, pathname });
  const tags = new Map<string, number>();
  for (const el of deepQuerySelectorAll(doc, '*')) {
    const t = el.tagName.toLowerCase();
    if (t.includes('-')) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  const testIds = new Map<string, number>();
  doc.querySelectorAll('[data-testid]').forEach(e => {
    const v = norm(e.getAttribute('data-testid') ?? '');
    testIds.set(v, (testIds.get(v) ?? 0) + 1);
  });
  const ids = new Map<string, number>();
  doc.querySelectorAll('[id]').forEach(e => {
    const v = norm(e.id);
    if (v !== e.id) ids.set(v, (ids.get(v) ?? 0) + 1);
  });

  const locators = Object.fromEntries(
    (Object.keys(DEFAULT_LOCATORS) as LocatorKey[]).map(k => {
      const r = reg.resolve(k, doc, { track: false });
      return [k, `${r.elements.length} via ${r.source}${r.matched ? ` (${r.matched})` : ''}`];
    }),
  );

  const thread = reg.first('thread.all', doc, { track: false });
  const review = reg.first('review.box', doc, { track: false });
  const loose = doc.querySelector('.review-comment, [id^="discussion_r"], [data-testid*="comment" i]');

  const data = {
    tool: 'PR Review Companion diagnostics (structure only: no comment text, no links, ids masked)',
    page: { path: norm(pathname), kind: report.page, doctor: report.level },
    doctor: report.checks.map(c => `${c.status}: ${c.label} - ${c.detail}`),
    counts: {
      'review-thread-collapsible': doc.querySelectorAll('review-thread-collapsible').length,
      'data-resolved=true': doc.querySelectorAll('[data-resolved="true"]').length,
      'data-resolved=false': doc.querySelectorAll('[data-resolved="false"]').length,
      'comment menu buttons (react)': doc.querySelectorAll('[data-testid="comment-header-hamburger"]').length,
      'comment menu buttons (details)': doc.querySelectorAll('summary[data-dd-action-name="comment.open_menu"]').length,
      'automated-review-suggestion': doc.querySelectorAll('[data-testid="automated-review-suggestion"]').length,
    },
    locators,
    customElements: top(tags, 25),
    testIds: top(testIds, 40),
    maskedIds: top(ids, 25),
    samples: {
      firstThread: thread ? skeleton(thread) : null,
      firstReviewBox: review ? skeleton(review, 5) : null,
      firstCommentLike: loose ? { chain: chainOf(loose), skeleton: skeleton(loose, 5) } : null,
    },
  };
  const text = JSON.stringify(data, null, 2);
  return { text: text.length > 60000 ? `${text.slice(0, 60000)}\n… truncated` : text };
}
