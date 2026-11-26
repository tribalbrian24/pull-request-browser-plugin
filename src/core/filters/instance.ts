import { registry } from '../instance';
import { prSlug, repoOf } from '../pr';
import { filterLayers } from '../storage';
import { HideController } from './hide';
import { BUILTIN_LAYER, type Layer } from './lists';
import { FilterRunner } from './runner';

export const hide = new HideController();
export const tempLayer: Layer = { id: 'temp', label: 'Temporary', kind: 'temp', lists: {} };

let userLayers: Layer[] = [];
export const getUserLayers = () => userLayers;
export const getLayers = () => [BUILTIN_LAYER, ...userLayers, tempLayer];
export const currentRepo = () => repoOf(location.pathname);

export const runner = new FilterRunner({ reg: registry, getLayers, repo: currentRepo, hide });

void filterLayers.getValue().then(v => {
  userLayers = v;
});
filterLayers.watch(v => {
  userLayers = v;
  runner.refresh();
});

export async function saveUserLayers(next: Layer[]) {
  userLayers = next;
  await filterLayers.setValue(next);
  runner.refresh();
}

let slug = '';
/** Temporary layers and active filters belong to one PR: drop them when the PR changes. */
export function onNavigate(pathname: string) {
  const next = prSlug(pathname);
  if (next === slug) return;
  slug = next;
  runner.stop();
  tempLayer.lists = {};
}
