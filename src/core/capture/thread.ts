import type { LocatorRegistry } from '../locators/registry';

export function parseLineRange(text: string): string {
  const m = text.replace(/\s+/g, ' ').match(/lines?\s+[+\-RL]?\s*(\d+)(?:\s+to\s+[+\-RL]?\s*(\d+))?/i);
  if (!m) return '';
  return m[2] && m[2] !== m[1] ? `${m[1]}-${m[2]}` : m[1];
}

export function rangeFromHref(href: string): string {
  const m = href.match(/R(\d+)(?:-R(\d+))?$/);
  if (!m) return '';
  return m[2] && m[2] !== m[1] ? `${m[1]}-${m[2]}` : m[1];
}

/** Looser parse for an element the user chose: "+12 to +14", "R12-R14", "12", or a #...R12-R14 link. */
export function parseLooseRange(text: string): string {
  const t = text.replace(/\s+/g, ' ');
  const pair = t.match(/(?:^|[^\w])[+\-RL]?(\d{1,6})\s*(?:to|-|–|—)\s*[+\-RL]?(\d{1,6})(?!\d)/i);
  if (pair) return pair[2] !== pair[1] ? `${pair[1]}-${pair[2]}` : pair[1];
  const one = t.match(/(?:^|[^\w])[+\-RL]?(\d{1,6})(?!\d)/i);
  return one ? one[1] : '';
}

function rangeFromChosen(el: Element): string {
  const link = el.closest('a') ?? el.querySelector('a');
  return (
    parseLineRange(el.textContent ?? '') ||
    rangeFromHref(el.getAttribute('href') ?? link?.getAttribute('href') ?? '') ||
    parseLooseRange(el.textContent ?? '') ||
    (el.getAttribute('data-line-number') ?? '')
  );
}

export type RangeVia = 'override' | 'label' | 'preview' | 'link' | '';

export interface RangeDetail {
  range: string;
  via: RangeVia;
  /** How many elements the user's saved selector matched (0 if there is none). */
  overrideMatched: number;
}

export function threadRangeDetail(reg: LocatorRegistry, thread: Element): RangeDetail {
  const found = reg.resolve('thread.rangeHeader', thread, { track: false });
  const overrideMatched = found.source === 'override' ? found.elements.length : 0;
  const done = (range: string, via: RangeVia): RangeDetail => ({ range, via, overrideMatched });

  if (found.source === 'override') {
    const chosen = found.elements.map(rangeFromChosen).find(Boolean);
    if (chosen) return done(chosen, 'override');
  }
  // The built-in label is still tried when a saved selector found nothing usable.
  const builtIn = found.source === 'override' ? reg.resolve('thread.rangeHeader', thread, { track: false, skipOverride: true }) : found;
  const header = builtIn.elements.find(el => (el.textContent?.length ?? 0) < 120);
  const fromHeader = header ? parseLineRange(header.textContent ?? '') : '';
  if (fromHeader) return done(fromHeader, 'label');

  const rows = reg.all('thread.diffRows', thread, { track: false }).reverse();
  for (const row of rows) {
    const n = Array.from(row.querySelectorAll('td[data-line-number]')).at(-1)?.getAttribute('data-line-number');
    if (n) return done(n, 'preview');
  }
  const fromLink = rangeFromHref(reg.first('thread.path', thread, { track: false })?.getAttribute('href') ?? '');
  return done(fromLink, fromLink ? 'link' : '');
}

export const threadRange = (reg: LocatorRegistry, thread: Element): string => threadRangeDetail(reg, thread).range;

export function suggestionLines(reg: LocatorRegistry, thread: Element): string[] {
  const lines: string[] = [];
  for (const block of reg.all('suggestion.block', thread, { track: false })) {
    for (const table of reg.all('suggestion.table', block, { track: false })) {
      for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
        const cells = Array.from(row.children).filter(c => c.tagName === 'TD');
        if (cells.length !== 3) continue;
        const [oldLine, newLine, codeCell] = cells;
        const lineNumber = (newLine.textContent ?? '').trim() || (oldLine.textContent ?? '').trim();
        const marker = reg.first('suggestion.marker', codeCell, { track: false });
        const inner = reg.first('suggestion.codeText', codeCell, { track: false });
        let text: string;
        if (inner) {
          text = inner.textContent ?? '';
        } else {
          const clone = codeCell.cloneNode(true) as Element;
          reg.first('suggestion.marker', clone, { track: false })?.remove();
          text = clone.textContent ?? '';
        }
        // Unchanged context rows have no marker: a space keeps the +/-/space column aligned.
        lines.push(`${lineNumber} ${marker?.textContent?.trim() || ' '}${text}`);
      }
    }
  }
  return lines;
}
