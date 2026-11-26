import { describe, expect, it } from 'vitest';
import { jestToLayer, parseJestConfig } from './jest';
import { inList } from './lists';

const REPO = 'o/r';

describe('parseJestConfig', () => {
  it('reads package.json#jest', () => {
    const p = parseJestConfig(JSON.stringify({ name: 'x', jest: { testMatch: ['**/*.t.ts'], testPathIgnorePatterns: ['/dist/'] } }), 'package.json');
    expect(p.confidence).toBe('exact');
    expect(p.testMatch).toEqual(['**/*.t.ts']);
    expect(p.ignore).toEqual(['/dist/']);
  });
  it('reports a package.json without jest settings', () => {
    expect(parseJestConfig('{"name":"x"}', 'package.json').confidence).toBe('none');
  });
  it('reads jest.config.json including inline projects and project paths', () => {
    const p = parseJestConfig(
      JSON.stringify({ projects: ['<rootDir>/packages/a', { testRegex: '\\.spec\\.ts$' }] }),
      'jest.config.json',
    );
    expect(p.projects).toEqual(['<rootDir>/packages/a']);
    expect(p.testRegex).toEqual(['\\.spec\\.ts$']);
  });
  it('rejects invalid JSON', () => {
    expect(parseJestConfig('{', 'jest.config.json').notes).toEqual(['invalid JSON']);
  });
  it('scans JS/TS configs for plain literals without executing them', () => {
    const src = `import type { Config } from 'jest';
const config: Config = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testMatch: ["**/*.spec.ts", '**/*.int.ts'],
  testPathIgnorePatterns: ['/e2e/'],
};
export default config;`;
    const p = parseJestConfig(src, 'jest.config.ts');
    expect(p.confidence).toBe('best-effort');
    expect(p.testMatch).toEqual(['**/*.spec.ts', '**/*.int.ts']);
    expect(p.roots).toEqual(['<rootDir>/src']);
    expect(p.ignore).toEqual(['/e2e/']);
  });
  it('notes values it cannot read statically', () => {
    const p = parseJestConfig('module.exports = { testMatch: [...base, "**/*.a.ts"], preset: "x" }', 'jest.config.js');
    expect(p.notes[0]).toMatch(/spread/);
    expect(p.testMatch).toEqual(['**/*.a.ts']);
    expect(parseJestConfig('const x = 1;', 'jest.config.js').confidence).toBe('none');
  });
  it('flags interpolated templates', () => {
    const p = parseJestConfig('module.exports = { testMatch: [`${dir}/**/*.t.ts`], preset: "x" }', 'jest.config.js');
    expect(p.testMatch).toEqual([]);
    expect(p.notes[0]).toMatch(/interpolation/);
  });
});

describe('jestToLayer', () => {
  it('uses jest defaults when nothing is configured', () => {
    const layer = jestToLayer(parseJestConfig('{"jest":{"preset":"x"}}', 'package.json'), 'package.json', REPO);
    const t = (p: string) => inList([layer], 'tests', REPO, p);
    expect(t('src/a.test.ts')).toBe(true);
    expect(t('src/__tests__/a.ts')).toBe(true);
    expect(t('src/a.ts')).toBe(false);
    expect(t('node_modules/x/a.test.js')).toBe(false);
    expect(layer.pathPrefix).toBeUndefined();
  });

  it('scopes a package config to its directory and honours testMatch, roots and ignores', () => {
    const p = parseJestConfig(
      JSON.stringify({ roots: ['<rootDir>/src'], testMatch: ['**/*.spec.ts'], testPathIgnorePatterns: ['/fixtures/'] }),
      'packages/store/jest.config.json',
    );
    const layer = jestToLayer(p, 'packages/store/jest.config.json', REPO);
    expect(layer.pathPrefix).toBe('packages/store');
    const t = (path: string) => inList([layer], 'tests', REPO, path);
    expect(t('packages/store/src/a.spec.ts')).toBe(true);
    expect(t('packages/store/lib/a.spec.ts')).toBe(false);
    expect(t('packages/store/src/fixtures/a.spec.ts')).toBe(false);
    expect(t('packages/other/src/a.spec.ts')).toBe(false);
  });

  it('turns testRegex into re: patterns', () => {
    const layer = jestToLayer(parseJestConfig('{"jest":{"testRegex":"/__spec__/.*\\\\.ts$"}}', 'package.json'), 'package.json', REPO);
    expect(inList([layer], 'tests', REPO, 'src/__spec__/a.ts')).toBe(true);
    expect(inList([layer], 'tests', REPO, 'src/a.ts')).toBe(false);
  });
});
