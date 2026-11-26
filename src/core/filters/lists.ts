import { matchPattern } from './glob';

export type ListId = string;
export type LayerKind = 'builtin' | 'pack' | 'jest' | 'global' | 'repo' | 'path' | 'temp';

export interface Layer {
  id: string;
  label: string;
  kind: LayerKind;
  repo?: string;
  pathPrefix?: string;
  lists: Record<ListId, string[]>;
}

export const KIND_ORDER: Record<LayerKind, number> = { builtin: 0, pack: 1, jest: 2, global: 3, repo: 4, path: 5, temp: 6 };

export const LIST_LABELS: Record<string, string> = {
  tests: 'Tests',
  snapshots: 'Snapshots',
  generated: 'Generated / lockfiles',
  docs: 'Docs',
  images: 'Images (incl. SVG)',
  binary: 'Binary files',
};

const IMAGES = '**/*.{png,jpg,jpeg,gif,webp,avif,bmp,ico,icns,tif,tiff,heic,svg,svgz}';

export const LIST_HINTS: Record<string, string> = {
  tests: 'Files that are tests (spec, test, __tests__, mocks). Used by Hide tests, Only tests and Tests removed.',
  snapshots: 'Snapshot files (__snapshots__, .snap and any stack packs you enabled). Used by Hide snapshots and Only snapshots.',
  generated: 'Generated files: lockfiles, build output, minified files, source maps. Used by Hide generated.',
  docs: 'Documentation files such as markdown.',
  images: 'Image files including SVG. Used by Hide images / SVG.',
  binary: 'Binary files: images, fonts, archives, PDFs, audio and video. Used by Hide binary files.',
};

export const BUILTIN_LAYER: Layer = {
  id: 'builtin',
  label: 'Built-in',
  kind: 'builtin',
  lists: {
    tests: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}',
      '**/test/**',
      '**/tests/**',
    ],
    snapshots: ['**/__snapshots__/**', '**/*.snap'],
    generated: [
      '**/*.min.{js,css}',
      '**/*.map',
      '**/dist/**',
      '**/build/**',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/yarn.lock',
      '**/*.generated.*',
    ],
    docs: ['**/*.md', '**/*.mdx', 'docs/**'],
    images: [IMAGES],
    binary: [
      IMAGES,
      '**/*.{woff,woff2,ttf,otf,eot}',
      '**/*.{zip,gz,tgz,tar,7z,rar,jar,aar,apk,ipa,dmg,exe,dll,so,dylib,a,o,class,bin}',
      '**/*.{pdf,psd,sketch,fig,ai}',
      '**/*.{mp3,mp4,m4a,mov,avi,wav,ogg,webm}',
    ],
  },
};

export interface Verdict {
  member: boolean;
  decidedBy: string | null;
}

function relativeTo(layer: Layer, repo: string, path: string): string | null {
  if (layer.repo && layer.repo !== repo) return null;
  const prefix = layer.pathPrefix?.replace(/^\/+|\/+$/g, '');
  if (!prefix) return path;
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : null;
}

/** Later layers override earlier ones. Within one layer, a "!" pattern beats a positive one. */
export function verdict(layers: Layer[], listId: ListId, repo: string, path: string): Verdict {
  const ordered = layers
    .map((l, i) => ({ l, i }))
    .sort((a, b) => KIND_ORDER[a.l.kind] - KIND_ORDER[b.l.kind] || a.i - b.i)
    .map(x => x.l);
  let result: Verdict = { member: false, decidedBy: null };
  for (const layer of ordered) {
    const patterns = layer.lists[listId];
    if (!patterns?.length) continue;
    const rel = relativeTo(layer, repo, path);
    if (rel === null) continue;
    const negHit = patterns.some(p => p.startsWith('!') && matchPattern(p.slice(1), rel));
    const posHit = patterns.some(p => !p.startsWith('!') && matchPattern(p, rel));
    if (negHit) result = { member: false, decidedBy: layer.label };
    else if (posHit) result = { member: true, decidedBy: layer.label };
  }
  return result;
}

export const inList = (layers: Layer[], listId: ListId, repo: string, path: string) =>
  verdict(layers, listId, repo, path).member;
