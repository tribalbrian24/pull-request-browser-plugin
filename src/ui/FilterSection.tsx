import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { runner } from '@/core/filters/instance';
import { PRESETS, type Filter } from '@/core/filters/presets';
import type { Stats } from '@/core/filters/runner';

export function FilterSection() {
  const [active, setActive] = useState<string | null>(runner.active?.id ?? null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!active) return setStats(null);
    const tick = () => setStats(runner.stats());
    tick();
    const id = setInterval(tick, 800);
    return () => clearInterval(id);
  }, [active]);

  const apply = (f: Filter) => {
    runner.start(f);
    setActive(f.id);
  };
  const restore = () => {
    runner.stop();
    setActive(null);
  };

  const s = stats?.byStatus;
  return (
    <section className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Hide or show files on the Files changed tab. Nothing is reloaded and GitHub's page is not changed; files are only hidden."
      >
        Files changed
      </h3>
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map(p => (
          <Button
            key={p.id}
            size="sm"
            variant={active === p.id ? 'default' : 'outline'}
            title={`${p.hint ?? ''}\n\n${p.mode === 'hide' ? 'Hides the matching files.' : 'Shows only the matching files.'}\nThe highlighted button is the one in use.`}
            onClick={() => apply(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={!active}
        title="Show every file again. Instant, nothing is reloaded."
        onClick={restore}
      >
        Restore all
      </Button>
      {stats && s && (
        <p
          className="text-[10px] text-muted-foreground"
          title="Counts are for the files GitHub has drawn so far. 'Status unknown' files (no code changes shown yet) are never hidden by a status filter."
        >
          {stats.hidden} hidden of {stats.rendered} rendered. New {s.added}, deleted {s.deleted}, edited {s.modified},
          renamed {s.renamed + s['renamed-modified']}
          {stats.undetermined ? `, status unknown ${stats.undetermined} (never hidden by status filters)` : ''}.
        </p>
      )}
      <p className="text-[10px] text-muted-foreground" title="GitHub only draws the files near your scroll position, so the extension can only filter what it has seen.">
        Only files GitHub has rendered are known. Use "Load all" and scroll to cover long lists; hidden files stay
        hidden as you scroll.
      </p>
    </section>
  );
}
