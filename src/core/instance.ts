import { LocatorRegistry } from './locators/registry';
import { locatorOverrides } from './storage';

export const registry = new LocatorRegistry();

void locatorOverrides.getValue().then(v => registry.setOverrides(v));
locatorOverrides.watch(v => registry.setOverrides(v));
