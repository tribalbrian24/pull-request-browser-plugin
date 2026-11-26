import { describe, expect, it } from 'vitest';
import { isPrPath, prKey, prSlug, repoOf } from './pr';

describe('pr helpers', () => {
  it('detects PR paths', () => {
    expect(isPrPath('/acme/widgets/pull/12')).toBe(true);
    expect(isPrPath('/acme/widgets/pull/12/files')).toBe(true);
    expect(isPrPath('/acme/widgets/pulls')).toBe(false);
    expect(isPrPath('/acme/widgets')).toBe(false);
  });
  it('builds a filename slug', () => {
    expect(prSlug('/acme/widgets/pull/12/files')).toBe('acme-widgets-12');
    expect(prSlug('/x')).toBe('pr');
  });
  it('extracts org/repo', () => {
    expect(repoOf('/acme/widgets/pull/12/files')).toBe('acme/widgets');
    expect(repoOf('/x')).toBe('');
    expect(prKey('/o/r/pull/7/files')).toBe('o/r#7');
    expect(prKey('/o')).toBe('');
  });
});
