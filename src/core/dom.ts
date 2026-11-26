export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Tries fn now and again after each delay while done(result) is false. Returns the last result and the retry count. */
export async function retryBackoff<T>(
  fn: () => T,
  done: (value: T) => boolean,
  delays: number[],
  wait: (ms: number) => Promise<void> = sleep,
): Promise<{ value: T; retries: number }> {
  let value = fn();
  let retries = 0;
  while (!done(value) && retries < delays.length) {
    await wait(delays[retries]);
    retries++;
    value = fn();
  }
  return { value, retries };
}

export async function waitFor<T>(
  fn: () => T | null | undefined | false,
  timeout = 3000,
  interval = 50,
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = fn();
    if (v) return v;
    await sleep(interval);
  }
  return null;
}

export function deepQuerySelectorAll(root: ParentNode, selector: string): Element[] {
  const out: Element[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 1 && node !== (root as unknown as Node) && (node as Element).matches(selector)) {
      out.push(node as Element);
    }
    if (node.nodeType === 1 || node.nodeType === 9 || node.nodeType === 11) {
      for (const child of Array.from((node as ParentNode).children)) walk(child);
    }
    const sr = (node as Element).shadowRoot;
    if (sr) walk(sr);
  };
  walk(root as unknown as Node);
  return out;
}

/** True unless the browser says the element is hidden (for example inside a collapsed thread or a closed popover). */
export function isRendered(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(el) : true;
}

export function fullClick(el: Element) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true }));
  }
}

export function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
