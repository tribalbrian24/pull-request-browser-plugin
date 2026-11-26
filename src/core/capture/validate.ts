import type { CaptureResult, CapturedThread } from './types';

export type Severity = 'error' | 'warn' | 'info';

export interface Issue {
  severity: Severity;
  message: string;
}

const MAX_PER_KIND = 8;
const label = (t: CapturedThread) => `${t.path}${t.range ? `:${t.range}` : ''}`;

function capped(severity: Severity, messages: string[]): Issue[] {
  const shown = messages.slice(0, MAX_PER_KIND).map(message => ({ severity, message }));
  if (messages.length > MAX_PER_KIND) shown.push({ severity, message: `+${messages.length - MAX_PER_KIND} more` });
  return shown;
}

export function validateCapture({ threads, expected, skipped, excluded, resolvedSkipped, aborted }: CaptureResult): Issue[] {
  const leftOut = `${resolvedSkipped} resolved thread(s) left out. Tick "Include resolved threads" to capture them.`;
  if (expected === 0 && resolvedSkipped > 0) return [{ severity: 'warn', message: leftOut }];
  if (expected === 0) {
    return [
      {
        severity: 'error',
        message:
          'No review threads found. Are you on the Conversation or Files changed tab? The "thread.all" locator may have drifted.',
      },
    ];
  }

  const errors: string[] = [];
  const warns: string[] = [];
  if (aborted) warns.push(`Capture was stopped early: ${threads.length + excluded} of ${expected} item(s) were read.`);
  if (skipped) errors.push(`${skipped} of ${expected} thread(s) skipped: no file path found (locator "thread.path")`);

  let fromHtml = 0;
  const why = new Set<string>();
  for (const t of threads) {
    for (const c of t.comments) {
      if (!c.text) errors.push(`${label(t)}: ${c.reason}`);
      else if (c.text.trim().length < 2) warns.push(`${label(t)}: comment text is empty`);
      if (c.via === 'rendered HTML') {
        fromHtml++;
        if (c.reason) why.add(c.reason);
      }
    }
    if (!t.range && t.kind !== 'review') warns.push(`${t.path}: no line range found`);
    if (t.suggestionBlocks > 0 && t.suggestionLines.length === 0) {
      warns.push(`${label(t)}: suggestion present but no lines parsed (locators "suggestion.table" / "suggestion.marker")`);
    }
    if (t.suggestionLines.some(l => !/^\d+ /.test(l))) warns.push(`${label(t)}: suggestion line without a line number`);
  }

  const issues = [...capped('error', errors), ...capped('warn', warns)];
  if (fromHtml) {
    const because = why.size ? `. The menu said: ${Array.from(why).join('; ')}` : '';
    issues.push({ severity: 'info', message: `${fromHtml} comment(s) came from rendered HTML (less exact than Copy Markdown)${because}` });
  }
  if (resolvedSkipped) {
    const inline = threads.filter(t => t.kind !== 'review').length;
    issues.push({ severity: inline === 0 ? 'warn' : 'info', message: leftOut });
  }
  if (excluded) issues.push({ severity: 'info', message: `${excluded} thread(s) left out by the agent filter` });
  return issues;
}

export function worstSeverity(issues: Issue[]): Severity | null {
  if (issues.some(i => i.severity === 'error')) return 'error';
  if (issues.some(i => i.severity === 'warn')) return 'warn';
  return issues.length ? 'info' : null;
}
