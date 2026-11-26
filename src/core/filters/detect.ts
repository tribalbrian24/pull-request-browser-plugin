import type { LocatorRegistry } from '../locators/registry';
import { jestToLayer, parseJestConfig } from './jest';
import type { Layer } from './lists';

export const DEFAULT_CONFIG_PATHS = ['package.json', 'jest.config.json', 'jest.config.js', 'jest.config.ts'];

export interface DetectResult {
  layers: Layer[];
  notes: string[];
}

export async function detectJest(
  repo: string,
  configPaths: string[],
  readFile: (path: string) => Promise<string | null>,
): Promise<DetectResult> {
  const layers: Layer[] = [];
  const notes: string[] = [];
  for (const path of configPaths) {
    const text = await readFile(path);
    if (text === null) {
      notes.push(`${path}: not found or not readable`);
      continue;
    }
    const patterns = parseJestConfig(text, path);
    for (const n of patterns.notes) notes.push(`${path}: ${n}`);
    if (patterns.confidence === 'none') continue;
    layers.push(jestToLayer(patterns, path, repo));
    if (patterns.confidence === 'best-effort') notes.push(`${path}: read statically (best effort), please review`);
    if (patterns.projects.length) notes.push(`${path}: lists projects (${patterns.projects.join(', ')}); add their config paths too`);
  }
  return { layers, notes };
}

export function readPrRef(reg: LocatorRegistry): string {
  const shaEl = reg.first('pr.headSha', document, { track: false });
  const sha = (shaEl as HTMLInputElement | null)?.value || shaEl?.getAttribute('data-head-sha') || '';
  if (/^[0-9a-f]{7,40}$/i.test(sha)) return sha;
  const ref = reg.first('pr.headRef', document, { track: false })?.textContent?.trim() ?? '';
  return ref && !ref.includes(':') ? ref : 'HEAD';
}
