import type { ClipboardListener } from '../clipboard';
import { fullClick, isRendered, pressEscape, sleep, waitFor } from '../dom';
import type { LocatorRegistry } from '../locators/registry';

export interface Trigger {
  kind: 'react' | 'details';
  el: Element;
}

export interface MenuResult {
  text: string | null;
  reason: string;
}

export function findTriggers(reg: LocatorRegistry, thread: Element): Trigger[] {
  const out: Trigger[] = reg.all('comment.menu.react', thread).map(el => ({ kind: 'react', el }));
  for (const el of reg.all('comment.menu.details', thread)) {
    if (!out.some(t => t.el === el)) out.push({ kind: 'details', el });
  }
  return out;
}

export async function copyViaMenu(reg: LocatorRegistry, t: Trigger, clip: ClipboardListener): Promise<MenuResult> {
  const d = t.kind === 'details' || t.el.tagName === 'SUMMARY' ? (t.el.closest('details') as HTMLDetailsElement | null) : null;
  // Closed popovers (for example each thread's "Resolve with reason" menu) keep hidden items in the page; only visible ones count.
  const items = () => reg.all('menu.item', d ?? document, { deep: false, track: false }).filter(isRendered);
  const find = () => items().find(li => /copy\s+markdown/i.test(li.textContent ?? '')) ?? null;
  const close = () => {
    if (d) {
      if (d.open) d.open = false;
    } else if (items().length) {
      pressEscape();
    }
  };

  clip.reset();
  if (d?.open) d.open = false;
  (t.el as HTMLElement).click();
  let item = await waitFor(find, 1500);
  if (!item) {
    if (d?.open) {
      item = await waitFor(find, 2500);
    } else if (!items().length) {
      fullClick(t.el);
      item = await waitFor(find, 2000);
    }
  }
  if (!item) {
    const labels = items()
      .map(li => (li.textContent ?? '').trim().replace(/\s+/g, ' '))
      .join(' | ');
    const reason = items().length ? `no "Copy Markdown" in menu (items: ${labels})` : 'menu never opened';
    close();
    return { text: null, reason };
  }

  (item as HTMLElement).click();
  const text = await waitFor(() => clip.value(), 2000);
  close();
  await sleep(150);
  return text ? { text, reason: '' } : { text: null, reason: 'clipboard write not observed' };
}
