import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCATORS } from './defaults';

describe('DEFAULT_LOCATORS', () => {
  it('explains every key in plain words, for the inspector tooltips', () => {
    for (const [key, def] of Object.entries(DEFAULT_LOCATORS)) {
      expect(def.description.length > 10).toBe(true);
      expect(def.pick.length > 20).toBe(true);
      expect(def.selectors.length > 0).toBe(true);
      expect(key.length > 0).toBe(true);
    }
  });
});
