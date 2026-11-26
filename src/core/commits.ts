import { pressEscape, sleep, waitFor } from './dom';
import type { LocatorRegistry } from './locators/registry';

export interface CommitItem {
  sha: string;
  label: string;
  description: string;
  selected: boolean;
  truncated: boolean;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function parseCommitItem(reg: LocatorRegistry, li: Element): CommitItem | null {
  const sha = clean(reg.first('commits.sha', li, { track: false })?.textContent);
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
  const label = clean(reg.first('commits.label', li, { track: false })?.textContent);
  return {
    sha,
    label,
    description: clean(reg.first('commits.description', li, { track: false })?.textContent),
    selected: li.getAttribute('aria-selected') === 'true',
    truncated: label.endsWith('…'),
  };
}

export function readCommitList(reg: LocatorRegistry, root: ParentNode = document): CommitItem[] {
  const list = reg.first('commits.list', root, { track: false });
  if (!list) return [];
  return reg
    .all('commits.item', list, { track: false })
    .map(li => parseCommitItem(reg, li))
    .filter((c): c is CommitItem => c !== null);
}

/** GitHub lists the range picker oldest first (checked on one sample), so the head commit is last. */
export const headSha = (items: CommitItem[]): string | null => items.at(-1)?.sha ?? null;

export function selectedRange(items: CommitItem[]) {
  const sel = items.filter(i => i.selected);
  return { first: sel[0] ?? null, last: sel.at(-1) ?? null, count: sel.length };
}

export const commitsMarkdown = (items: CommitItem[]): string =>
  items
    .map(i => `- \`${i.sha}\` ${i.label}${i.truncated ? ' (subject truncated by GitHub)' : ''}${i.description ? ` — ${i.description}` : ''}`)
    .join('\n');

/** Opens the picker only if it is closed, reads it, and closes it again. */
export async function openAndReadCommits(reg: LocatorRegistry): Promise<CommitItem[]> {
  const already = readCommitList(reg);
  if (already.length) return already;
  const button = reg.first('commits.button', document, { track: false }) as HTMLElement | null;
  if (!button) return [];
  button.click();
  const items = await waitFor(() => {
    const read = readCommitList(reg);
    return read.length ? read : null;
  }, 2500);
  pressEscape();
  await sleep(100);
  return items ?? [];
}
