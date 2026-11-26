interface Area {
  clear(): Promise<void>;
}

export interface StorageApi {
  local: Area;
  session?: Area;
}

/** Wipes everything the extension remembers: saved selectors, file patterns, agent settings, remembered captures, cached Doctor results. */
export async function resetExtensionMemory(storage: StorageApi): Promise<void> {
  await storage.local.clear();
  await storage.session?.clear();
}
