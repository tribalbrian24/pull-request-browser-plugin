import type { LocatorRegistry } from '../locators/registry';
import { idOf, reviewIdOf } from './ids';

/** Every comment id on the page mapped to whether its thread is resolved. Used to tell "resolved" from "gone". */
export function scanPageComments(reg: LocatorRegistry, root: ParentNode = document): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const thread of reg.all('thread.all', root, { track: false })) {
    const resolved = thread.getAttribute('data-resolved') === 'true';
    for (const c of reg.all('comment.container', thread, { track: false })) {
      const id = idOf(c);
      if (id) out.set(id, resolved);
    }
  }
  for (const box of reg.all('review.box', root, { track: false })) {
    const id = reviewIdOf(box);
    if (id) out.set(id, false);
  }
  return out;
}
