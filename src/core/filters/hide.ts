const DIGEST = /^[0-9a-f]{8,64}$/i;

/** Hides file rows with one injected stylesheet keyed by data-path-digest. GitHub's DOM is never mutated. */
export class HideController {
  private style: HTMLStyleElement | null = null;
  private digests = new Set<string>();
  private treePaths = new Set<string>();

  set(digests: Iterable<string>) {
    this.digests = new Set(Array.from(digests).filter(d => DIGEST.test(d)));
    this.render();
  }

  /** File tree entries (li[role=treeitem], whose id is the file or folder path). */
  setTree(paths: Iterable<string>) {
    this.treePaths = new Set(paths);
    this.render();
  }

  clear() {
    this.digests.clear();
    this.treePaths.clear();
    this.render();
  }

  get treeSize() {
    return this.treePaths.size;
  }

  get size() {
    return this.digests.size;
  }

  has(digest: string) {
    return this.digests.has(digest);
  }

  private render() {
    if (!this.digests.size && !this.treePaths.size) {
      this.style?.remove();
      this.style = null;
      return;
    }
    if (!this.style) {
      this.style = document.createElement('style');
      this.style.setAttribute('data-prc-hide', '');
      document.head.appendChild(this.style);
    }
    const esc = (p: string) => p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const rows = Array.from(this.digests).map(d => `[data-path-digest="${d}"][data-index],#diff-${d}{display:none !important}`);
    const tree = Array.from(this.treePaths).map(p => `li[role="treeitem"][id="${esc(p)}"]{display:none !important}`);
    this.style.textContent = [...rows, ...tree].join('\n');
  }
}
