import { deepQuerySelectorAll } from '../dom';
import { DEFAULT_LOCATORS, isLocatorKey, type LocatorKey } from './defaults';
import type { LocatorDef, LocatorOverride, Resolution } from './types';

export interface Attempt {
  selectors: string[];
  shadowPath?: string[];
  text?: string;
}

interface ResolveOpts {
  deep?: boolean;
  track?: boolean;
  skipOverride?: boolean;
}

function safeQuery(scope: ParentNode, selector: string): Element[] {
  try {
    return Array.from(scope.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function safeDeep(scope: ParentNode, selector: string): Element[] {
  try {
    return deepQuerySelectorAll(scope, selector);
  } catch {
    return [];
  }
}

export function scopesFor(root: ParentNode, shadowPath?: string[]): ParentNode[] {
  let scopes: ParentNode[] = [root];
  for (const host of shadowPath ?? []) {
    scopes = scopes.flatMap(s => safeQuery(s, host)).flatMap(h => (h.shadowRoot ? [h.shadowRoot] : []));
  }
  return scopes;
}

export function runAttempt(
  a: Attempt,
  root: ParentNode = document,
  deep = true,
): { elements: Element[]; matched: string | null } {
  const scopes = scopesFor(root, a.shadowPath);
  const re = a.text ? new RegExp(a.text, 'i') : null;
  const keep = (els: Element[]) => (re ? els.filter(e => re.test(e.textContent ?? '')) : els);
  for (const sel of a.selectors) {
    let found = keep(scopes.flatMap(s => safeQuery(s, sel)));
    if (!found.length && deep && !a.shadowPath?.length) found = keep(scopes.flatMap(s => safeDeep(s, sel)));
    if (found.length) return { elements: found, matched: sel };
  }
  return { elements: [], matched: null };
}

export class LocatorRegistry {
  private overrides: Record<string, LocatorOverride> = {};
  private counts = new Map<string, number>();

  setOverrides(o: Record<string, LocatorOverride>) {
    this.overrides = o;
  }

  getOverrides() {
    return this.overrides;
  }

  private attempts(key: LocatorKey): (Attempt & { source: 'override' | 'default' })[] {
    const def: LocatorDef = DEFAULT_LOCATORS[key];
    const out: (Attempt & { source: 'override' | 'default' })[] = [];
    const ov = this.overrides[key];
    // An override is the user's explicit choice, so the default's text filter does not apply to it.
    if (ov) out.push({ selectors: ov.selectors, shadowPath: ov.shadowPath, source: 'override' });
    if (!ov?.replaceDefaults) out.push({ selectors: def.selectors, shadowPath: def.shadowPath, text: def.text, source: 'default' });
    return out;
  }

  resolve(key: LocatorKey, root: ParentNode = document, opts: ResolveOpts = {}): Resolution {
    const track = opts.track ?? true;
    for (const a of this.attempts(key)) {
      if (opts.skipOverride && a.source === 'override') continue;
      const r = runAttempt(a, root, opts.deep ?? true);
      if (r.elements.length) {
        if (track) this.counts.set(key, r.elements.length);
        return { ...r, source: a.source };
      }
    }
    if (track) this.counts.set(key, 0);
    return { elements: [], matched: null, source: 'none' };
  }

  all(key: LocatorKey, root: ParentNode = document, opts: ResolveOpts = {}): Element[] {
    return this.resolve(key, root, opts).elements;
  }

  first(key: LocatorKey, root: ParentNode = document, opts: ResolveOpts = {}): Element | null {
    return this.all(key, root, opts)[0] ?? null;
  }

  closest(key: LocatorKey, el: Element): Element | null {
    for (const a of this.attempts(key)) {
      for (const sel of a.selectors) {
        try {
          const c = el.closest(sel);
          if (c) return c;
        } catch {
          /* invalid selector */
        }
      }
    }
    return null;
  }

  report(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  resetReport() {
    this.counts.clear();
  }
}

export function isValidSelector(sel: string): boolean {
  try {
    document.createDocumentFragment().querySelector(sel);
    return true;
  } catch {
    return false;
  }
}

const validList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every(s => typeof s === 'string' && isValidSelector(s));

export function parseOverrides(json: string): { value: Record<string, LocatorOverride>; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { value: {}, errors: ['Invalid JSON'] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { value: {}, errors: ['Expected an object of key -> override'] };
  }
  const value: Record<string, LocatorOverride> = {};
  const errors: string[] = [];
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isLocatorKey(key)) {
      errors.push(`Unknown key: ${key}`);
      continue;
    }
    const o = (v ?? {}) as Partial<LocatorOverride>;
    if (!validList(o.selectors)) {
      errors.push(`${key}: invalid selectors`);
      continue;
    }
    if (o.shadowPath !== undefined && !validList(o.shadowPath)) {
      errors.push(`${key}: invalid shadowPath`);
      continue;
    }
    value[key] = {
      selectors: o.selectors,
      ...(o.shadowPath ? { shadowPath: o.shadowPath } : {}),
      ...(o.replaceDefaults === true ? { replaceDefaults: true } : {}),
    };
  }
  return { value, errors };
}
