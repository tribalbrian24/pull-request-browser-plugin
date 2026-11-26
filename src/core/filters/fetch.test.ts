import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry } from '../locators/registry';
import { detectJest, readPrRef } from './detect';
import { isSafeRepoPath, rawUrl } from './fetch';
import { inList } from './lists';

describe('rawUrl and path safety', () => {
  it('builds same-origin raw URLs and encodes segments', () => {
    expect(rawUrl('https://github.com', 'o/r', 'feature/x y', 'packages/a b/jest.config.ts')).toBe(
      'https://github.com/o/r/raw/feature/x%20y/packages/a%20b/jest.config.ts',
    );
  });
  it('rejects unsafe paths', () => {
    for (const p of ['', '/etc/passwd', '../x', 'a/../b', 'a//b', 'a\\b', 'a/b/']) expect(isSafeRepoPath(p)).toBe(false);
    expect(isSafeRepoPath('packages/a/package.json')).toBe(true);
  });
});

describe('detectJest', () => {
  it('builds layers from the configs it can read and explains the rest', async () => {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({ jest: { testMatch: ['**/*.spec.ts'] } }),
      'jest.config.ts': 'export default { testMatch: ["**/*.int.ts"], projects: ["<rootDir>/packages/a"] }',
      'jest.config.js': 'const x = 1;',
    };
    const { layers, notes } = await detectJest('o/r', ['package.json', 'jest.config.json', 'jest.config.js', 'jest.config.ts'], async p => files[p] ?? null);
    expect(layers.map(l => l.id)).toEqual(['jest:o/r:package.json', 'jest:o/r:jest.config.ts']);
    expect(notes).toEqual([
      'jest.config.json: not found or not readable',
      'jest.config.js: no jest settings found',
      'jest.config.ts: read statically (best effort), please review',
      'jest.config.ts: lists projects (<rootDir>/packages/a); add their config paths too',
    ]);
    expect(inList(layers, 'tests', 'o/r', 'src/a.spec.ts')).toBe(true);
    expect(inList(layers, 'tests', 'o/r', 'src/a.int.ts')).toBe(true);
    expect(inList(layers, 'tests', 'o/r', 'src/a.test.ts')).toBe(false);
  });
});

describe('readPrRef', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  const reg = new LocatorRegistry();
  it('prefers the head SHA, then a same-repo branch, then HEAD', () => {
    document.body.innerHTML = '<input name="expected_head_oid" value="a1b2c3dabcdef"><span class="head-ref">feature/x</span>';
    expect(readPrRef(reg)).toBe('a1b2c3dabcdef');
    document.body.innerHTML = '<span class="head-ref">feature/x</span>';
    expect(readPrRef(reg)).toBe('feature/x');
    document.body.innerHTML = '<span class="head-ref">someone:feature/x</span>';
    expect(readPrRef(reg)).toBe('HEAD');
    document.body.innerHTML = '';
    expect(readPrRef(reg)).toBe('HEAD');
  });
});
