export const digest = (n: number) => n.toString(16).padStart(64, '0');

export function row(n: number, path: string, hunk: string | null, oldPath?: string) {
  const code = oldPath
    ? `<span aria-hidden="true">\u200e${oldPath}\u200e → \u200e…/${path.split('/').pop()}\u200e</span><span class="sr-only">${oldPath} renamed to ${path} </span>`
    : `<span aria-hidden="true">\u200e${path}\u200e</span>`;
  const hunkRow = hunk
    ? `<table><tbody><tr><td data-diff-cell="hunk"><div><code><div data-diff-text-inner="true">${hunk}</div></code></div></td></tr></tbody></table>`
    : '';
  return `<div class="virtualizedDiffRow__x" data-index="${n}" data-path-digest="${digest(n)}"><div><h3><a href="#d"><code>${code}</code></a></h3>${hunkRow}</div></div>`;
}

/** Newer Files changed layout: no data-path-digest or data-index; the section's id is "diff-<digest>". */
export function rowNew(n: number, path: string, hunk: string | null, oldPath?: string) {
  return row(n, path, hunk, oldPath).replace(/ data-index="\d+" data-path-digest="[0-9a-f]+"/, ` id="diff-${digest(n)}" role="region"`);
}

