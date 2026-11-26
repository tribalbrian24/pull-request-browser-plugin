import { storage } from '#imports';
import { prune, type Snapshot } from './delta';

const item = storage.defineItem<Record<string, Snapshot>>('local:snapshots', { fallback: {} });

export const getSnapshot = async (key: string): Promise<Snapshot | null> => (await item.getValue())[key] ?? null;

export async function saveSnapshot(key: string, snap: Snapshot) {
  await item.setValue(prune({ ...(await item.getValue()), [key]: snap }));
}

export async function forgetSnapshotsFor(prefix: string) {
  const all = { ...(await item.getValue()) };
  for (const k of Object.keys(all)) if (k.startsWith(prefix)) delete all[k];
  await item.setValue(all);
}
