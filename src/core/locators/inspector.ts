export interface Candidate {
  selector: string;
  score: number;
  matchCount: number;
}

interface Part {
  sel: string;
  score: number;
  strong: boolean;
}

const STRONG_ATTRS = ['data-testid', 'data-test-selector', 'data-dd-action-name'];
const WEAK_ATTRS = [
  'data-diff-cell',
  'data-diff-side',
  'data-diff-type',
  'data-component',
  'aria-label',
  'aria-haspopup',
  'role',
  'name',
];
const UNSTABLE_CLASS = [/__(?=[\w-]*[A-Z0-9])[\w-]{4,8}$/, /^prc-.+-[\w-]{4,6}$/];
const GENERATED_ID = /_r_[a-z0-9]+_|^:r|^radix-|^react-/i;

/** null = the id is fully stable; '' = volatile with no usable stable start; otherwise the stable start of the id. */
export function stablePrefix(id: string): string | null {
  if (!/\d{4,}|[0-9a-f]{8,}/i.test(id)) return null;
  const m = id.match(/^(.*?[a-z][-_]?)(?=\d{3,}|[0-9a-f]{8,})/i);
  return m && m[1].length >= 3 ? m[1] : '';
}

export const isUnstableClass = (c: string) => UNSTABLE_CLASS.some(re => re.test(c));

const esc = (s: string) =>
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, ch => `\\${ch}`);
const quote = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function localParts(el: Element): Part[] {
  const tag = el.tagName.toLowerCase();
  const parts: Part[] = [];
  if (tag.includes('-')) parts.push({ sel: tag, score: 90, strong: true });
  if (el.id && !GENERATED_ID.test(el.id)) {
    const prefix = stablePrefix(el.id);
    if (prefix === null) {
      parts.push({ sel: `#${esc(el.id)}`, score: 98, strong: true });
    } else if (prefix) {
      // The id carries a number that changes per page (review-12345): match its stable start.
      parts.push({ sel: `[id^="${quote(prefix)}"]`, score: 92, strong: true });
      parts.push({ sel: `${tag}[id^="${quote(prefix)}"]`, score: 90, strong: true });
      for (const c of Array.from(el.classList).filter(c => !isUnstableClass(c)).slice(0, 2)) {
        parts.push({ sel: `[id^="${quote(prefix)}"].${esc(c)}`, score: 91, strong: true });
      }
    }
  }
  for (const a of STRONG_ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    parts.push({ sel: `[${a}="${quote(v)}"]`, score: 100, strong: true });
    parts.push({ sel: `${tag}[${a}="${quote(v)}"]`, score: 99, strong: true });
  }
  for (const a of WEAK_ATTRS) {
    const v = el.getAttribute(a);
    if (v) parts.push({ sel: `${tag}[${a}="${quote(v)}"]`, score: 70, strong: false });
  }
  const classes = Array.from(el.classList).filter(c => !isUnstableClass(c));
  for (const c of classes.slice(0, 3)) parts.push({ sel: `${tag}.${esc(c)}`, score: 60, strong: false });
  if (classes.length > 1) {
    parts.push({ sel: tag + classes.slice(0, 2).map(c => `.${esc(c)}`).join(''), score: 66, strong: false });
  }
  return parts;
}

function structural(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const idx = Array.from(parent.children).filter(c => c.tagName === el.tagName).indexOf(el) + 1;
  const parentSel = localParts(parent)[0]?.sel ?? parent.tagName.toLowerCase();
  return `${parentSel} > ${tag}:nth-of-type(${idx})`;
}

export function proposeSelectors(el: Element, limit = 8): Candidate[] {
  const root = el.getRootNode() as ParentNode;
  const own = localParts(el);
  const cands = new Map<string, number>();
  const add = (sel: string, score: number) => {
    if ((cands.get(sel) ?? -Infinity) < score) cands.set(sel, score);
  };
  own.forEach(p => add(p.sel, p.score));

  let anc = el.parentElement;
  for (let depth = 0; anc && depth < 6; depth++, anc = anc.parentElement) {
    const strong = localParts(anc).find(p => p.strong);
    if (!strong) continue;
    for (const p of own.slice(0, 6)) add(`${strong.sel} ${p.sel}`, Math.min(p.score, strong.score) - 10 - depth);
    break;
  }
  add(structural(el), 20);

  const out: Candidate[] = [];
  for (const [selector, score] of cands) {
    let matches: Element[];
    try {
      matches = Array.from(root.querySelectorAll(selector));
    } catch {
      continue;
    }
    if (!matches.includes(el)) continue;
    out.push({ selector, score: score - Math.min(30, (matches.length - 1) * 4), matchCount: matches.length });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function shadowPathOf(el: Element): string[] {
  const path: string[] = [];
  let root: Node = el.getRootNode();
  while (root.nodeType === 11 && (root as ShadowRoot).host) {
    const host = (root as ShadowRoot).host;
    path.unshift(proposeSelectors(host, 1)[0]?.selector ?? host.tagName.toLowerCase());
    root = host.getRootNode();
  }
  return path;
}

const OVERLAY_Z = '2147483646';

function makeBox(color: string): HTMLDivElement {
  const d = document.createElement('div');
  Object.assign(d.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: OVERLAY_Z,
    outline: `2px solid ${color}`,
    background: `${color}22`,
    display: 'none',
  });
  return d;
}

function place(box: HTMLElement, el: Element) {
  const r = el.getBoundingClientRect();
  Object.assign(box.style, {
    display: 'block',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
}

export interface InspectorOpts {
  ignore: (path: EventTarget[]) => boolean;
  onPick: (el: Element) => void;
  onCancel: () => void;
}

export function startInspector(opts: InspectorOpts): () => void {
  const overlay = makeBox('#2f81f7');
  document.documentElement.appendChild(overlay);
  const swallowTypes = ['pointerdown', 'mousedown', 'mouseup', 'auxclick', 'dblclick', 'contextmenu'];

  const target = (e: Event) => {
    const path = e.composedPath();
    return { path, el: path[0] as Element | undefined };
  };
  const onMove = (e: Event) => {
    const { path, el } = target(e);
    if (!el || el.nodeType !== 1 || opts.ignore(path)) {
      overlay.style.display = 'none';
      return;
    }
    place(overlay, el);
  };
  const onSwallow = (e: Event) => {
    if (opts.ignore(e.composedPath())) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onClick = (e: Event) => {
    const { path, el } = target(e);
    if (opts.ignore(path) || !el || el.nodeType !== 1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    stop();
    opts.onPick(el);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    stop();
    opts.onCancel();
  };

  function stop() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    swallowTypes.forEach(t => document.removeEventListener(t, onSwallow, true));
    overlay.remove();
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  swallowTypes.forEach(t => document.addEventListener(t, onSwallow, true));
  return stop;
}

export function highlight(els: Element[], ms = 2000) {
  els[0]?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  const boxes = els.slice(0, 50).map(el => {
    const b = makeBox('#d29922');
    place(b, el);
    document.documentElement.appendChild(b);
    return b;
  });
  setTimeout(() => boxes.forEach(b => b.remove()), ms);
}
