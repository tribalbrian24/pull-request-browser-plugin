import type { FileStatus } from './files';

export interface Filter {
  id: string;
  label: string;
  hint?: string;
  mode: 'show-only' | 'hide';
  statuses?: FileStatus[];
  list?: { id: string; in: boolean };
}

export const PRESETS: Filter[] = [
  { id: 'tests-removed', label: 'Tests removed', hint: 'Show only test files that were deleted in this PR. Everything else is hidden.', mode: 'show-only', statuses: ['deleted'], list: { id: 'tests', in: true } },
  { id: 'hide-tests', label: 'Hide tests', hint: 'Hide test files (spec, test, __tests__, mocks) so you can review the real code.', mode: 'hide', list: { id: 'tests', in: true } },
  { id: 'only-tests', label: 'Only tests', hint: 'Show only test files. Everything else is hidden.', mode: 'show-only', list: { id: 'tests', in: true } },
  { id: 'only-snapshots', label: 'Only snapshots', hint: 'Show only snapshot files (__snapshots__, .snap and any stack packs you enabled).', mode: 'show-only', list: { id: 'snapshots', in: true } },
  { id: 'hide-snapshots', label: 'Hide snapshots', hint: 'Hide snapshot files, which are usually noisy to review.', mode: 'hide', list: { id: 'snapshots', in: true } },
  { id: 'hide-generated', label: 'Hide generated', hint: 'Hide generated files: lockfiles, build output, minified files and source maps.', mode: 'hide', list: { id: 'generated', in: true } },
  { id: 'hide-images', label: 'Hide images / SVG', hint: 'Hide image files, including SVG (png, jpg, gif, webp, svg and similar).', mode: 'hide', list: { id: 'images', in: true } },
  { id: 'hide-binary', label: 'Hide binary files', hint: 'Hide binary files: images, fonts, archives, PDFs, audio and video, plus any file GitHub says is binary.', mode: 'hide', list: { id: 'binary', in: true } },
  { id: 'only-new', label: 'Only new', hint: 'Show only files added in this PR.', mode: 'show-only', statuses: ['added'] },
  { id: 'only-deleted', label: 'Only deleted', hint: 'Show only files deleted in this PR.', mode: 'show-only', statuses: ['deleted'] },
  { id: 'only-edited', label: 'Only edited', hint: 'Show only files that were changed (including renamed files that were also edited).', mode: 'show-only', statuses: ['modified', 'renamed-modified'] },
  { id: 'only-renamed', label: 'Only renamed', hint: 'Show only files that were renamed or moved.', mode: 'show-only', statuses: ['renamed', 'renamed-modified'] },
];

/** Files whose status could not be read are never hidden by a status filter. */
export function decide(f: Filter, status: FileStatus, inList: (listId: string) => boolean): 'hide' | 'keep' {
  if (f.statuses && status === 'unknown') return 'keep';
  const statusOk = !f.statuses || f.statuses.includes(status);
  const listOk = !f.list || inList(f.list.id) === f.list.in;
  const match = statusOk && listOk;
  return (f.mode === 'show-only') === match ? 'keep' : 'hide';
}
