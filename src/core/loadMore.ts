import { sleep } from './dom';
import type { LocatorRegistry } from './locators/registry';

export interface LoadMoreResult {
  clicks: number;
  rounds: number;
  capped: boolean;
}

export interface LoadMoreOpts {
  maxRounds?: number;
  quietMs?: number;
  maxClicksPerButton?: number;
  onProgress?: (clicks: number) => void;
}

export function waitForQuiet(quietMs = 500, maxMs = 8000): Promise<void> {
  return new Promise(resolve => {
    let timer = setTimeout(done, quietMs);
    const max = setTimeout(done, maxMs);
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, quietMs);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    function done() {
      obs.disconnect();
      clearTimeout(timer);
      clearTimeout(max);
      resolve();
    }
  });
}

function isClickable(el: Element): boolean {
  const b = el as HTMLButtonElement;
  return (
    !b.disabled &&
    el.getAttribute('aria-disabled') !== 'true' &&
    el.getAttribute('aria-expanded') !== 'true' &&
    !(el as HTMLElement).hidden &&
    getComputedStyle(el).display !== 'none'
  );
}

export async function clickAllLoadMore(reg: LocatorRegistry, opts: LoadMoreOpts = {}): Promise<LoadMoreResult> {
  const { maxRounds = 30, quietMs = 500, maxClicksPerButton = 20 } = opts;
  const counts = new WeakMap<Element, number>();
  let clicks = 0;
  for (let round = 0; round < maxRounds; round++) {
    const targets = reg
      .all('load.more', document, { deep: false })
      .filter(el => isClickable(el) && (counts.get(el) ?? 0) < maxClicksPerButton);
    if (!targets.length) return { clicks, rounds: round, capped: false };
    for (const el of targets) {
      counts.set(el, (counts.get(el) ?? 0) + 1);
      (el as HTMLElement).click();
      clicks++;
      opts.onProgress?.(clicks);
      await sleep(100);
    }
    await waitForQuiet(quietMs);
  }
  return { clicks, rounds: maxRounds, capped: true };
}
