import { useEffect, useRef, useState } from 'react';
import { effectiveAgents, normalizePrefs, resolveLabel, type AgentPrefs } from '@/core/agents/agents';
import { Button } from '@/components/ui/button';
import { captureThreads } from '@/core/capture/capture';
import { applyDelta, computeDelta, formatTime, snapshotOf, type Delta, type DeltaMode } from '@/core/capture/delta';
import { clearMarks, markThreads } from '@/core/capture/marks';
import { renderMarkdown } from '@/core/capture/markdown';
import { scanPageComments } from '@/core/capture/scan';
import { scopeSig, snapshotKey, snapshotPrefix, type CaptureScope } from '@/core/capture/scope';
import { forgetSnapshotsFor, getSnapshot, saveSnapshot } from '@/core/capture/snapshots';
import type { CaptureResult } from '@/core/capture/types';
import { validateCapture, worstSeverity, type Issue } from '@/core/capture/validate';
import { reportDoctor } from '@/core/doctor/report';
import { setLastCapture } from '@/core/doctor/state';
import { registry } from '@/core/instance';
import { clickAllLoadMore } from '@/core/loadMore';
import { copyText, downloadText, ensureClipboardWrite } from '@/core/output';
import { prKey, prSlug } from '@/core/pr';
import { agentPrefs } from '@/core/storage';
import { cn } from '@/lib/utils';

const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();
const select = 'h-7 w-full rounded-md border border-input bg-background px-2 text-xs';

const MODES: { id: DeltaMode; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'new-edited', label: 'New and edited only' },
  { id: 'changes', label: 'All changes (incl. resolved)' },
];

export function CaptureSection() {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [hasOutput, setHasOutput] = useState(false);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [includeReviews, setIncludeReviews] = useState(true);
  const [letGithubCopy, setLetGithubCopy] = useState(false);
  const [markOnPage, setMarkOnPage] = useState(true);
  const [mode, setMode] = useState<DeltaMode>('all');
  const [remember, setRemember] = useState(true);
  const [justCopied, setJustCopied] = useState(false);
  const [rememberedAt, setRememberedAt] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);
  const captured = useRef<{ result: CaptureResult; delta: Delta } | null>(null);
  const capturedWith = useRef<{ key: string; sig: string; remember: boolean } | null>(null);
  const prefs = useRef<AgentPrefs>(normalizePrefs(null));
  const key = prKey(location.pathname);
  // The settings that decide which comments a capture contains. A remembered capture is only comparable with one made the same way.
  const scope: CaptureScope = { includeResolved, includeReviews, excluded };
  const snapKey = snapshotKey(key, scope);
  const sig = scopeSig(scope);

  useEffect(() => {
    void getSnapshot(snapKey).then(s => setRememberedAt(s?.at ?? null));
  }, [snapKey]);

  useEffect(() => {
    const apply = (v: unknown) => {
      prefs.current = normalizePrefs(v as Partial<AgentPrefs>);
      setExcluded(prefs.current.excluded);
    };
    void agentPrefs.getValue().then(apply);
    return agentPrefs.watch(apply);
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const render = (nextMode: DeltaMode) => {
    const c = captured.current;
    if (!c) return;
    // With remembering off, saved captures are ignored completely: always show everything.
    const view = applyDelta(c.result.threads, c.delta, capturedWith.current?.remember ? nextMode : 'all');
    const body = renderMarkdown(view.threads, { labelFor: comment => resolveLabel(prefs.current, comment.agentId) });
    setMarkdown(view.header ? `${view.header}\n\n${body || 'No new or edited comments.'}` : body);
  };

  const loadMore = () =>
    run('Loading…', async () => {
      const r = await clickAllLoadMore(registry, { onProgress: n => setStatus(`Clicked ${n}…`) });
      setStatus(`Load more: ${r.clicks} click(s)${r.capped ? ', hit round cap' : ''}`);
    });

  const capture = () =>
    run('Capturing…', async () => {
      let clipboard: 'swallow' | 'passthrough' = 'swallow';
      if (letGithubCopy) {
        // First thing in the click handler, so the browser's one-time prompt appears now and not in the middle of the scan.
        setStatus('Asking your browser for clipboard permission. Click Allow if it asks…');
        if ((await ensureClipboardWrite()) === 'granted') clipboard = 'passthrough';
        else setStatus('Clipboard access was not allowed, so capturing without touching your clipboard instead.');
      }
      prefs.current = normalizePrefs(await agentPrefs.getValue());
      const controller = new AbortController();
      abort.current = controller;
      const result = await captureThreads(registry, {
        signal: controller.signal,
        onProgress: p => setStatus(`Capturing ${p.done} of ${p.total}: ${p.label}`),
        includeResolved,
        includeReviews,
        clipboard,
        agents: { defs: effectiveAgents(prefs.current), excluded: prefs.current.excluded },
      });
      const used: CaptureScope = { includeResolved, includeReviews, excluded: prefs.current.excluded };
      const usedKey = snapshotKey(key, used);
      // Only a capture made with the same settings is comparable, and only when remembering is on.
      const prev = remember ? await getSnapshot(usedKey) : null;
      capturedWith.current = { key: usedKey, sig: scopeSig(used), remember };
      captured.current = { result, delta: computeDelta(result.threads, prev, scanPageComments(registry)) };
      setHasOutput(true);
      render(mode);
      if (markOnPage) markThreads(result.threads, captured.current.delta);
      abort.current = null;
      const found = validateCapture(result);
      setIssues(found);
      setLastCapture(found);
      void reportDoctor();
      const reviews = result.threads.filter(t => t.kind === 'review').length;
      const inline = result.threads.length - reviews;
      setStatus(`${result.aborted ? 'Stopped. ' : ''}Captured ${reviews} review summary(ies) and ${inline} thread(s). Edit or select below, then copy.`);
    });

  const remembered = async () => {
    const c = captured.current;
    const w = capturedWith.current;
    if (!remember || !c || !w) return '';
    const snap = snapshotOf(c.result.threads, Date.now());
    await saveSnapshot(w.key, snap);
    if (w.key === snapKey) setRememberedAt(snap.at);
    return ' Remembered for next time (with the settings used for this capture).';
  };

  const copy = async () => {
    const ok = await copyText(markdown);
    setStatus(ok ? `Copied to clipboard.${await remembered()}` : 'Copy blocked: select the text and press Ctrl/Cmd+C');
  };

  const download = async () => {
    downloadText(`pr-feedback-${prSlug(location.pathname)}.md`, markdown);
    setStatus(`Downloaded.${await remembered()}`);
  };

  return (
    <section className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Turns the review feedback on this page into markdown you can paste into Claude. Steps: Load all, Capture, then Copy."
      >
        Capture
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!!busy}
          title="Step 1 (long PRs). Clicks every 'Load more' / 'Load diff' button on the page until everything is loaded."
          onClick={loadMore}
        >
          Load all
        </Button>
        <Button
          disabled={!!busy}
          title="Step 2. Reads the review summaries and threads on this page by opening each comment's ⋯ menu and using GitHub's own Copy Markdown. Takes a few seconds per thread. It does not touch your clipboard."
          onClick={capture}
        >
          Capture
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs" title="Also capture threads marked Resolved. Off by default because they are usually already dealt with.">
        <input type="checkbox" checked={includeResolved} onChange={e => setIncludeResolved(e.target.checked)} />
        Include resolved threads
      </label>
      <label className="flex items-center gap-2 text-xs" title="Capture each review's summary box, for example Copilot's 'left a comment' with its list of open issues. Untick to capture only inline threads.">
        <input type="checkbox" checked={includeReviews} onChange={e => setIncludeReviews(e.target.checked)} />
        Include review summaries ("left a comment" boxes)
      </label>
      <label
        className="flex items-center gap-2 text-xs"
        title="On: compares with the last capture you copied or downloaded using these same settings, and remembers this one when you copy or download. Off: saved captures are ignored completely (nothing is compared, nothing is saved) and everything is shown."
      >
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
        Remember captures so I can see what changed next time
      </label>
      <label
        className="flex items-center gap-2 text-xs"
        title="Off (recommended): capturing never touches your clipboard and the browser never asks anything. On: GitHub's own copy runs normally during the scan, and your browser asks for clipboard permission once, up front, before the scan starts."
      >
        <input type="checkbox" checked={letGithubCopy} onChange={e => setLetGithubCopy(e.target.checked)} />
        Let GitHub copy to my clipboard while capturing (asks permission first)
      </label>
      <label
        className="flex items-center gap-2 text-xs"
        title="Draws a green outline on threads with new comments and amber on edited ones, right on GitHub's page. Needs an earlier remembered capture to compare with."
      >
        <input
          type="checkbox"
          checked={markOnPage}
          onChange={e => {
            setMarkOnPage(e.target.checked);
            const c = captured.current;
            if (!e.target.checked) clearMarks();
            else if (c) markThreads(c.result.threads, c.delta);
          }}
        />
        Outline new (green) and edited (amber) threads on this page
      </label>
      <label className="block space-y-1 text-xs" title={remember ? "How much of the capture to show. 'New and edited only' compares with the last capture you copied or downloaded using the same settings." : 'Turn on "Remember captures" to compare with an earlier capture. While it is off, everything is shown.'}>
        <span>Show</span>
        <select
          className={select}
          value={mode}
          disabled={!remember}
          title="Everything: all captured feedback. New and edited only: just what changed since your last copy. All changes: that plus threads resolved since and comments that disappeared."
          onChange={e => {
            const next = e.target.value as DeltaMode;
            setMode(next);
            render(next);
          }}
        >
          {MODES.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] text-muted-foreground" title="A remembered capture is saved only when you press Copy or Download. Each combination of the settings above (resolved threads, review summaries, left-out agents) keeps its own, because captures made with different settings cannot be compared fairly. It lives in this browser only.">
        {!remember
          ? 'Remembering is off: saved captures are ignored and nothing is saved.'
          : rememberedAt
            ? `Last remembered capture with these settings: ${formatTime(rememberedAt)}.`
            : 'Nothing remembered yet with these settings, so the first capture shows everything.'}{' '}
        {remember && rememberedAt && (
          <button
            className="underline"
            title="Delete every remembered capture of this PR (whatever settings they used). The next capture will treat everything as new."
            onClick={async () => {
              await forgetSnapshotsFor(snapshotPrefix(key));
              setRememberedAt(null);
              clearMarks();
            }}
          >
            Forget
          </button>
        )}
      </p>
      {busy && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs">{busy}</p>
          {busy === 'Capturing…' && (
            <Button size="sm" variant="destructive" title="Stop after the item being read. What was read so far is kept, and the alert says it was stopped early." onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          )}
        </div>
      )}
      {status && <p className="text-xs">{status}</p>}
      {hasOutput && capturedWith.current && (capturedWith.current.sig !== sig || capturedWith.current.remember !== remember) && (
        <p
          role="status"
          className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400"
          title="The text below was captured with different settings than the ones ticked above. Click Capture again to update it."
        >
          The settings above changed since this capture. Click Capture again to update the text.
        </p>
      )}
      {hasOutput && <ValidationAlert issues={issues} />}
      {hasOutput && (
        <div className="space-y-2">
          <div className="relative">
            <textarea
              className="h-72 w-full resize-y rounded-md border border-input bg-background p-2 pr-16 font-mono text-[10px] leading-snug"
              spellCheck={false}
              value={markdown}
              title="The captured markdown. Edit it, or select just the part you need and press Ctrl/Cmd+C."
              onChange={e => setMarkdown(e.target.value)}
              onKeyDown={stopKeys}
              onKeyUp={stopKeys}
              onKeyPress={stopKeys}
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute right-3 top-2 h-6 border px-2 shadow-sm"
              disabled={!markdown}
              title="Copy everything in this box to your clipboard. Nothing is copied until you click."
              onClick={async () => {
                await copy();
                setJustCopied(true);
                setTimeout(() => setJustCopied(false), 1500);
              }}
            >
              {justCopied ? 'Copied ✓' : 'Copy'}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={copy} disabled={!markdown} title="Copy everything in the box to your clipboard (same as the Copy button on the box).">
              Copy
            </Button>
            <Button variant="outline" disabled={!markdown} title="Save the box contents as a .md file in your Downloads folder." onClick={download}>
              Download
            </Button>
            <Button
              variant="ghost"
              title="Empty the box and remove the page outlines. Your remembered capture is kept."
              onClick={() => {
                setMarkdown('');
                setHasOutput(false);
                setIssues([]);
                setLastCapture(null);
                captured.current = null;
                capturedWith.current = null;
                clearMarks();
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground" title="Planned: copy as formatted text for pasting into docs and email.">
        Rich text export: coming soon
      </p>
    </section>
  );
}

const TONE = {
  error: 'border-destructive/50 bg-destructive/10 text-destructive',
  warn: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  ok: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
} as const;

const TITLE = {
  error: 'Capture looks wrong',
  warn: 'Capture may be incomplete',
  info: 'Capture OK, with notes',
  ok: 'Capture looks consistent',
} as const;

function ValidationAlert({ issues }: { issues: Issue[] }) {
  const level = worstSeverity(issues) ?? 'ok';
  return (
    <div
      role="alert"
      title="A self-check of the capture. Red: something is wrong or missing. Amber: may be incomplete. Blue: fine, with notes. Green: consistent."
      className={cn('space-y-1 rounded-md border p-2 text-[11px]', TONE[level])}
    >
      <p className="font-semibold">{TITLE[level]}</p>
      {issues.length > 0 && (
        <ul className="max-h-28 list-disc space-y-0.5 overflow-auto pl-4 break-words">
          {issues.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
