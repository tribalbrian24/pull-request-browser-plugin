import type { LocatorRegistry } from './locators/registry';

export function probeFilesList(reg: LocatorRegistry): string {
  const rows = reg.all('files.row', document, { deep: false }).map(r => {
    const el = r as HTMLElement;
    return {
      index: el.dataset.index !== undefined ? Number(el.dataset.index) : null,
      top: parseFloat(el.style.top) || 0,
      height: Math.round(el.getBoundingClientRect().height),
      estimatedHeight: Number(el.firstElementChild?.getAttribute('data-estimated-height')) || null,
      digest: (el.dataset.pathDigest || el.id.replace(/^diff-/, '')).slice(0, 8),
    };
  });
  const indices = rows.map(r => r.index).filter((i): i is number => i !== null);
  return JSON.stringify(
    {
      rows: rows.length,
      minIndex: indices.length ? Math.min(...indices) : null,
      maxIndex: indices.length ? Math.max(...indices) : null,
      scrollHeight: document.documentElement.scrollHeight,
      items: rows,
    },
    null,
    2,
  );
}
