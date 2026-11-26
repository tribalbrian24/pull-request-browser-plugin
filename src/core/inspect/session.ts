import { deepQuerySelectorAll } from '../dom';
import { DEFAULT_LOCATORS, type LocatorKey } from '../locators/defaults';
import { proposeSelectors, shadowPathOf, type Candidate } from '../locators/inspector';
import type { LocatorDef } from '../locators/types';

export const MARK_ATTR = 'data-prc-sel';
export type NavDir = 'parent' | 'child' | 'prev' | 'next' | 'shadow';

export interface Described {
  label: string;
  /** Built-in locators this exact element already matches: a strong hint about which key it belongs to. */
  looksLike: LocatorKey[];
  shadowPath: string[];
  candidates: Candidate[];
  can: Record<NavDir, boolean>;
}

const shadowHost = (el: Element): Element | null => {
  const root = el.getRootNode();
  return root.nodeType === 11 ? ((root as ShadowRoot).host ?? null) : null;
};

export function navTarget(el: Element, dir: NavDir): Element | null {
  switch (dir) {
    case 'parent':
      return el.parentElement ?? shadowHost(el);
    case 'child':
      return el.firstElementChild;
    case 'shadow':
      return el.shadowRoot?.firstElementChild ?? null;
    case 'prev':
      return el.previousElementSibling;
    case 'next':
      return el.nextElementSibling;
  }
}

export function looksLike(el: Element): LocatorKey[] {
  return (Object.keys(DEFAULT_LOCATORS) as LocatorKey[]).filter(key => {
    const def: LocatorDef = DEFAULT_LOCATORS[key];
    if (def.text) return false; // generic selectors that rely on a text filter would match almost anything
    return def.selectors.some(sel => {
      try {
        return el.matches(sel);
      } catch {
        return false;
      }
    });
  });
}

export function labelOf(el: Element): string {
  const id = el.id ? `#${el.id}` : '';
  const cls = Array.from(el.classList).slice(0, 2).map(c => `.${c}`).join('');
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}

export class InspectSession {
  current: Element | null = null;

  consumeMarked(root: ParentNode = document): Element | null {
    const marked = deepQuerySelectorAll(root, `[${MARK_ATTR}]`);
    marked.forEach(m => m.removeAttribute(MARK_ATTR));
    this.current = marked.at(-1) ?? null;
    return this.current;
  }

  move(dir: NavDir): Element | null {
    const target = this.current ? navTarget(this.current, dir) : null;
    if (target) this.current = target;
    return target;
  }

  describe(): Described | null {
    const el = this.current;
    if (!el) return null;
    const dirs: NavDir[] = ['parent', 'child', 'prev', 'next', 'shadow'];
    return {
      label: labelOf(el),
      looksLike: looksLike(el),
      shadowPath: shadowPathOf(el),
      candidates: proposeSelectors(el),
      can: Object.fromEntries(dirs.map(d => [d, navTarget(el, d) !== null])) as Record<NavDir, boolean>,
    };
  }
}
