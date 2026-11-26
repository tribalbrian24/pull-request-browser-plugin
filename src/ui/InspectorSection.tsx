import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_LOCATORS, type LocatorKey } from '@/core/locators/defaults';
import { highlight, proposeSelectors, shadowPathOf, startInspector, type Candidate } from '@/core/locators/inspector';
import { runAttempt } from '@/core/locators/registry';
import { registry } from '@/core/instance';
import { buildDiagnostics } from '@/core/diagnostics';
import { copyText } from '@/core/output';
import { probeFilesList } from '@/core/probe';
import { locatorOverrides } from '@/core/storage';

const KEYS = Object.keys(DEFAULT_LOCATORS) as LocatorKey[];

export function InspectorSection({ getHost }: { getHost: () => Element | null }) {
  const [key, setKey] = useState<LocatorKey | ''>('');
  const [picking, setPicking] = useState(false);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [shadow, setShadow] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState('');
  const [, refresh] = useState(0);

  const hasOverride = !!key && !!registry.getOverrides()[key];
  const chosen = cands[sel];

  const pick = () => {
    const host = getHost();
    setPicking(true);
    setMsg('Click an element on the page. Esc cancels.');
    startInspector({
      ignore: path => !!host && path.includes(host),
      onPick: el => {
        setCands(proposeSelectors(el));
        setShadow(shadowPathOf(el));
        setSel(0);
        setPicking(false);
        setMsg('');
      },
      onCancel: () => {
        setPicking(false);
        setMsg('');
      },
    });
  };

  const test = () => {
    if (!chosen) return;
    const r = runAttempt({ selectors: [chosen.selector], shadowPath: shadow }, document);
    highlight(r.elements);
    setMsg(`${r.elements.length} match(es)`);
  };

  const persist = async (next: ReturnType<typeof registry.getOverrides>, note: string) => {
    await locatorOverrides.setValue(next);
    registry.setOverrides(next);
    setMsg(note);
    refresh(n => n + 1);
  };

  const save = () => {
    if (!chosen || !key) return;
    return persist(
      { ...registry.getOverrides(), [key]: { selectors: [chosen.selector], ...(shadow.length ? { shadowPath: shadow } : {}) } },
      `Saved pattern for ${key}`,
    );
  };

  const reset = () => {
    if (!key) return;
    const next = { ...registry.getOverrides() };
    delete next[key];
    return persist(next, `Reset ${key} to default`);
  };

  const report = Object.entries(registry.report());

  return (
    <section className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Repair tool for when GitHub changes its page. Pick a locator, click the right element on the page, and save. (The Elements panel in DevTools has a fuller version.)"
      >
        Inspector
      </h3>
      <select
        title={key ? `${DEFAULT_LOCATORS[key].description}\n\nSelect: ${DEFAULT_LOCATORS[key].pick}` : 'Choose which locator you are fixing. Nothing is saved until you do.'}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        value={key}
        onChange={e => setKey(e.target.value as LocatorKey | '')}
      >
        <option value="" title="Choose which locator you are fixing. Nothing is saved until you do.">Choose what you are fixing…</option>
        {KEYS.map(k => (
          <option key={k} value={k} title={`${DEFAULT_LOCATORS[k].description}\n\nSelect: ${DEFAULT_LOCATORS[k].pick}`}>
            {k}
            {registry.getOverrides()[k] ? ' *' : ''}
          </option>
        ))}
      </select>
      {key ? (
        <>
          <p className="text-[10px]">{DEFAULT_LOCATORS[key].description}</p>
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">Select:</span> {DEFAULT_LOCATORS[key].pick}
          </p>
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground">Pick a locator first. Hover a name for what it is and what to select.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={picking || !key} title={key ? 'Then click the element on the page that this locator should find. Press Esc to cancel.' : 'Choose which locator you are fixing first.'} onClick={pick}>
          Pick element
        </Button>
        <Button variant="ghost" disabled={!hasOverride} title="Remove your saved selector for this locator and go back to the built-in one." onClick={reset}>
          Reset to default
        </Button>
      </div>
      {cands.length > 0 && (
        <div className="space-y-1">
          <ul className="max-h-32 space-y-1 overflow-auto">
            {cands.map((c, i) => (
              <li key={c.selector}>
                <label className="flex items-start gap-1 text-[10px]" title={`Matches ${c.matchCount} element(s) on this page. The best choice matches what you want, and ideally only that.`}>
                  <input type="radio" checked={i === sel} onChange={() => setSel(i)} className="mt-0.5" />
                  <span className="break-all font-mono">
                    {c.selector} <span className="text-muted-foreground">({c.matchCount})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {shadow.length > 0 && (
            <p className="break-all font-mono text-[10px] text-muted-foreground" title="This element is inside a shadow root (a hidden sub-tree). The path lists the host elements to open, outermost first, and is saved with the selector.">shadow: {shadow.join(' >> ')}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" title="Highlights every element this selector matches on the page. Nothing is saved." onClick={test}>
              Test
            </Button>
            <Button title="Saves the chosen selector for this locator. Your selector is tried before the built-in one. If it makes things worse, remove it with Reset to default." disabled={!key} onClick={save}>Update CSS &amp; shadow DOM pattern</Button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs">{msg}</p>}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground" title="After a capture: how many elements each locator found. Red 0 means that locator found nothing.">Locator health</summary>
        <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
          {report.length === 0 && <li className="text-muted-foreground">Run Capture or Load all first.</li>}
          {report.map(([k, n]) => (
            <li key={k} className={n === 0 ? 'text-destructive' : ''}>
              {k}: {n}
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" title="Update the list" onClick={() => refresh(n => n + 1)}>
          Refresh
        </Button>
      </details>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground" title="Tools for reporting a problem. They never include comment text.">Diagnostics</summary>
        <Button
          size="sm"
          variant="outline"
          className="mt-1"
          title="Copies details about how GitHub draws the Files changed list (row positions, no file contents)."
          onClick={async () => setMsg((await copyText(probeFilesList(registry))) ? 'Probe JSON copied' : 'Copy blocked')}
        >
          Probe Files list
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="mt-1 ml-1"
          title="Copies a description of this page's structure (element names, classes, counts). No comment text, no links. Safe to paste into a bug report or to Claude."
          onClick={async () => setMsg((await copyText(buildDiagnostics(registry).text)) ? 'Diagnostics copied' : 'Copy blocked')}
        >
          Copy page diagnostics
        </Button>
      </details>
    </section>
  );
}
