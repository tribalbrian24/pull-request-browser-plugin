import type { LocatorRegistry } from '../locators/registry';

export type FileStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'renamed-modified' | 'unknown';

export interface FileEntry {
  digest: string;
  index: number;
  path: string;
  oldPath?: string;
  status: FileStatus;
  /** The diff area says the file is binary (GitHub shows no hunks for it). */
  binary: boolean;
}

export function parsePathText(text: string): { path: string; oldPath?: string } {
  const clean = text.replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  const named = clean.match(/^(.+?) renamed to (.+)$/);
  if (named) return { oldPath: named[1], path: named[2] };
  const arrow = clean.match(/^(.+?) → (.+)$/);
  if (arrow) return { oldPath: arrow[1], path: arrow[2] };
  return { path: clean };
}

export function hunkKind(header: string): 'added' | 'deleted' | 'modified' | null {
  const m = header.match(/^\s*@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!m) return null;
  if (m[1] === '0' && (m[2] ?? '1') === '0') return 'added';
  if (m[3] === '0' && (m[4] ?? '1') === '0') return 'deleted';
  return 'modified';
}

export function statusOf(hunk: string | null, renamed: boolean): FileStatus {
  const kind = hunk ? hunkKind(hunk) : null;
  if (renamed) return kind ? 'renamed-modified' : 'renamed';
  return kind ?? 'unknown';
}

export function readFileEntries(reg: LocatorRegistry, root: ParentNode = document): FileEntry[] {
  const out: FileEntry[] = [];
  for (const row of reg.all('files.row', root, { deep: false, track: false })) {
    const el = row as HTMLElement;
    // Older layout: data-path-digest. Newer layout: the section's id is "diff-<digest>" (the same SHA-256 of the file path).
    const digest = el.dataset.pathDigest || el.id.replace(/^diff-/, '');
    const text = reg.first('files.path', row, { track: false })?.textContent;
    if (!/^[0-9a-f]{8,64}$/i.test(digest) || !text) continue;
    const { path, oldPath } = parsePathText(text);
    const hunk = reg.first('files.hunk', row, { track: false })?.textContent ?? null;
    const binary = !hunk && /binary file/i.test(el.textContent ?? '');
    out.push({ digest, index: el.dataset.index !== undefined ? Number(el.dataset.index) : out.length, path, ...(oldPath ? { oldPath } : {}), status: statusOf(hunk, !!oldPath), binary });
  }
  return out;
}
