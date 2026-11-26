export const CLIPBOARD_EVENT = 'prc:clipboard';
export const ARM_ATTR = 'data-prc-arm';
export const HOOK_ATTR = 'data-prc-hook';
export const PASS_ATTR = 'data-prc-pass';

/**
 * Arms the page-side hook for one capture. By default the page's own copy is swallowed (the user's clipboard is never
 * touched). With passthrough the page's copy still happens, so the browser may ask for clipboard permission.
 */
export function armClipboard(opts: { passthrough?: boolean } = {}): () => void {
  const root = document.documentElement;
  root.setAttribute(ARM_ATTR, '1');
  if (opts.passthrough) root.setAttribute(PASS_ATTR, '1');
  return () => {
    root.removeAttribute(ARM_ATTR);
    root.removeAttribute(PASS_ATTR);
  };
}

export interface ClipboardListener {
  reset(): void;
  value(): string | null;
  dispose(): void;
}

export function createClipboardListener(): ClipboardListener {
  let last: string | null = null;
  const handler = (e: Event) => {
    last = String((e as CustomEvent).detail ?? '');
  };
  document.addEventListener(CLIPBOARD_EVENT, handler);
  return {
    reset: () => {
      last = null;
    },
    value: () => last,
    dispose: () => document.removeEventListener(CLIPBOARD_EVENT, handler),
  };
}
