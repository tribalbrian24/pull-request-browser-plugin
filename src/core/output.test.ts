import { afterEach, describe, expect, it } from 'vitest';
import { ensureClipboardWrite } from './output';

const setNav = (permState: string | 'throws', writeOk: boolean) => {
  Object.defineProperty(navigator, 'permissions', {
    value: { query: async () => { if (permState === 'throws') throw new Error('unknown permission'); return { state: permState }; } },
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { if (!writeOk) throw new Error('blocked'); } },
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });
});

describe('ensureClipboardWrite', () => {
  it('trusts an existing grant or denial without writing', async () => {
    setNav('granted', false);
    expect(await ensureClipboardWrite()).toBe('granted');
    setNav('denied', true);
    expect(await ensureClipboardWrite()).toBe('denied');
  });
  it('triggers the browser prompt with a write when the state is "prompt"', async () => {
    setNav('prompt', true);
    expect(await ensureClipboardWrite()).toBe('granted');
    setNav('prompt', false);
    expect(await ensureClipboardWrite()).toBe('denied');
  });
  it('falls back to a plain write when the browser does not know the permission', async () => {
    setNav('throws', true);
    expect(await ensureClipboardWrite()).toBe('granted');
    setNav('throws', false);
    expect(await ensureClipboardWrite()).toBe('denied');
  });
});
