import { stripOriginallyPosted } from './markdown';
import type { CapturedThread, DeltaStatus } from './types';

export interface SnapshotEntry {
  path: string;
  range: string;
  hash: string;
}

export interface Snapshot {
  at: number;
  entries: Record<string, SnapshotEntry>;
}

export type DeltaMode = 'all' | 'new-edited' | 'changes';

export interface Delta {
  status: Map<string, DeltaStatus>;
  counts: Record<DeltaStatus, number>;
  resolved: SnapshotEntry[];
  missing: SnapshotEntry[];
  since: number | null;
}

/** FNV-1a, 32 bit: enough to notice an edit, not a security feature. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const commentKey = (t: CapturedThread, i: number): string => {
  const c = t.comments[i];
  return c.id ? `c${c.id}` : `${t.path}|${i}|${c.author}`;
};

const hashOf = (text: string) => hashText(stripOriginallyPosted(text));

export function snapshotOf(threads: CapturedThread[], at: number): Snapshot {
  const entries: Record<string, SnapshotEntry> = {};
  for (const t of threads) {
    t.comments.forEach((c, i) => {
      if (c.text) entries[commentKey(t, i)] = { path: t.path, range: t.range, hash: hashOf(c.text) };
    });
  }
  return { at, entries };
}

/** page: comment id -> thread resolved?, for every comment id currently on the page. */
export function computeDelta(threads: CapturedThread[], prev: Snapshot | null, page: Map<string, boolean>): Delta {
  const status = new Map<string, DeltaStatus>();
  const counts: Record<DeltaStatus, number> = { new: 0, edited: 0, unchanged: 0 };
  const current = new Set<string>();
  for (const t of threads) {
    t.comments.forEach((c, i) => {
      if (!c.text) return;
      const key = commentKey(t, i);
      current.add(key);
      const before = prev?.entries[key];
      const s: DeltaStatus = !before ? 'new' : before.hash !== hashOf(c.text) ? 'edited' : 'unchanged';
      status.set(key, s);
      counts[s]++;
    });
  }
  const resolved: SnapshotEntry[] = [];
  const missing: SnapshotEntry[] = [];
  for (const [key, entry] of Object.entries(prev?.entries ?? {})) {
    if (current.has(key) || !key.startsWith('c')) continue;
    const onPage = page.get(key.slice(1));
    if (onPage === true) resolved.push(entry);
    else if (onPage === undefined) missing.push(entry);
  }
  return { status, counts, resolved, missing, since: prev?.at ?? null };
}

export const formatTime = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const label = (e: SnapshotEntry) => `\`${e.path}${e.range ? `:${e.range}` : ''}\``;

export function applyDelta(
  threads: CapturedThread[],
  delta: Delta,
  mode: DeltaMode,
): { threads: CapturedThread[]; header: string } {
  if (mode === 'all') return { threads, header: '' };

  const kept: CapturedThread[] = [];
  for (const t of threads) {
    const comments = t.comments
      .map((c, i) => ({ ...c, status: delta.status.get(commentKey(t, i)) }))
      .filter(c => c.status === 'new' || c.status === 'edited');
    if (comments.length) kept.push({ ...t, comments });
  }

  const { counts } = delta;
  const lines = [
    delta.since === null
      ? '## First capture of this PR (no earlier snapshot): everything is new'
      : `## Changes since ${formatTime(delta.since)}`,
    `- ${counts.new} new, ${counts.edited} edited, ${counts.unchanged} unchanged (left out)`,
  ];
  if (mode === 'changes') {
    if (delta.resolved.length) lines.push(`- resolved: ${delta.resolved.map(label).join(', ')}`);
    if (delta.missing.length) lines.push(`- no longer on the page (deleted or not loaded): ${delta.missing.map(label).join(', ')}`);
  }
  return { threads: kept, header: lines.join('\n') };
}

export function prune(snapshots: Record<string, Snapshot>, max = 60): Record<string, Snapshot> {
  return Object.fromEntries(
    Object.entries(snapshots)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, max),
  );
}
