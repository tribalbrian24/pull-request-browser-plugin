import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { parseOverrides } from '@/core/locators/registry';
import { resetExtensionMemory } from '@/core/reset';
import type { LocatorOverride } from '@/core/locators/types';
import { locatorOverrides } from '@/core/storage';
import { AccessPane } from '@/ui/AccessPane';
import { DoctorPane } from '@/ui/DoctorPane';

function ResetPanel({ onCancel }: { onCancel: () => void }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState('');
  return (
    <section className="space-y-3 rounded-md border border-destructive/40 p-3">
      <h2
        className="text-sm font-semibold text-destructive"
        title="Everything the extension remembers lives in this browser only. This wipes it."
      >
        Reset Extension Memory
      </h2>
      {done ? (
        <>
          <p className="font-medium">Done. The extension's memory is empty.</p>
          <p className="text-muted-foreground">Reload the GitHub page so it starts from the clean state.</p>
          <Button variant="outline" title="Go back to the Doctor tab" onClick={onCancel}>
            Back to Doctor
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium" title="This cannot be undone.">
            Wipe everything the extension remembers?
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li title="Selectors you saved from the inspector">Your saved selectors</li>
            <li title="Patterns, stack packs and Jest layers you saved">File patterns and layers</li>
            <li title="Which agents are included, their names and label settings">Agent settings</li>
            <li title="Captures remembered for 'what changed' comparisons">Remembered captures</li>
            <li title="Cached Doctor results and the toolbar badge state">Cached Doctor results</li>
          </ul>
          <p className="text-[10px] text-muted-foreground">
            Your GitHub login and the permissions you allowed (Access tab) are not touched. This cannot be undone.
          </p>
          {failed && <p className="text-destructive">{failed}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="destructive"
              title="Yes: delete everything listed above now. This cannot be undone."
              onClick={async () => {
                try {
                  await resetExtensionMemory(browser.storage);
                  setDone(true);
                } catch (e) {
                  setFailed(`Could not reset: ${(e as Error).message}`);
                }
              }}
            >
              Yes, reset
            </Button>
            <Button variant="outline" title="No: keep everything and go back to the Doctor tab." onClick={onCancel}>
              No, keep it
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Overrides() {
  const [overrides, setOverrides] = useState<Record<string, LocatorOverride>>({});
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void locatorOverrides.getValue().then(setOverrides);
    return locatorOverrides.watch(v => setOverrides(v));
  }, []);

  const count = Object.keys(overrides).length;

  const importPack = async () => {
    const { value, errors } = parseOverrides(text);
    if (!Object.keys(value).length) return setMsg(errors.join('; ') || 'Nothing to import');
    await locatorOverrides.setValue({ ...overrides, ...value });
    setMsg(`Imported ${Object.keys(value).length}${errors.length ? `, skipped: ${errors.join('; ')}` : ''}`);
  };

  return (
    <section className="space-y-2">
      <h2
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Your own selectors that replace the built-in ones when GitHub changes its page. Save them from the DevTools Elements panel, then share them here as JSON."
      >
        Locator overrides ({count})
      </h2>
      <textarea
        className="h-28 w-full rounded-md border border-input bg-background p-2 font-mono text-[10px]"
        title="Export puts your saved selectors here as JSON. Paste someone else's JSON here and click Import to use it."
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste a selector pack (JSON) to import"
      />
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" title="Show your saved selectors as JSON in the box so you can copy and share them." onClick={() => setText(JSON.stringify(overrides, null, 2))}>
          Export
        </Button>
        <Button title="Add the selectors in the box to your saved ones. Invalid ones are skipped and reported." onClick={importPack}>Import</Button>
        <Button
          variant="destructive"
          title="Delete all your saved selectors and go back to the built-in ones."
          disabled={!count}
          onClick={async () => {
            await locatorOverrides.setValue({});
            setMsg('Cleared all overrides');
          }}
        >
          Clear
        </Button>
      </div>
      {msg && <p>{msg}</p>}
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState<'doctor' | 'locators' | 'access' | 'reset'>('doctor');
  return (
    <main className="w-[26rem] space-y-3 bg-background p-3 font-sans text-xs text-foreground">
      <header className="space-y-2">
        <h1 className="text-sm font-semibold" title="Everything runs in your browser. Nothing is sent anywhere.">PR Review Companion</h1>
        <nav className="flex flex-wrap gap-1">
          {(['doctor', 'locators', 'access', 'reset'] as const).map(t => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? 'secondary' : 'ghost'}
              title={t === 'doctor' ? 'Health checks for the GitHub page you are on' : t === 'locators' ? 'Your saved selectors: export, import or clear' : t === 'access' ? 'Optionally allow the extension to read files such as jest.config from your repos' : 'Reset Extension Memory: wipe everything the extension remembers (asks you to confirm)'}
              onClick={() => setTab(t)}
            >
              {t === 'doctor' ? 'Doctor' : t === 'locators' ? 'Locators' : t === 'access' ? 'Access' : 'Reset'}
            </Button>
          ))}
        </nav>
      </header>
      {tab === 'doctor' ? (
        <DoctorPane />
      ) : tab === 'locators' ? (
        <Overrides />
      ) : tab === 'access' ? (
        <AccessPane />
      ) : (
        <ResetPanel onCancel={() => setTab('doctor')} />
      )}
      <p className="text-[10px] text-muted-foreground">
        Tools are in the "PR tools" tab on the left of a PR page. Nothing leaves your browser. Rich-text export and AI
        locator repair: coming soon.
      </p>
    </main>
  );
}
