import { commentKey, type Delta } from './delta';
import type { CapturedThread } from './types';

export const DELTA_ATTR = 'data-prc-delta';
const STYLE_ATTR = 'data-prc-marks';

const CSS = `[${DELTA_ATTR}="new"]{outline:2px solid #2da44e;outline-offset:2px}
[${DELTA_ATTR}="edited"]{outline:2px solid #bf8700;outline-offset:2px}`;

export function clearMarks(doc: Document = document) {
  doc.querySelectorAll(`[${DELTA_ATTR}]`).forEach(el => el.removeAttribute(DELTA_ATTR));
  doc.querySelector(`style[${STYLE_ATTR}]`)?.remove();
}

/** Outlines threads on GitHub itself: green for new comments, amber for edited ones. Needs an earlier snapshot to compare with. */
export function markThreads(threads: CapturedThread[], delta: Delta, doc: Document = document): number {
  clearMarks(doc);
  if (delta.since === null) return 0;
  let marked = 0;
  for (const t of threads) {
    if (!t.el) continue;
    const statuses = t.comments.map((_, i) => delta.status.get(commentKey(t, i)));
    const mark = statuses.includes('new') ? 'new' : statuses.includes('edited') ? 'edited' : null;
    if (!mark) continue;
    t.el.setAttribute(DELTA_ATTR, mark);
    marked++;
  }
  if (marked) {
    const style = doc.createElement('style');
    style.setAttribute(STYLE_ATTR, '');
    style.textContent = CSS;
    doc.head.appendChild(style);
  }
  return marked;
}
