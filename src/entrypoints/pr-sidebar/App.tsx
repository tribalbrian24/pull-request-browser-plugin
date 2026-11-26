import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import type { BgMsg, PageMsg, Reply } from '@/core/bridge/messages';
import { keysForCheck } from '@/core/doctor/checks';
import { MARK_ATTR, type Described, type NavDir } from '@/core/inspect/session';
import { DEFAULT_LOCATORS, isLocatorKey, type LocatorKey } from '@/core/locators/defaults';
import { locatorOverrides } from '@/core/storage';

const KEYS = Object.keys(DEFAULT_LOCATORS) as LocatorKey[];
const MARK_EXPR = `(function(el){if(!el||el.nodeType!==1)return false;el.setAttribute('${MARK_ATTR}','1');return true;})($0)`;
const NAV: { dir: NavDir; label: string; hint: string }[] = [
  { dir: 'parent', label: '▲ Parent', hint: 'The element that contains this one (steps out of a shadow root to its host)' },
  { dir: 'child', label: '▼ Child', hint: 'The first element inside this one' },
  { dir: 'prev', label: '◀ Prev', hint: 'The previous sibling: same level, directly before this element' },
  { dir: 'next', label: '▶ Next', hint: 'The next sibling: same level, directly after this element' },
  { dir: 'shadow', label: '⤵ Into shadow', hint: 'The first element inside this element\'s shadow root' },
];

function evalInPage(expr: string): Promise<unknown> {
  const inspected = browser.devtools.inspectedWindow;
  if (import.meta.env.FIREFOX) {
    return (inspected.eval(expr) as unknown as Promise<[unknown, unknown]>).then(([result]) => result);
  }
  return new Promise((resolve, reject) =>
    inspected.eval(expr, (result, ex) => {
      const failed = ex && ((ex as { isError?: boolean }).isError || (ex as { isException?: boolean }).isException);
      return failed ? reject(new Error('Could not read the selected element')) : resolve(result);
    }),
  );
}

const relay = (payload: PageMsg) =>
  browser.runtime.sendMessage({
    type: 'relay',
    tabId: browser.devtools.inspectedWindow.tabId,
    payload,
  } satisfies BgMsg) as Promise<Reply>;

export default function App() {
  const [described, setDescribed] = useState<Described | null>(null);
  const [key, setKey] = useState<LocatorKey | ''>('');
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState('Select an element in the Elements panel.');
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [broken, setBroken] = useState<LocatorKey[]>([]);
  const [warning, setWarning] = useState<{ text: string; undo?: Reply['undo'] } | null>(null);

  const loadDoctor = useCallback(async () => {
    try {
      const r = await relay({ type: 'doctor:run' });
      const keys = (r.report?.checks ?? []).flatMap(keysForCheck);
      setBroken(Array.from(new Set(keys)));
    } catch {
      setBroken([]);
    }
  }, []);

  useEffect(() => {
    void loadDoctor();
  }, [loadDoctor]);

  useEffect(() => {
    void locatorOverrides.getValue().then(setOverrides);
    return locatorOverrides.watch(v => setOverrides(v));
  }, []);

  const apply = (r: Reply) => {
    if (r.described !== undefined) {
      setDescribed(r.described);
      setSel(0);
    }
    setMsg(r.message ?? '');
  };

  const refresh = useCallback(async () => {
    try {
      if (!(await evalInPage(MARK_EXPR))) {
        setDescribed(null);
        return setMsg('Select an element in the Elements panel.');
      }
      apply(await relay({ type: 'inspect:select' }));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const selection = browser.devtools.panels.elements.onSelectionChanged;
    selection.addListener(refresh);
    return () => selection.removeListener(refresh);
  }, [refresh]);

  const chosen = described?.candidates[sel];
  const send = async (payload: PageMsg) => {
    const r = await relay(payload);
    if (payload.type === 'inspect:test') setMsg(`${r.count ?? 0} match(es), highlighted on the page`);
    else apply(r);
    if (r.warning) setWarning({ text: r.warning, undo: r.undo });
    else if (payload.type === 'inspect:save' || payload.type === 'inspect:reset' || payload.type === 'inspect:restore') setWarning(null);
    if (payload.type === 'inspect:save' || payload.type === 'inspect:reset' || payload.type === 'inspect:restore') void loadDoctor();
  };

  const resetAll = async () => {
    for (const k of Object.keys(overrides)) await relay({ type: 'inspect:reset', key: k });
    setWarning(null);
    setMsg('Reset every saved selector. The built-in ones are in use again.');
    void loadDoctor();
  };

  const def = key ? DEFAULT_LOCATORS[key] : null;
  const help = (k: LocatorKey) => `${DEFAULT_LOCATORS[k].description}\n\nSelect in Elements: ${DEFAULT_LOCATORS[k].pick}`;
  const saved = Object.keys(overrides);
  const mismatch = !!key && !!described && described.looksLike.length > 0 && !described.looksLike.includes(key);

  return (
    <main className="space-y-3 bg-background p-3 font-sans text-xs text-foreground">
      {broken.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
          <p className="font-medium text-amber-700 dark:text-amber-400">Needs fixing (from the Doctor)</p>
          <div className="flex flex-wrap gap-1">
            {broken.map(k => (
              <Button key={k} title={help(k)} size="sm" variant={k === key ? 'default' : 'outline'} onClick={() => setKey(k)}>
                {k}
              </Button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Click a key, select the right element in the Elements panel, then Update. Hover any key for what to select. The Doctor re-checks after each save.
          </p>
          {saved.length > 0 && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400" title="Your own saved selectors replace the built-in ones, so a wrong one can break things that used to work.">
              You have {saved.length} saved selector(s). If problems started after saving one, reset it below.
            </p>
          )}
        </div>
      )}

      {warning && (
        <div role="alert" className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">
          <p className="font-medium">{warning.text}</p>
          {warning.undo && (
            <Button
              size="sm"
              variant="destructive"
              title="Put things back exactly as they were before that save."
              onClick={() => send({ type: 'inspect:restore', key: warning.undo!.key, previous: warning.undo!.previous })}
            >
              Undo that change
            </Button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label className="font-medium" htmlFor="locator-key" title="Each key is one thing the extension needs to find on the page. Choose the one you are fixing before you save.">
          Fixing this locator
        </label>
        <select
          id="locator-key"
          className="h-8 w-full rounded-md border border-input bg-background px-2"
          value={key}
          title={key ? help(key) : 'Choose which locator you are fixing. Nothing is saved until you do.'}
          onChange={e => setKey(e.target.value as LocatorKey | '')}
        >
          <option value="" title="Choose which locator you are fixing. Nothing is saved until you do.">Choose what you are fixing…</option>
          {KEYS.map(k => (
            <option key={k} value={k} title={help(k)}>
              {k}
              {overrides[k] ? ' *' : ''}
            </option>
          ))}
        </select>
        {def && key ? (
          <>
            <p className="text-[11px]">{def.description}</p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Select in Elements:</span> {def.pick}
            </p>
            {overrides[key] ? <p className="text-[10px] text-amber-600 dark:text-amber-400">* You have your own selector saved for this key.</p> : null}
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">Pick a locator first. Hover a name for what it is and what to select.</p>
        )}
      </div>

      <p className="min-h-4 text-muted-foreground">{msg}</p>
      {described && (
        <>
          <div>
            <p className="break-all font-mono text-[11px] font-semibold" title="The element currently selected in the Elements panel (after any Parent / Child / Prev / Next moves)">
              {described.label}
            </p>
            {described.shadowPath.length > 0 && (
              <p
                className="break-all font-mono text-[10px] text-amber-600 dark:text-amber-400"
                title="This element lives inside a shadow root (a hidden sub-tree). The path lists the host elements to open, outermost first. It is saved with the selector."
              >
                in shadow DOM: {described.shadowPath.join(' >> ')}
              </p>
            )}
            {described.looksLike.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1" title="The built-in locators that already match exactly this element. If you are repairing one of them, this is probably the element it should find.">
                <span className="text-[10px] text-muted-foreground">This element looks like:</span>
                {described.looksLike.map(k => (
                  <Button key={k} size="sm" variant={k === key ? 'default' : 'outline'} title={`Use ${k} as the locator to fix`} onClick={() => setKey(k)}>
                    {k}
                  </Button>
                ))}
              </div>
            )}
            {mismatch && (
              <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                You chose {key}, but this element already matches {described.looksLike.join(', ')}. Saving it under {key} may break things. Check that is what you want.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {NAV.map(n => (
              <Button key={n.dir} title={n.hint} size="sm" variant="outline" disabled={!described.can[n.dir]} onClick={() => send({ type: 'inspect:nav', dir: n.dir })}>
                {n.label}
              </Button>
            ))}
          </div>
          <p className="text-[10px] font-medium" title="Ranked: most durable first (test ids and ids with a stable start), then classes, then position. The number is how many elements on the page each one matches.">
            Selector options (matches on the page)
          </p>
          <ul className="space-y-1">
            {described.candidates.map((c, i) => (
              <li key={c.selector}>
                <label className="flex items-start gap-1 text-[10px]" title={`Matches ${c.matchCount} element(s) on this page. Pick the one that matches what you want, and ideally only that.`}>
                  <input type="radio" className="mt-0.5" checked={i === sel} onChange={() => setSel(i)} />
                  <span className="break-all font-mono">
                    {c.selector} <span className="text-muted-foreground">({c.matchCount})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              title="Highlights on the page every element the chosen selector matches. Nothing is saved."
              disabled={!chosen}
              onClick={() => chosen && send({ type: 'inspect:test', selector: chosen.selector, shadowPath: described.shadowPath })}
            >
              Test
            </Button>
            <Button
              title={key ? `Saves the chosen selector for "${key}" and checks that the browser kept it. If it makes the Doctor worse you get a warning and an Undo button.` : 'Choose which locator you are fixing first.'}
              disabled={!chosen || !key}
              onClick={() => chosen && key && send({ type: 'inspect:save', key, selector: chosen.selector, shadowPath: described.shadowPath })}
            >
              Update CSS &amp; shadow DOM pattern
            </Button>
            <Button variant="ghost" title="Removes your saved selector for this key and goes back to the built-in one." disabled={!key || !overrides[key]} onClick={() => key && send({ type: 'inspect:reset', key })}>
              Reset
            </Button>
          </div>
        </>
      )}

      {saved.length > 0 && (
        <details className="text-xs" open={broken.length > 0}>
          <summary className="cursor-pointer font-medium" title="Selectors you saved. They are tried before the built-in ones, so a wrong one can break capture.">
            Your saved selectors ({saved.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {saved.map(k => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span className="break-all font-mono text-[10px]" title={isLocatorKey(k) ? help(k) : k}>
                  {k}
                </span>
                <Button size="sm" variant="ghost" title="Remove this saved selector and use the built-in one." onClick={() => send({ type: 'inspect:reset', key: k })}>
                  Reset
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="mt-1" title="Remove every saved selector and go back to the built-in ones. The quickest way back to a known-good state." onClick={resetAll}>
            Reset all
          </Button>
        </details>
      )}
    </main>
  );
}
