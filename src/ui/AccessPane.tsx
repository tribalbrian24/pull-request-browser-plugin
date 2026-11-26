import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { rawOriginFor } from '@/core/filters/background-fetch';

async function activeOrg(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  try {
    return tab?.url ? (new URL(tab.url).pathname.split('/')[1] ?? '') : '';
  } catch {
    return '';
  }
}

export function AccessPane() {
  const [org, setOrg] = useState('');
  const [granted, setGranted] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const all = await browser.permissions.getAll();
    setGranted((all.origins ?? []).filter(o => o.startsWith('https://raw.githubusercontent.com/')));
  }, []);

  useEffect(() => {
    void activeOrg().then(setOrg);
    void refresh();
  }, [refresh]);

  const origin = org ? rawOriginFor(org) : '';
  const has = origin !== '' && granted.includes(origin);
  const valid = /^[\w.-]+$/.test(org);

  const request = async () => {
    const ok = await browser.permissions.request({ origins: [origin] });
    setMsg(ok ? `Allowed: ${origin}` : 'Not allowed.');
    await refresh();
  };
  const revoke = async (o: string) => {
    await browser.permissions.remove({ origins: [o] });
    setMsg(`Revoked: ${o}`);
    await refresh();
  };

  return (
    <section className="space-y-2">
      <p className="text-muted-foreground">
        Optional. Lets the extension read files you list (for example Jest configs) from your repos using your GitHub
        session. Nothing is sent anywhere, and nothing is requested until you click Allow.
      </p>
      <label className="block space-y-1" title="The GitHub organization (or user) whose repository files you want the extension to be able to read, for example acme.">
        <span className="font-medium">GitHub organization</span>
        <input
          className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-[11px]"
          title="Filled in from the tab you are on. Change it to allow a different organization."
          value={org}
          onChange={e => setOrg(e.target.value.trim())}
        />
      </label>
      {valid && (
        <p className="break-all font-mono text-[10px] text-muted-foreground">
          {origin} {has ? '(allowed)' : '(not allowed)'}
        </p>
      )}
      <Button disabled={!valid || has} title="Chrome will ask you to confirm. Only files in that organization on raw.githubusercontent.com can then be read, and only when you ask (for example Detect from Jest config)." onClick={request}>
        Allow reading {valid ? org : '…'} files
      </Button>
      {granted.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">Allowed now</p>
          <ul className="space-y-1">
            {granted.map(o => (
              <li key={o} className="flex items-center justify-between gap-2">
                <span className="break-all font-mono text-[10px]">{o}</span>
                <Button size="sm" variant="ghost" title="Take this permission back. You can allow it again any time." onClick={() => revoke(o)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && <p>{msg}</p>}
    </section>
  );
}
