import { afterEach, describe, expect, it } from 'vitest';
import { ARM_ATTR, CLIPBOARD_EVENT, HOOK_ATTR, PASS_ATTR, armClipboard } from './clipboard';
import { installClipboardHook } from './clipboardHook';

const heard: string[] = [];
const listener = (e: Event) => heard.push((e as CustomEvent).detail);

afterEach(() => {
  heard.length = 0;
});

describe('installClipboardHook', () => {
  it('reports what the page copies while armed and swallows the real write; passes everything through when not armed', async () => {
    const calls: string[] = [];
    const fakeClipboard = {
      writeText: async (t: string) => void calls.push(`writeText:${t}`),
      write: async () => void calls.push('write'),
    };
    Object.defineProperty(navigator, 'clipboard', { value: fakeClipboard, configurable: true });
    const realExec = (document as any).execCommand;
    (document as any).execCommand = (c: string) => (calls.push(`exec:${c}`), true);

    document.addEventListener(CLIPBOARD_EVENT, listener);
    installClipboardHook();
    expect(document.documentElement.hasAttribute(HOOK_ATTR)).toBe(true);

    await navigator.clipboard.writeText('before');
    document.execCommand('copy');
    expect(calls).toEqual(['writeText:before', 'exec:copy']);
    expect(heard).toEqual([]);

    calls.length = 0;
    const disarm = armClipboard();
    await navigator.clipboard.writeText('captured text');
    expect(heard).toEqual(['captured text']);
    expect(calls).toEqual([]);

    const ta = document.createElement('textarea');
    ta.value = 'from textarea';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    expect(document.execCommand('copy')).toBe(true);
    expect(heard).toContain('from textarea');
    expect(calls).toEqual([]);

    await (navigator.clipboard as any).write([]);
    expect(calls).toEqual([]);

    if (typeof DataTransfer !== 'undefined') {
      new DataTransfer().setData('text/plain', 'from setData');
      expect(heard).toContain('from setData');
    }

    disarm();
    await navigator.clipboard.writeText('after');
    expect(calls).toEqual(['writeText:after']);

    document.removeEventListener(CLIPBOARD_EVENT, listener);
    if (realExec) (document as any).execCommand = realExec;
  });

  it('in passthrough mode still reports the text but lets the page copy for real', async () => {
    const calls: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (t: string) => void calls.push(`writeText:${t}`), write: async () => void calls.push('write') },
      configurable: true,
    });
    document.addEventListener(CLIPBOARD_EVENT, listener);
    installClipboardHook();
    const disarm = armClipboard({ passthrough: true });
    expect(document.documentElement.hasAttribute(PASS_ATTR)).toBe(true);
    await navigator.clipboard.writeText('both');
    expect(heard).toEqual(['both']);
    expect(calls).toEqual(['writeText:both']);
    disarm();
    expect(document.documentElement.hasAttribute(PASS_ATTR)).toBe(false);
    expect(document.documentElement.hasAttribute(ARM_ATTR)).toBe(false);
    document.removeEventListener(CLIPBOARD_EVENT, listener);
  });
});
