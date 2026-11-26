import type { Layer } from './lists';

export interface JestPatterns {
  testMatch: string[];
  testRegex: string[];
  ignore: string[];
  roots: string[];
  projects: string[];
  confidence: 'exact' | 'best-effort' | 'none';
  notes: string[];
}

const DEFAULT_TEST_MATCH = ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'];
const DEFAULT_IGNORE = ['/node_modules/'];

const empty = (confidence: JestPatterns['confidence'], notes: string[] = []): JestPatterns => ({
  testMatch: [],
  testRegex: [],
  ignore: [],
  roots: [],
  projects: [],
  confidence,
  notes,
});

const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function fromObject(cfg: Record<string, unknown>, into: JestPatterns) {
  into.testMatch.push(...strings(cfg.testMatch));
  into.testRegex.push(...strings(cfg.testRegex));
  into.ignore.push(...strings(cfg.testPathIgnorePatterns));
  into.roots.push(...strings(cfg.roots));
  if (Array.isArray(cfg.projects)) {
    for (const p of cfg.projects) {
      if (typeof p === 'string') into.projects.push(p);
      else if (p && typeof p === 'object') fromObject(p as Record<string, unknown>, into);
    }
  }
}

const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

function literalsFor(src: string, key: string, notes: string[]): string[] {
  const m = src.match(new RegExp(`\\b${key}\\s*:\\s*(\\[[^\\]]*\\]|'[^']*'|"[^"]*"|\`[^\`]*\`)`));
  if (!m) {
    if (new RegExp(`\\b${key}\\b`).test(src)) notes.push(`${key} is set but not a plain literal; ignored`);
    return [];
  }
  if (m[1].includes('...')) notes.push(`${key} uses spread; some entries may be missing`);
  const out: string[] = [];
  for (const lit of m[1].matchAll(LITERAL)) {
    if (lit[1] === '`' && lit[2].includes('${')) notes.push(`${key} has a template with interpolation; skipped`);
    else out.push(lit[2].replace(/\\(.)/g, '$1'));
  }
  return out;
}

/** Static only: JSON is parsed, JS/TS configs are scanned for plain literals. Nothing is executed. */
export function parseJestConfig(text: string, path: string): JestPatterns {
  const name = path.split('/').pop() ?? path;
  if (name.endsWith('.json')) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return empty('none', ['invalid JSON']);
    }
    const cfg = name === 'package.json' ? (json as { jest?: unknown })?.jest : json;
    if (!cfg || typeof cfg !== 'object') return empty('none', ['no jest config in this file']);
    const out = empty('exact');
    fromObject(cfg as Record<string, unknown>, out);
    return out;
  }
  const out = empty('best-effort');
  out.testMatch = literalsFor(text, 'testMatch', out.notes);
  out.testRegex = literalsFor(text, 'testRegex', out.notes);
  out.ignore = literalsFor(text, 'testPathIgnorePatterns', out.notes);
  out.roots = literalsFor(text, 'roots', out.notes);
  out.projects = literalsFor(text, 'projects', out.notes);
  if (!/\b(testMatch|testRegex|testPathIgnorePatterns|roots|projects|preset|transform)\b/.test(text)) {
    return empty('none', ['no jest settings found']);
  }
  return out;
}

const stripRoot = (s: string) => s.replace(/^<rootDir>\/?/, '');

export function jestToLayer(p: JestPatterns, configPath: string, repo: string): Layer {
  const dir = configPath.includes('/') ? configPath.slice(0, configPath.lastIndexOf('/')) : '';
  const roots = p.roots.map(stripRoot).filter(r => r && r !== '.');
  const hasMatch = p.testMatch.length > 0 || p.testRegex.length > 0;
  const globs = (hasMatch ? p.testMatch : DEFAULT_TEST_MATCH).map(stripRoot);
  const rooted = roots.length ? roots.flatMap(r => globs.map(g => (g.startsWith('**') ? `${r}/${g}` : g))) : globs;
  const tests = [
    ...rooted,
    ...p.testRegex.map(r => `re:${r.replace(/<rootDir>/g, '')}`),
    ...(p.ignore.length ? p.ignore : DEFAULT_IGNORE).map(r => `!re:${r.replace(/<rootDir>/g, '')}`),
  ];
  return {
    id: `jest:${repo}:${configPath}`,
    label: `Jest ${configPath}`,
    kind: 'jest',
    repo,
    ...(dir ? { pathPrefix: dir } : {}),
    lists: { tests },
  };
}
