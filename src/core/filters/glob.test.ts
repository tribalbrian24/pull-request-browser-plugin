import { describe, expect, it } from 'vitest';
import { globToRegExp, matchPattern, parsePatterns, splitTop } from './glob';

const m = (g: string, p: string) => globToRegExp(g).test(p);

describe('globToRegExp', () => {
  it('handles globstar and extensions', () => {
    expect(m('**/*.md*.zip', 'a/b/c.mdx.zip')).toBe(true);
    expect(m('**/*.md*.zip', 'c.md.zip')).toBe(true);
    expect(m('**/*.md*.zip', 'a/c.zip')).toBe(false);
    expect(m('**/*.test.ts', 'src/a/b.test.ts')).toBe(true);
    expect(m('**/*.test.ts', 'b.test.ts')).toBe(true);
    expect(m('**/*.test.ts', 'b.test.tsx')).toBe(false);
  });

  it('treats slash-less patterns as any-depth names (gitignore style)', () => {
    expect(m('*.snap', 'a/b/x.snap')).toBe(true);
    expect(m('*.snap', 'x.snap')).toBe(true);
    expect(m('__snapshots__', 'a/__snapshots__/x.snap')).toBe(true);
  });

  it('anchors patterns with a slash or leading slash', () => {
    expect(m('src/*.ts', 'src/a.ts')).toBe(true);
    expect(m('src/*.ts', 'x/src/a.ts')).toBe(false);
    expect(m('/README.md', 'README.md')).toBe(true);
    expect(m('/README.md', 'docs/README.md')).toBe(false);
  });

  it('treats a trailing slash as directory contents', () => {
    expect(m('dist/', 'dist/a.js')).toBe(true);
    expect(m('dist/', 'src/dist/a.js')).toBe(true);
    expect(m('dist/', 'dist')).toBe(false);
  });

  it('supports braces, classes, ? and ** in the middle', () => {
    expect(m('**/*.{ts,tsx}', 'a/b.tsx')).toBe(true);
    expect(m('**/*.{ts,tsx}', 'a/b.js')).toBe(false);
    expect(m('src/**/x.ts', 'src/x.ts')).toBe(true);
    expect(m('src/**/x.ts', 'src/a/b/x.ts')).toBe(true);
    expect(m('a?.ts', 'ab.ts')).toBe(true);
    expect(m('a?.ts', 'a/.ts')).toBe(false);
    expect(m('f[0-9].ts', 'f7.ts')).toBe(true);
    expect(m('f[!0-9].ts', 'fa.ts')).toBe(true);
    expect(m('f[!0-9].ts', 'f7.ts')).toBe(false);
  });

  it("supports jest's default extglob testMatch", () => {
    const a = '**/__tests__/**/*.[jt]s?(x)';
    const b = '**/?(*.)+(spec|test).[jt]s?(x)';
    expect(m(a, 'src/__tests__/a.ts')).toBe(true);
    expect(m(a, 'src/__tests__/deep/a.tsx')).toBe(true);
    expect(m(a, 'src/a.ts')).toBe(false);
    expect(m(b, 'src/a.test.ts')).toBe(true);
    expect(m(b, 'src/a.spec.jsx')).toBe(true);
    expect(m(b, 'test.js')).toBe(true);
    expect(m(b, 'src/atest.ts')).toBe(false);
  });

  it('ignores case', () => {
    expect(m('**/*.png', 'a/B.PNG')).toBe(true);
    expect(m('src/*.ts', 'SRC/a.TS')).toBe(true);
  });

  it('escapes regex specials', () => {
    expect(m('a+b(1).ts', 'a+b(1).ts')).toBe(true);
    expect(m('a.ts', 'aXts')).toBe(false);
  });
});

describe('matchPattern', () => {
  it('supports re: patterns against an absolute-style path', () => {
    expect(matchPattern('re:/node_modules/', 'node_modules/x/y.js')).toBe(true);
    expect(matchPattern('re:/node_modules/', 'src/a.js')).toBe(false);
    expect(matchPattern('re:\\.test\\.ts$', 'a/b.test.ts')).toBe(true);
  });
  it('is safe on bad input', () => {
    expect(matchPattern('re:(', 'a')).toBe(false);
    expect(matchPattern('', 'a')).toBe(false);
  });
});

describe('parsePatterns', () => {
  it('splits on lines and commas but not inside braces', () => {
    expect(parsePatterns('**/*.{ts,tsx}, **/*.snap\n# comment\n\n!dist/**')).toEqual(['**/*.{ts,tsx}', '**/*.snap', '!dist/**']);
  });
  it('keeps re: lines whole', () => {
    expect(parsePatterns('re:a{1,2},b')).toEqual(['re:a{1,2},b']);
    expect(parsePatterns('!re:/x/')).toEqual(['!re:/x/']);
  });
  it('splitTop respects classes and escapes', () => {
    expect(splitTop('a,[b,c],d\\,e', ',')).toEqual(['a', '[b,c]', 'd\\,e']);
  });
});
