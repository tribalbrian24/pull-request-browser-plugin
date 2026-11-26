export interface LocatorDef {
  description: string;
  /** What to select in the Elements panel to repair this locator, in plain words. */
  pick: string;
  selectors: string[];
  shadowPath?: string[];
  text?: string;
}

export interface LocatorOverride {
  selectors: string[];
  shadowPath?: string[];
  replaceDefaults?: boolean;
}

export type Source = 'override' | 'default' | 'none';

export interface Resolution {
  elements: Element[];
  matched: string | null;
  source: Source;
}
