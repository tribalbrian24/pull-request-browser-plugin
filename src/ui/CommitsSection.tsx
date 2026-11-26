import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { commitsMarkdown, headSha, openAndReadCommits, selectedRange, type CommitItem } from '@/core/commits';
import { registry } from '@/core/instance';
import { copyText } from '@/core/output';

export function CommitsSection() {
  const [items, setItems] = useState<CommitItem[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const read = async () => {
    setBusy(true);
    const found = await openAndReadCommits(registry);
    setItems(found);
    setBusy(false);
    setMsg(found.length ? '' : 'No commit list found. Open the Files changed tab (needs "commits.button").');
  };

  const range = selectedRange(items);
  return (
    <section className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Reads the commit list from GitHub's commit picker on the Files changed tab."
      >
        Commits
      </h3>
      <div className="grid grid-cols-2 gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          title="Briefly opens the commit picker on the Files changed tab, reads the list, and closes it again."
          onClick={read}
        >
          Read commits
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!items.length}
          title="Copies the commit list as markdown. This is a button you click, so your clipboard is only used when you ask."
          onClick={async () => setMsg((await copyText(commitsMarkdown(items))) ? 'Copied commit list' : 'Copy blocked')}
        >
          Copy list
        </Button>
      </div>
      {items.length > 0 && (
        <>
          <p
            className="text-[10px] text-muted-foreground"
            title="Head is the newest commit. The selected range is whatever commits the picker currently has ticked."
          >
            {items.length} commit(s), head {headSha(items)}. Selected range: {range.count ? `${range.first?.sha} to ${range.last?.sha} (${range.count})` : 'none'}.
          </p>
          <ul className="max-h-28 space-y-0.5 overflow-auto text-[10px]">
            {items.map(i => (
              <li key={i.sha} className={i.selected ? 'font-medium' : 'text-muted-foreground'} title={`${i.description}${i.truncated ? '\nGitHub shortened this commit message.' : ''}${i.selected ? '\nIn the selected range.' : ''}`}>
                <span className="font-mono">{i.sha}</span> {i.label}
              </li>
            ))}
          </ul>
        </>
      )}
      {msg && <p className="text-[10px]">{msg}</p>}
    </section>
  );
}
