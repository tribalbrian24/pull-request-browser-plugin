import { describe, expect, it } from 'vitest';
import { scopeSig, snapshotKey, snapshotPrefix } from './scope';

const base = { includeResolved: false, includeReviews: true, excluded: [] as string[] };

describe('capture scope', () => {
  it('is the same for the same settings regardless of agent order', () => {
    expect(scopeSig({ ...base, excluded: ['claude', 'codex'] })).toBe(scopeSig({ ...base, excluded: ['codex', 'claude'] }));
  });
  it('differs whenever a setting that changes the contents differs', () => {
    const sigs = new Set([
      scopeSig(base),
      scopeSig({ ...base, includeResolved: true }),
      scopeSig({ ...base, includeReviews: false }),
      scopeSig({ ...base, excluded: ['copilot'] }),
    ]);
    expect(sigs.size).toBe(4);
  });
  it('builds a key under the PR prefix so every setting variant can be found and forgotten together', () => {
    const key = snapshotKey('o/r#7', base);
    expect(key.startsWith(snapshotPrefix('o/r#7'))).toBe(true);
    expect(key.startsWith(snapshotPrefix('o/r#70'))).toBe(false);
    expect(snapshotKey('o/r#7', base)).toBe(key);
    expect(snapshotKey('o/r#7', { ...base, includeResolved: true })).not.toBe(key);
  });
});
