import { HOOK_ATTR } from '../clipboard';
import { threadRangeDetail } from '../capture/thread';
import { worstSeverity, type Issue } from '../capture/validate';
import { isLocatorKey, type LocatorKey } from '../locators/defaults';
import type { LocatorRegistry } from '../locators/registry';

export type PageKind = 'conversation' | 'files' | 'commits' | 'other';
export type Status = 'ok' | 'warn' | 'fail' | 'skip';

export interface DoctorCheck {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

export interface DoctorReport {
  at: number;
  page: PageKind;
  level: 'ok' | 'warn' | 'error';
  checks: DoctorCheck[];
  lastCapture: Issue[] | null;
  /** How many times the checks were re-run because the page might still have been loading. */
  retries?: number;
}

export interface DoctorOpts {
  doc?: Document;
  pathname?: string;
  lastCapture?: Issue[] | null;
}

const CHECK_KEYS: Record<string, LocatorKey[]> = {
  'comment.menu': ['comment.menu.react', 'comment.menu.details'],
  'thread.range': ['thread.rangeHeader'],
  suggestion: ['suggestion.block'],
};

export function keysForCheck(check: Pick<DoctorCheck, 'id' | 'status'>): LocatorKey[] {
  if (check.status !== 'fail' && check.status !== 'warn') return [];
  if (isLocatorKey(check.id)) return [check.id];
  return CHECK_KEYS[check.id] ?? [];
}

export function pageKind(pathname: string): PageKind {
  if (/^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)\b/.test(pathname)) return 'files';
  if (/^\/[^/]+\/[^/]+\/pull\/\d+\/commits\b/.test(pathname)) return 'commits';
  if (/^\/[^/]+\/[^/]+\/pull\/\d+/.test(pathname)) return 'conversation';
  return 'other';
}

export function runDoctor(reg: LocatorRegistry, opts: DoctorOpts = {}): DoctorReport {
  const doc = opts.doc ?? document;
  const page = pageKind(opts.pathname ?? location.pathname);
  const lastCapture = opts.lastCapture ?? null;
  const checks: DoctorCheck[] = [];
  const add = (id: string, label: string, status: Status, detail: string) => checks.push({ id, label, status, detail });

  const finish = (): DoctorReport => {
    const worstCapture = worstSeverity(lastCapture ?? []);
    const level = checks.some(c => c.status === 'fail') || worstCapture === 'error'
      ? 'error'
      : checks.some(c => c.status === 'warn') || worstCapture === 'warn'
        ? 'warn'
        : 'ok';
    return { at: Date.now(), page, level, checks, lastCapture };
  };

  if (page === 'other') {
    add('page', 'Page', 'skip', 'Not a pull request page');
    return finish();
  }

  const hook = doc.documentElement.hasAttribute(HOOK_ATTR);
  add('hook', 'Clipboard hook', hook ? 'ok' : 'fail', hook ? 'installed' : 'not installed: Copy Markdown capture will not work. Reload the page.');

  const check = (key: LocatorKey, label: string, root: ParentNode, miss: 'fail' | 'warn') => {
    const r = reg.resolve(key, root, { track: false });
    if (!r.elements.length) {
      add(key, label, miss, `no match for "${key}"`);
    } else if (reg.getOverrides()[key] && r.source === 'default') {
      add(key, label, 'warn', `your override matched nothing; using the default (${r.elements.length})`);
    } else {
      add(key, label, 'ok', `${r.elements.length} via ${r.source}`);
    }
    return r.elements;
  };

  if (page === 'files') {
    add('thread.all', 'Review threads', 'skip', 'not checked on this tab: inline threads here use different markup. Capture reads them from the Conversation tab.');
  } else {
  const threads = reg.all('thread.all', doc, { track: false });
  if (!threads.length) {
    const hasReviews = reg.all('review.box', doc, { track: false }).length > 0;
    add('thread.all', 'Review threads', hasReviews ? 'skip' : 'warn',
      hasReviews ? 'no inline threads, but review summaries were found' : 'none found. If you expected review comments here, "thread.all" may have drifted.');
  } else {
    add('thread.all', 'Review threads', 'ok', `${threads.length} found`);
    const expanded = (t: Element) => reg.first('thread.chevron', t, { track: false })?.getAttribute('aria-expanded') !== 'false';
    const menuIn = (t: Element) =>
      reg.first('comment.menu.react', t, { track: false }) ?? reg.first('comment.menu.details', t, { track: false });
    const sample = threads.find(menuIn) ?? threads.find(expanded) ?? threads[0];
    const collapsed = !expanded(sample);

    check('thread.path', 'File path link', sample, 'fail');
    check('thread.chevron', 'Expand/collapse toggle', sample, 'warn');

    const react = reg.resolve('comment.menu.react', sample, { track: false });
    const details = reg.resolve('comment.menu.details', sample, { track: false });
    const trigger = react.elements[0] ?? details.elements[0];
    if (!trigger) {
      add('comment.menu', 'Comment menu button', collapsed ? 'warn' : 'fail',
        collapsed
          ? 'every thread on the page is collapsed, so the buttons are not in the page yet. Expand one thread (or run Capture) and the Doctor will re-check.'
          : 'no match for "comment.menu.react" or "comment.menu.details"');
    } else {
      const found = [
        react.elements.length && `Copilot/React via ${react.source}`,
        details.elements.length && `human/legacy via ${details.source}`,
      ].filter(Boolean);
      add('comment.menu', 'Comment menu button', 'ok', found.join(' + '));
      const container = reg.closest('comment.container', trigger);
      add('comment.container', 'Comment container', container ? 'ok' : 'fail', container ? 'found' : 'no match for "comment.container"');
      if (container) {
        check('comment.author', 'Comment author', container, 'warn');
        check('comment.body', 'Comment text (used if Copy Markdown fails)', container, 'warn');
      }
    }

    const rd = threadRangeDetail(reg, sample);
    const ignored = rd.overrideMatched > 0 && rd.via !== 'override';
    const where = { override: 'from your selector', label: 'from the "Comment on lines" label', preview: "from the thread's code preview", link: 'from the file link', '': '' }[rd.via];
    add(
      'thread.range',
      'Line range',
      rd.range && !ignored ? 'ok' : 'warn',
      rd.range
        ? `${rd.range} (${where})${ignored ? `. Your saved selector for "thread.rangeHeader" matches ${rd.overrideMatched} element(s) but none holds a line range, so it was ignored. Reset it in the DevTools sidebar if it was a mistake.` : ''}`
        : 'could not read a line range from the sample thread',
    );

    const withSuggestion = threads.find(t => reg.all('suggestion.block', t, { track: false }).length);
    if (!withSuggestion) {
      const collapsedCount = threads.filter(t => !expanded(t)).length;
      add(
        'suggestion',
        'Suggestions',
        'skip',
        collapsedCount
          ? `not checked: none is loaded yet. ${collapsedCount} collapsed or resolved thread(s) only build their suggestions when opened, so this cannot be checked until one is expanded (or after Capture).`
          : 'none on this page',
      );
    } else {
      const block = reg.first('suggestion.block', withSuggestion, { track: false })!;
      check('suggestion.table', 'Suggestion table', block, 'fail');
      check('suggestion.marker', 'Suggestion +/- marker', block, 'warn');
    }
  }
  }

  if (page === 'conversation') {
    const boxes = reg.all('review.box', doc, { track: false });
    if (!boxes.length) {
      add('review.box', 'Review summaries', 'skip', 'none on this page');
    } else {
      add('review.box', 'Review summaries', 'ok', `${boxes.length} found`);
      check('comment.author', 'Review author', boxes[0], 'warn');
      check('comment.body', 'Review body', boxes[0], 'warn');
    }
  }

  if (page === 'files') {
    const rows = reg.all('files.row', doc, { deep: false, track: false });
    const tree = reg.first('tree.root', doc, { deep: false, track: false });
    add('tree.root', 'File tree', tree ? 'ok' : 'skip', tree ? `${reg.all('tree.item', tree, { deep: false, track: false }).length} entries` : 'not shown on this page (when it is closed, filters cannot hide entries in it)');
    add('files.row', 'Files list rows', rows.length ? 'ok' : 'warn', rows.length ? `${rows.length} rendered` : 'no "files.row" matches (virtualized list not found)');
    if (rows.length) {
      const first = rows[0];
      check('files.path', 'File header path', first, 'fail');
      const hunks = rows.filter(r => reg.first('files.hunk', r, { track: false })).length;
      add('files.hunk', 'Hunk headers', hunks ? 'ok' : 'warn', hunks ? `${hunks} of ${rows.length} rows (the rest may be collapsed or not loaded)` : 'none found: file status filters cannot tell new/deleted/edited apart');
    }
  }

  if (page === 'files') {
    const picker = reg.first('commits.button', doc, { track: false });
    add('commits.button', 'Commit range picker', picker ? 'ok' : 'warn', picker ? 'found' : 'no match for "commits.button" (commit list and head SHA lookup will not work)');
  }

  const saved = Object.keys(reg.getOverrides());
  if (saved.length) {
    const unmatched = saved.filter(k => isLocatorKey(k) && !reg.resolve(k, doc, { track: false }).elements.length);
    const problems = checks.some(c => c.status === 'fail' || c.status === 'warn');
    add(
      'overrides',
      'Your saved selectors',
      unmatched.length || problems ? 'warn' : 'ok',
      `${saved.length} saved: ${saved.join(', ')}.${unmatched.length ? ` These match nothing on this page: ${unmatched.join(', ')}.` : ''}${problems ? ' A wrong saved selector is the most common cause of the problems above. Reset the ones you are unsure about in the DevTools sidebar, or use Clear in the popup\'s Locators tab.' : ''}`,
    );
  }

  const more = reg.all('load.more', doc, { deep: false, track: false });
  add('load.more', 'Load more buttons', 'ok', more.length ? `${more.length} present` : 'none (everything loaded)');

  return finish();
}
