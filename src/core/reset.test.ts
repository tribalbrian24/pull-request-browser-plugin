import { describe, expect, it } from 'vitest';
import { resetExtensionMemory } from './reset';

describe('resetExtensionMemory', () => {
  it('clears both the saved data and the per-tab cache', async () => {
    const cleared: string[] = [];
    await resetExtensionMemory({
      local: { clear: async () => void cleared.push('local') },
      session: { clear: async () => void cleared.push('session') },
    });
    expect(cleared).toEqual(['local', 'session']);
  });
  it('works when there is no session area', async () => {
    let local = false;
    await resetExtensionMemory({ local: { clear: async () => void (local = true) } });
    expect(local).toBe(true);
  });
});
