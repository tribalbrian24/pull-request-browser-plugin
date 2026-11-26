import { storage } from '#imports';
import type { AgentPrefs } from './agents/agents';
import { DEFAULT_PREFS } from './agents/agents';
import type { Layer } from './filters/lists';
import type { LocatorOverride } from './locators/types';

export const locatorOverrides = storage.defineItem<Record<string, LocatorOverride>>('local:locatorOverrides', {
  fallback: {},
});

export const filterLayers = storage.defineItem<Layer[]>('local:filterLayers', { fallback: [] });

export const agentPrefs = storage.defineItem<AgentPrefs>('local:agentPrefs', { fallback: DEFAULT_PREFS });
