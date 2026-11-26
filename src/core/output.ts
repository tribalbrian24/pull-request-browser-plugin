export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ClipboardAccess = 'granted' | 'denied';

/**
 * Asks the browser for clipboard write permission up front. Call it first thing in a click handler so the browser's
 * one-time allow/block prompt appears at a predictable moment, before any scan starts.
 */
export async function ensureClipboardWrite(): Promise<ClipboardAccess> {
  try {
    const status = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
  } catch {
    /* some browsers do not know this permission name: fall through and try a write */
  }
  try {
    await navigator.clipboard.writeText(' ');
    return 'granted';
  } catch {
    return 'denied';
  }
}
