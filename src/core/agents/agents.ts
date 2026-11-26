export interface AgentDef {
  id: string;
  label: string;
  patterns: string[];
  wired: boolean;
}

export type LabelSetting = 'inherit' | 'on' | 'off';

export interface AgentPrefs {
  excluded: string[];
  patterns: Record<string, string[]>;
  custom: AgentDef[];
  labelAgents: boolean;
  /** Per-agent override of the global default. */
  labels: Record<string, LabelSetting>;
}

export const DEFAULT_PREFS: AgentPrefs = { excluded: [], patterns: {}, custom: [], labelAgents: true, labels: {} };

/** Stored prefs from older versions may lack newer fields. */
export const normalizePrefs = (p: Partial<AgentPrefs> | null | undefined): AgentPrefs => ({ ...DEFAULT_PREFS, ...(p ?? {}) });

export function resolveLabel(prefs: AgentPrefs, agentId: string | undefined): boolean {
  const own = agentId ? prefs.labels[agentId] : undefined;
  return own === 'on' ? true : own === 'off' ? false : prefs.labelAgents;
}

/** Only Copilot has dedicated handling; the others use generic capture and are placeholders for now. */
export const BUILTIN_AGENTS: AgentDef[] = [
  { id: 'copilot', label: 'Copilot', patterns: ['copilot'], wired: true },
  { id: 'coderabbit', label: 'CodeRabbit', patterns: ['coderabbit'], wired: false },
  { id: 'claude', label: 'Claude', patterns: ['claude'], wired: false },
  { id: 'codex', label: 'Codex', patterns: ['codex'], wired: false },
  { id: 'gemini', label: 'Gemini', patterns: ['gemini'], wired: false },
  { id: 'sourcery', label: 'Sourcery', patterns: ['sourcery'], wired: false },
];

export function effectiveAgents(prefs: AgentPrefs): AgentDef[] {
  const builtin = BUILTIN_AGENTS.map(a => ({ ...a, patterns: prefs.patterns[a.id]?.length ? prefs.patterns[a.id] : a.patterns }));
  return [...builtin, ...prefs.custom];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Token match, so "claude" hits "claude[bot]" and "claude-code" but not "claudette". */
export function agentOf(author: string, defs: AgentDef[]): AgentDef | null {
  const name = author.trim().toLowerCase();
  if (!name) return null;
  for (const def of defs) {
    for (const p of def.patterns) {
      const pat = p.trim().toLowerCase();
      if (pat && new RegExp(`(^|[^a-z0-9])${escapeRe(pat)}([^a-z0-9]|$)`).test(name)) return def;
    }
  }
  return null;
}

export function countByAgent(authors: string[], defs: AgentDef[]): { byAgent: Record<string, number>; other: number } {
  const byAgent: Record<string, number> = {};
  let other = 0;
  for (const a of authors) {
    const def = agentOf(a, defs);
    if (def) byAgent[def.id] = (byAgent[def.id] ?? 0) + 1;
    else if (a.trim()) other++;
  }
  return { byAgent, other };
}

export function customAgent(label: string, patternText: string): AgentDef | null {
  const l = label.trim();
  const patterns = patternText.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
  if (!l || !patterns.length) return null;
  const id = `custom:${l.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return { id, label: l, patterns, wired: false };
}
