import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { Button } from '@/components/ui/button';
import type { PageMsg, Reply } from '@/core/bridge/messages';
import type { DoctorReport, Status } from '@/core/doctor/checks';
import { copyText } from '@/core/output';
import { cn } from '@/lib/utils';

const GLYPH: Record<Status, string> = { ok: '✓', warn: '!', fail: '✗', skip: '–' };
const TONE: Record<Status, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  fail: 'text-destructive',
  skip: 'text-muted-foreground',
};
const HEADLINE = { ok: 'All checks passed', warn: 'Needs attention', error: 'Problems found' } as const;
const DOT = { ok: 'bg-emerald-500', warn: 'bg-amber-500', error: 'bg-red-500' } as const;

export function DoctorPane() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id == null) throw new Error('No active tab');
      try {
        const reply = (await browser.tabs.sendMessage(tab.id, { type: 'doctor:run' } satisfies PageMsg)) as Reply | undefined;
        if (reply?.report) return setReport(reply.report);
      } catch {
        /* no content script on this tab */
      }
      const cached = await storage.getItem<DoctorReport>(`session:doctor:${tab.id}`);
      if (cached) setReport(cached);
      else setError('Open a GitHub pull request in this tab, then reopen the popup.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-2">
      {report && (
        <div
          className="flex items-center gap-2"
          title="The Doctor checks that the extension can still find everything it needs on this GitHub page. Hover any line for details."
        >
          <span className={cn('inline-block h-2.5 w-2.5 rounded-full', DOT[report.level])} />
          <span className="font-semibold">{HEADLINE[report.level]}</span>
          <span className="text-muted-foreground">({report.page})</span>
        </div>
      )}
      {report?.retries ? (
        <p
          className="text-[10px] text-muted-foreground"
          title="The Doctor re-checks with growing pauses (up to 5 times) because GitHub loads parts of the page lazily. Red only stays if the selectors keep failing."
        >
          {report.level === 'ok'
            ? `Passed after ${report.retries} re-check(s): the page was still loading.`
            : `Re-checked ${report.retries} time(s) with growing pauses and these results did not change.`}
        </p>
      ) : null}
      {error && <p className="text-muted-foreground">{error}</p>}
      {report && (
        <ul className="space-y-1">
          {report.checks.map(c => (
            <li key={c.id} className="flex gap-2" title={`${c.label}: ${c.detail}\n\n✓ works   ! needs attention   ✗ broken   – nothing to check on this page`}>
              <span className={cn('w-3 shrink-0 text-center font-bold', TONE[c.status])}>{GLYPH[c.status]}</span>
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="block break-words text-[10px] text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {report?.lastCapture && report.lastCapture.length > 0 && (
        <div className="space-y-1 rounded-md border p-2" title="What the self-check said about your most recent capture on this page.">
          <p className="font-medium">Last capture</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[10px]">
            {report.lastCapture.map((i, n) => (
              <li key={n} className={i.severity === 'error' ? 'text-destructive' : i.severity === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} title="Check this page again" onClick={load}>
          {busy ? 'Checking…' : 'Run again'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          title="Copies the page's structure (no comment text) so it can be pasted into a bug report or to Claude"
          onClick={async () => {
            try {
              const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
              const reply = (await browser.tabs.sendMessage(tab.id!, { type: 'diagnostics:run' } satisfies PageMsg)) as Reply | undefined;
              setNote(reply?.text && (await copyText(reply.text)) ? 'Diagnostics copied. Paste them in the chat.' : 'Could not read the page. Open a PR tab first.');
            } catch {
              setNote('Could not read the page. Open a PR tab first.');
            }
          }}
        >
          Copy diagnostics
        </Button>
      </div>
      {note && <p className="text-[10px]">{note}</p>}
    </section>
  );
}
