import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_CONFIG_PATHS, detectJest, readPrRef } from '@/core/filters/detect';
import { fetchFileViaBackground } from '@/core/filters/client';
import { parsePatterns } from '@/core/filters/glob';
import { currentRepo, getLayers, getUserLayers, runner, saveUserLayers, tempLayer } from '@/core/filters/instance';
import { LIST_HINTS, LIST_LABELS, type Layer } from '@/core/filters/lists';
import { PACKS, folderLayer, packLayer, packLayerId } from '@/core/filters/packs';
import { headSha, openAndReadCommits } from '@/core/commits';
import { registry } from '@/core/instance';

const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();
const area = 'w-full rounded-md border border-input bg-background p-2 font-mono text-[10px] leading-snug';

export function PatternsSection() {
  const [list, setList] = useState('tests');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [configs, setConfigs] = useState(DEFAULT_CONFIG_PATHS.join('\n'));
  const [ref, setRef] = useState('');
  const [folder, setFolder] = useState('');
  const [, bump] = useState(0);
  const repo = currentRepo();

  const upsert = async (layer: Layer) => {
    const rest = getUserLayers().filter(l => l.id !== layer.id);
    const existing = getUserLayers().find(l => l.id === layer.id);
    await saveUserLayers([...rest, { ...layer, lists: { ...(existing?.lists ?? {}), ...layer.lists } }]);
  };

  const applyTemp = () => {
    tempLayer.lists = { ...tempLayer.lists, [list]: parsePatterns(text) };
    runner.refresh();
    setMsg(`Temporary ${list} patterns: ${parsePatterns(text).length}`);
    bump(n => n + 1);
  };

  const save = async (kind: 'repo' | 'global') => {
    const patterns = parsePatterns(text);
    await upsert(
      kind === 'repo'
        ? { id: `repo:${repo}`, label: `Repo ${repo}`, kind: 'repo', repo, lists: { [list]: patterns } }
        : { id: 'global', label: 'Global', kind: 'global', lists: { [list]: patterns } },
    );
    setMsg(`Saved ${patterns.length} ${list} pattern(s) ${kind === 'repo' ? `for ${repo}` : 'globally'}`);
    bump(n => n + 1);
  };

  const togglePack = async (id: string, on: boolean) => {
    const pack = PACKS.find(p => p.id === id)!;
    const layerId = packLayerId(repo, id);
    const rest = getUserLayers().filter(l => l.id !== layerId);
    await saveUserLayers(on ? [...rest, packLayer(repo, pack)] : rest);
    bump(n => n + 1);
  };

  const saveFolder = async () => {
    const patterns = parsePatterns(text);
    if (!folder.trim() || !patterns.length) return setMsg('Enter a folder and at least one pattern above.');
    await upsert(folderLayer(repo, folder, list, patterns));
    setMsg(`Saved ${patterns.length} ${list} pattern(s) for ${folder.trim()}/ (patterns are relative to that folder)`);
    bump(n => n + 1);
  };

  const detect = async () => {
    const useRef = ref.trim() || readPrRef(registry);
    setMsg(`Reading config from ${useRef}…`);
    let needsPermission = '';
    const { layers, notes } = await detectJest(repo, parsePatterns(configs), async p => {
      const r = await fetchFileViaBackground(repo, useRef, p);
      if (r.reason === 'permission') needsPermission = r.message ?? '';
      return r.ok ? (r.text ?? null) : null;
    });
    if (layers.length) {
      const ids = new Set(layers.map(l => l.id));
      await saveUserLayers([...getUserLayers().filter(l => !ids.has(l.id)), ...layers]);
    }
    setMsg([needsPermission, `Ref ${useRef}: ${layers.length} Jest layer(s) saved`, ...notes].filter(Boolean).join('\n'));
    bump(n => n + 1);
  };

  return (
    <section className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        title="Teach the extension which files count as tests, snapshots, images and so on. The Files changed buttons use these lists."
      >
        File patterns
      </h3>
      <select
        title="Which list to edit. The Files changed buttons (Hide tests, Hide snapshots, Hide images...) use these lists."
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        value={list}
        onChange={e => setList(e.target.value)}
      >
        {Object.entries(LIST_LABELS).map(([id, label]) => (
          <option key={id} value={id} title={LIST_HINTS[id] ?? label}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        className={`${area} h-16`}
        spellCheck={false}
        title={'Patterns to add to the chosen list, one per line (or comma separated). Stars work like a file search: **/*.stories.tsx matches any such file anywhere. Start a line with ! to exclude. Capitals are ignored.'}
        placeholder={'One glob per line, e.g.\n**/*.stories.tsx\n!src/keep.test.ts'}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={stopKeys}
        onKeyUp={stopKeys}
        onKeyPress={stopKeys}
      />
      <div className="grid grid-cols-3 gap-1">
        <Button size="sm" variant="secondary" title="Use these patterns on this PR only. They are forgotten when you open another PR." onClick={applyTemp}>
          Temporary
        </Button>
        <Button size="sm" variant="outline" disabled={!repo} title="Save these patterns for this repository, so they apply to every PR in it." onClick={() => save('repo')}>
          This repo
        </Button>
        <Button size="sm" variant="outline" title="Save these patterns for every repository." onClick={() => save('global')}>
          Global
        </Button>
      </div>
      <div className="flex gap-1">
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[10px]"
          title="For monorepos: a folder these patterns belong to, for example apps/ios. The patterns above are then relative to that folder."
          placeholder="Folder only, e.g. apps/ios"
          value={folder}
          onChange={e => setFolder(e.target.value)}
          onKeyDown={stopKeys}
          onKeyUp={stopKeys}
          onKeyPress={stopKeys}
        />
        <Button size="sm" variant="outline" disabled={!repo} title="Save the patterns above for that folder only (relative to it)." onClick={saveFolder}>
          Folder only
        </Button>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground" title="Ready-made patterns for iOS, Android and end-to-end test setups. Tick the ones this repo uses.">Stack packs for this repo</summary>
        <ul className="mt-1 space-y-1">
          {PACKS.map(p => (
            <li key={p.id}>
              <label className="flex items-start gap-2 text-[11px]" title={`${p.label}: ${p.hint}. Applies to this repo only. These are starting points, not guarantees.`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!repo}
                  checked={getUserLayers().some(l => l.id === packLayerId(repo, p.id))}
                  onChange={e => togglePack(p.id, e.target.checked)}
                />
                <span>
                  {p.label}
                  <span className="block text-[10px] text-muted-foreground">{p.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Starting points only. Mixed or monorepo? Enable several, then use "Folder only" for per-folder rules.
        </p>
      </details>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground" title="Shows every set of patterns that feeds this list, in order. Later ones win over earlier ones.">Effective layers for {LIST_LABELS[list] ?? list}</summary>
        <ul className="mt-1 space-y-1 font-mono text-[10px]">
          {getLayers()
            .filter(l => l.lists[list]?.length)
            .map(l => (
              <li key={l.id}>
                <span className="font-semibold">{l.label}</span>
                {l.pathPrefix ? ` (${l.pathPrefix}/)` : ''}: {l.lists[list].join('  ')}
              </li>
            ))}
        </ul>
      </details>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground" title="Reads your jest config from the repo to learn which files are tests. The config is read as text and never run.">Detect from Jest config</summary>
        <div className="mt-1 space-y-1">
          <textarea className={`${area} h-16`} title="Paths of jest configs in the repo, one per line. Add package configs for monorepos, for example packages/store/jest.config.ts." spellCheck={false} value={configs} onChange={e => setConfigs(e.target.value)} onKeyDown={stopKeys} onKeyUp={stopKeys} onKeyPress={stopKeys} />
          <div className="flex gap-1">
            <input
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[10px]"
              title="Which version of the repo to read the config from: a commit id or branch. Leave empty to use the PR's newest commit."
              placeholder="ref (default: PR head)"
              value={ref}
              onChange={e => setRef(e.target.value)}
              onKeyDown={stopKeys}
              onKeyUp={stopKeys}
              onKeyPress={stopKeys}
            />
            <Button
              size="sm"
              variant="outline"
              title="Open the commit picker on Files changed and use the newest commit"
              onClick={async () => {
                const sha = headSha(await openAndReadCommits(registry));
                if (sha) setRef(sha);
                else setMsg('No commit list found (Files changed tab only).');
              }}
            >
              Head
            </Button>
          </div>
          <Button size="sm" variant="outline" disabled={!repo} title="Read the configs above and add their test patterns as a layer for this repo. The first time you need to allow access in the extension popup (Access tab)." onClick={detect}>
            Detect
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Add monorepo package configs as paths (e.g. packages/store/jest.config.ts). Files are read with your
            GitHub session. The first time, allow access in the popup (Access tab). JS/TS configs are scanned, never run.
          </p>
        </div>
      </details>
      {msg && <p className="whitespace-pre-wrap text-[10px]">{msg}</p>}
    </section>
  );
}
