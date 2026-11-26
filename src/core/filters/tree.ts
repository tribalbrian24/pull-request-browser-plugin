import type { LocatorRegistry } from '../locators/registry';
import { decide, type Filter } from './presets';

/**
 * Which file tree entries to hide for a filter. Path-based filters (tests, snapshots, images...) can judge every file in the
 * tree, rendered or not. Status filters only know the files GitHub has drawn (known); the others stay visible.
 * A folder is hidden when it has files and all of them are hidden.
 */
export function computeTreeHidden(
  reg: LocatorRegistry,
  f: Filter,
  inList: (listId: string, path: string) => boolean,
  known: Map<string, 'hide' | 'keep'>,
  root: ParentNode = document,
): string[] {
  const tree = reg.first('tree.root', root, { track: false, deep: false });
  if (!tree) return [];
  const items = reg.all('tree.item', tree, { track: false, deep: false });
  const isFolder = (li: Element) => li.hasAttribute('aria-expanded');
  const hidden = new Set<string>();

  for (const li of items) {
    if (isFolder(li) || !li.id) continue;
    const verdict = f.statuses ? (known.get(li.id) ?? 'keep') : decide(f, 'unknown', listId => inList(listId, li.id));
    if (verdict === 'hide') hidden.add(li.id);
  }
  for (const li of items) {
    if (!isFolder(li) || !li.id) continue;
    const files = Array.from(li.querySelectorAll('li[role="treeitem"]')).filter(x => !isFolder(x) && x.id);
    if (files.length && files.every(x => hidden.has(x.id))) hidden.add(li.id);
  }
  return Array.from(hidden);
}
