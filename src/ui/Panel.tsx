import { Component, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getDoctorLevel, subscribeDoctor, type DoctorLevel } from '@/core/doctor/state';
import { githubIsDark } from '@/core/theme';
import { cn } from '@/lib/utils';
import { AgentsSection } from './AgentsSection';
import { CaptureSection } from './CaptureSection';
import { CommitsSection } from './CommitsSection';
import { FilterSection } from './FilterSection';
import { InspectorSection } from './InspectorSection';
import { PatternsSection } from './PatternsSection';

const DOT: Record<NonNullable<DoctorLevel> | 'none', string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  none: 'bg-zinc-400',
};
const SUMMARY = { ok: 'all checks passed', warn: 'needs attention', error: 'problems found', none: 'not checked yet' } as const;

function PanelInner() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const level = useSyncExternalStore(subscribeDoctor, getDoctorLevel);
  const dot = <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', DOT[level ?? 'none'])} />;
  const getHost = () => (ref.current?.getRootNode() as ShadowRoot | undefined)?.host ?? null;

  return (
    <div
      ref={ref}
      className={cn('fixed left-0 z-[2147483000] font-sans text-xs text-foreground', open ? 'top-3' : 'top-1/3', githubIsDark() && 'dark')}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-1.5rem)] w-64 max-w-[90vw] flex-col rounded-r-lg border border-l-0 bg-background shadow-lg has-[textarea]:w-[28rem]">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <span
              className="flex items-center gap-2 text-sm font-semibold"
              title={`The dot is the Doctor's verdict for this page: ${SUMMARY[level ?? 'none']}. Green: all good. Amber: needs attention. Red: problems. Grey: not checked yet. Details are in the extension popup, Doctor tab.`}
            >
              {dot}
              PR Review Companion
            </span>
            <Button size="sm" variant="outline" title="Hide this panel. The PR tools tab stays on the left edge so you can open it again." onClick={() => setOpen(false)} aria-label="Close panel">
              Close ×
            </Button>
          </header>
          <div className="min-h-0 space-y-3 overflow-auto p-3">
            <CaptureSection />
            <AgentsSection />
            <FilterSection />
            <PatternsSection />
            <CommitsSection />
            <InspectorSection getHost={getHost} />
            <section className="space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" title="Ideas that are planned but not built yet.">Coming soon</h3>
              <p className="text-[10px] text-muted-foreground">Rich-text export, AI locator repair, agent-specific capture rules.</p>
            </section>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title={`Open PR Review Companion: capture review feedback as markdown, filter files, and more. The dot shows the Doctor's verdict: ${SUMMARY[level ?? 'none']}.`}
          className="flex items-center gap-2 rounded-r-md border border-l-0 bg-background px-2 py-4 text-xs font-semibold shadow-md hover:bg-accent [writing-mode:vertical-rl]"
        >
          {dot}
          PR tools
        </button>
      )}
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null; where: string }> {
  state = { error: null as Error | null, where: '' };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[PR Review Companion] panel crashed', error, info.componentStack);
    this.setState({ where: (info.componentStack ?? '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 4).join('\n') });
  }
  render() {
    const { error, where } = this.state;
    return error ? (
      <div className="fixed left-0 top-1/3 z-[2147483000] max-w-xs rounded-r-md border border-l-0 border-red-500 bg-white p-2 text-xs text-red-700 shadow-md">
        <p className="font-semibold">PR tools crashed</p>
        <p className="break-words font-mono text-[10px]">{error.message}</p>
        {where && <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-zinc-600">{where}</pre>}
        <p className="mt-1 text-[10px] text-zinc-600">Copy this text and send it along.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

export const Panel = () => (
  <Boundary>
    <PanelInner />
  </Boundary>
);
