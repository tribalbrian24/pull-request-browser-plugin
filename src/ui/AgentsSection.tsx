import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { countByAgent, customAgent, effectiveAgents, normalizePrefs, type AgentPrefs, type LabelSetting } from '@/core/agents/agents';
import { registry } from '@/core/instance';
import { agentPrefs } from '@/core/storage';
import { parsePatterns } from '@/core/filters/glob';

const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();
const input = 'h-7 w-full rounded-md border border-input bg-background px-2 text-[11px]';

export function AgentsSection() {
  const [prefs, setPrefs] = useState<AgentPrefs | null>(null);
  const [activity, setActivity] = useState<{ byAgent: Record<string, number>; other: number }>({ byAgent: {}, other: 0 });
  const [label, setLabel] = useState('');
  const [pattern, setPattern] = useState('');

  useEffect(() => {
    void agentPrefs.getValue().then(v => setPrefs(normalizePrefs(v)));
    return agentPrefs.watch(v => setPrefs(normalizePrefs(v)));
  }, []);

  const scan = useCallback(() => {
    const authors = registry.all('comment.author', document, { track: false }).map(el => el.textContent?.trim() ?? '');
    setActivity(countByAgent(authors, effectiveAgents(normalizePrefs(prefs))));
  }, [prefs]);

  useEffect(() => {
    if (prefs) scan();
  }, [prefs, scan]);

  if (!prefs) return null;
  const save = (next: AgentPrefs) => agentPrefs.setValue(next);
  const toggle = (id: string, included: boolean) =>
    save({ ...prefs, excluded: included ? prefs.excluded.filter(x => x !== id) : [...prefs.excluded, id] });

  return (
    <section className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Review bots (Copilot and others) that commented on this page. Choose which ones to include in captures and how they are labelled."
      >
        Agents
      </h3>
      <label
        className="flex items-center gap-2 text-xs"
        title="Adds the agent's name (for example **Copilot:**) in front of its comments in the markdown. Each agent can override this in its Settings."
      >
        <input type="checkbox" checked={prefs.labelAgents} onChange={e => save({ ...prefs, labelAgents: e.target.checked })} />
        Label agent comments in the output (default for all agents)
      </label>
      <ul className="space-y-1">
        {effectiveAgents(prefs).map(a => (
          <li key={a.id} className="space-y-1">
            <label className="flex items-center gap-2 text-xs" title={`Tick to include ${a.label}'s comments in captures. Untick to leave them out.`}>
              <input type="checkbox" checked={!prefs.excluded.includes(a.id)} onChange={e => toggle(a.id, e.target.checked)} />
              <span className="flex-1">{a.label}</span>
              <Badge
                title={a.wired ? 'wired: this agent\'s comment layout has been checked and has dedicated handling' : 'placeholder: matched by name and captured with the generic method; its layout has not been checked yet'}
                className={a.wired ? 'border-emerald-500/50' : 'text-muted-foreground'}
              >{a.wired ? 'wired' : 'placeholder'}</Badge>
              <span className="w-6 text-right tabular-nums text-muted-foreground" title="How many comments by this agent are on this page right now">{activity.byAgent[a.id] ?? 0}</span>
            </label>
            <details className="pl-6 text-[10px]">
              <summary className="cursor-pointer text-muted-foreground" title="Label setting and the author names that identify this agent">Settings</summary>
              <label className="mt-1 flex items-center gap-2" title="Whether this agent's comments get its name in front of them in the markdown">
                <span>Label in output</span>
                <select
                  title="Use default: follow the checkbox at the top. Always label / Never label: override it for this agent only."
                  className="h-6 rounded-md border border-input bg-background px-1"
                  value={prefs.labels[a.id] ?? 'inherit'}
                  onChange={e => save({ ...prefs, labels: { ...prefs.labels, [a.id]: e.target.value as LabelSetting } })}
                >
                  <option value="inherit">Use default ({prefs.labelAgents ? 'on' : 'off'})</option>
                  <option value="on">Always label</option>
                  <option value="off">Never label</option>
                </select>
              </label>
              <span className="mt-1 block text-muted-foreground" title="A comment is attributed to this agent when its author name contains one of these words (whole words only, any capitals). One per line.">Matches author names</span>
              <textarea
                key={a.patterns.join('|')}
                title="Author names that identify this agent, one per line. Saved when you click away."
                className="mt-1 h-12 w-full rounded-md border border-input bg-background p-1 font-mono text-[10px]"
                defaultValue={a.patterns.join('\n')}
                onKeyDown={stopKeys}
                onKeyUp={stopKeys}
                onKeyPress={stopKeys}
                onBlur={e => {
                  const patterns = parsePatterns(e.target.value);
                  if (a.id.startsWith('custom:')) {
                    void save({ ...prefs, custom: prefs.custom.map(c => (c.id === a.id ? { ...c, patterns } : c)) });
                  } else {
                    void save({ ...prefs, patterns: { ...prefs.patterns, [a.id]: patterns } });
                  }
                }}
              />
              {a.id.startsWith('custom:') && (
                <Button size="sm" variant="ghost" title="Delete this agent you added" onClick={() => save({ ...prefs, custom: prefs.custom.filter(c => c.id !== a.id) })}>
                  Remove
                </Button>
              )}
            </details>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground" title="The number next to each agent counts its comments on this page.">
        Counts are comment authors on this page ({activity.other} from others). Unchecked agents are left out of
        captures. Only Copilot has dedicated handling; the rest use generic capture.
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground" title="Teach the extension about another review bot">Add an agent</summary>
        <div className="mt-1 space-y-1">
          <input className={input} title="The name shown in the markdown, for example CodeRabbit" placeholder="Name" value={label} onChange={e => setLabel(e.target.value)} onKeyDown={stopKeys} onKeyUp={stopKeys} onKeyPress={stopKeys} />
          <input className={input} title="The author names GitHub shows for this bot, comma separated (for example coderabbitai)" placeholder="Author names, comma separated" value={pattern} onChange={e => setPattern(e.target.value)} onKeyDown={stopKeys} onKeyUp={stopKeys} onKeyPress={stopKeys} />
          <Button
            size="sm"
            variant="outline"
            title="Add this agent to the list"
            disabled={!customAgent(label, pattern)}
            onClick={async () => {
              const a = customAgent(label, pattern);
              if (!a) return;
              await save({ ...prefs, custom: [...prefs.custom.filter(c => c.id !== a.id), a] });
              setLabel('');
              setPattern('');
            }}
          >
            Add
          </Button>
        </div>
      </details>
      <Button size="sm" variant="ghost" title="Count the comments on this page again" onClick={scan}>
        Refresh counts
      </Button>
    </section>
  );
}
