import { describe, expect, it } from 'vitest';
import { BUILTIN_LAYER, LIST_HINTS, LIST_LABELS, inList, verdict, type Layer } from './lists';

const layer = (over: Partial<Layer> & { lists: Layer['lists'] }): Layer => ({
  id: 'x',
  label: over.label ?? 'x',
  kind: 'global',
  ...over,
});
const REPO = 'acme/widgets';

describe('built-in lists', () => {
  const t = (p: string) => inList([BUILTIN_LAYER], 'tests', REPO, p);
  it('recognises common test files', () => {
    expect(t('src/a.test.ts')).toBe(true);
    expect(t('packages/x/src/__tests__/a.ts')).toBe(true);
    expect(t('src/__mocks__/m.ts')).toBe(true);
    expect(t('src/a.ts')).toBe(false);
  });
  it('separates snapshots, generated and docs', () => {
    expect(inList([BUILTIN_LAYER], 'snapshots', REPO, 'a/__snapshots__/x.snap')).toBe(true);
    expect(inList([BUILTIN_LAYER], 'generated', REPO, 'pnpm-lock.yaml')).toBe(true);
    expect(inList([BUILTIN_LAYER], 'docs', REPO, 'README.md')).toBe(true);
    expect(inList([BUILTIN_LAYER], 'docs', REPO, 'src/a.ts')).toBe(false);
  });
});

describe('layers', () => {
  it('later kinds override earlier ones regardless of array order', () => {
    const temp = layer({ kind: 'temp', label: 'temp', lists: { tests: ['!src/a.test.ts'] } });
    const repoL = layer({ kind: 'repo', label: 'repo', lists: { tests: ['src/b.ts'] } });
    const layers = [temp, BUILTIN_LAYER, repoL];
    expect(verdict(layers, 'tests', REPO, 'src/a.test.ts')).toEqual({ member: false, decidedBy: 'temp' });
    expect(verdict(layers, 'tests', REPO, 'src/b.ts')).toEqual({ member: true, decidedBy: 'repo' });
    expect(verdict(layers, 'tests', REPO, 'src/c.test.ts')).toEqual({ member: true, decidedBy: 'Built-in' });
  });

  it('exclusions beat inclusions inside one layer', () => {
    const l = layer({ lists: { tests: ['**/*.ts', '!src/keep.ts'] } });
    expect(inList([l], 'tests', REPO, 'src/keep.ts')).toBe(false);
    expect(inList([l], 'tests', REPO, 'src/other.ts')).toBe(true);
  });

  it('scopes layers to a repo', () => {
    const l = layer({ kind: 'repo', repo: 'a/b', lists: { tests: ['**/*.x'] } });
    expect(inList([l], 'tests', 'a/b', 'f.x')).toBe(true);
    expect(inList([l], 'tests', 'a/c', 'f.x')).toBe(false);
  });

  it('applies path-prefixed layers relative to the prefix only', () => {
    const l = layer({ kind: 'path', pathPrefix: 'packages/store', lists: { tests: ['src/**/*.spec.ts', '/root.ts'] } });
    expect(inList([l], 'tests', REPO, 'packages/store/src/a/b.spec.ts')).toBe(true);
    expect(inList([l], 'tests', REPO, 'packages/other/src/a/b.spec.ts')).toBe(false);
    expect(inList([l], 'tests', REPO, 'packages/store/root.ts')).toBe(true);
    expect(inList([l], 'tests', REPO, 'root.ts')).toBe(false);
  });

  it('returns not a member for unknown lists', () => {
    expect(verdict([BUILTIN_LAYER], 'nope', REPO, 'a')).toEqual({ member: false, decidedBy: null });
  });

  it('finds images including SVG and uppercase extensions', () => {
    const img = (p: string) => inList([BUILTIN_LAYER], 'images', REPO, p);
    for (const p of ['a.png', 'icons/logo.SVG', 'x/y/photo.JPEG', 'a.webp', 'fav.ico', 'x.svgz']) expect(img(p)).toBe(true);
    expect(img('src/a.ts')).toBe(false);
    expect(img('src/svg-utils.ts')).toBe(false);
  });

  it('treats images, fonts, archives and media as binary', () => {
    const bin = (p: string) => inList([BUILTIN_LAYER], 'binary', REPO, p);
    for (const p of ['a.png', 'icon.svg', 'f.woff2', 'lib/x.jar', 'doc.pdf', 'clip.mp4', 'app.apk']) expect(bin(p)).toBe(true);
    expect(bin('src/a.ts')).toBe(false);
    expect(bin('README.md')).toBe(false);
  });
});

describe('list help', () => {
  it('has a hover hint for every list', () => {
    for (const id of Object.keys(LIST_LABELS)) expect((LIST_HINTS[id] ?? '').length > 20).toBe(true);
  });
});

