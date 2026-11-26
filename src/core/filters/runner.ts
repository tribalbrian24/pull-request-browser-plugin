import type { LocatorRegistry } from '../locators/registry';
import { readFileEntries, type FileEntry, type FileStatus } from './files';
import type { HideController } from './hide';
import { inList, type Layer } from './lists';
import { decide, type Filter } from './presets';
import { computeTreeHidden } from './tree';

export interface RunnerDeps {
  reg: LocatorRegistry;
  getLayers: () => Layer[];
  repo: () => string;
  hide: HideController;
}

export interface Stats {
  rendered: number;
  hidden: number;
  undetermined: number;
  byStatus: Record<FileStatus, number>;
}

const emptyCounts = (): Record<FileStatus, number> => ({
  added: 0,
  deleted: 0,
  modified: 0,
  renamed: 0,
  'renamed-modified': 0,
  unknown: 0,
});

export class FilterRunner {
  private filter: Filter | null = null;
  private decisions = new Map<string, 'hide' | 'keep'>();
  private pathDecisions = new Map<string, 'hide' | 'keep'>();
  private entries: FileEntry[] = [];
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private deps: RunnerDeps) {}

  get active() {
    return this.filter;
  }

  start(filter: Filter) {
    this.filter = filter;
    this.decisions.clear();
    this.pathDecisions.clear();
    this.refresh();
    this.observer ??= new MutationObserver(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refresh(), 150);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop() {
    this.filter = null;
    this.decisions.clear();
    this.pathDecisions.clear();
    this.entries = [];
    this.observer?.disconnect();
    clearTimeout(this.timer);
    this.deps.hide.clear();
  }

  /** Decisions are remembered per digest, so rows virtualized out of the DOM stay hidden without re-reading anything. */
  refresh() {
    const f = this.filter;
    if (!f) return;
    const layers = this.deps.getLayers();
    const repo = this.deps.repo();
    this.entries = readFileEntries(this.deps.reg);
    for (const e of this.entries) {
      const member = (listId: string) =>
        (listId === 'binary' && e.binary) ||
        inList(layers, listId, repo, e.path) ||
        (!!e.oldPath && inList(layers, listId, repo, e.oldPath));
      const d = decide(f, e.status, member);
      this.decisions.set(e.digest, d);
      this.pathDecisions.set(e.path, d);
      if (e.oldPath) this.pathDecisions.set(e.oldPath, d);
    }
    this.deps.hide.set(Array.from(this.decisions).filter(([, v]) => v === 'hide').map(([k]) => k));
    this.deps.hide.setTree(computeTreeHidden(this.deps.reg, f, (listId, path) => inList(layers, listId, repo, path), this.pathDecisions));
  }

  stats(): Stats {
    const byStatus = emptyCounts();
    for (const e of this.entries) byStatus[e.status]++;
    return {
      rendered: this.entries.length,
      hidden: this.deps.hide.size,
      undetermined: byStatus.unknown,
      byStatus,
    };
  }
}
