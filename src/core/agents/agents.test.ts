import { describe, expect, it } from 'vitest';
import { BUILTIN_AGENTS, DEFAULT_PREFS, agentOf, countByAgent, customAgent, effectiveAgents, normalizePrefs, resolveLabel } from './agents';

const defs = effectiveAgents(DEFAULT_PREFS);

describe('agentOf', () => {
  it('matches bot logins on whole tokens', () => {
    expect(agentOf('Copilot', defs)?.id).toBe('copilot');
    expect(agentOf('copilot-pull-request-reviewer[bot]', defs)?.id).toBe('copilot');
    expect(agentOf('coderabbitai[bot]', defs)).toBeNull();
    expect(agentOf('claude[bot]', defs)?.id).toBe('claude');
    expect(agentOf('gemini-code-assist[bot]', defs)?.id).toBe('gemini');
  });
  it('does not match inside other names or empty authors', () => {
    expect(agentOf('claudette', defs)).toBeNull();
    expect(agentOf('sam', defs)).toBeNull();
    expect(agentOf('', defs)).toBeNull();
  });
  it('lets the user override patterns and add custom agents', () => {
    const d = effectiveAgents({ excluded: [], patterns: { coderabbit: ['coderabbitai'] }, custom: [customAgent('Internal Bot', 'acme-review, acme-lint')!], labelAgents: true, labels: {} });
    expect(agentOf('coderabbitai[bot]', d)?.id).toBe('coderabbit');
    expect(agentOf('acme-lint', d)?.label).toBe('Internal Bot');
  });
});

describe('helpers', () => {
  it('counts activity per agent and everyone else', () => {
    expect(countByAgent(['Copilot', 'Copilot', 'sam', 'claude[bot]', ''], defs)).toEqual({ byAgent: { copilot: 2, claude: 1 }, other: 1 });
  });
  it('only Copilot is wired', () => {
    expect(BUILTIN_AGENTS.filter(a => a.wired).map(a => a.id)).toEqual(['copilot']);
  });
  it('rejects empty custom agents', () => {
    expect(customAgent('', 'x')).toBeNull();
    expect(customAgent('X', ' , ')).toBeNull();
  });
});

describe('label preferences', () => {
  it('defaults to labelling, with a global switch and per-agent overrides', () => {
    expect(resolveLabel(DEFAULT_PREFS, 'copilot')).toBe(true);
    const off = { ...DEFAULT_PREFS, labelAgents: false, labels: { copilot: 'on' as const, claude: 'inherit' as const } };
    expect(resolveLabel(off, 'copilot')).toBe(true);
    expect(resolveLabel(off, 'claude')).toBe(false);
    expect(resolveLabel(off, 'gemini')).toBe(false);
    expect(resolveLabel(off, undefined)).toBe(false);
    const on = { ...DEFAULT_PREFS, labels: { copilot: 'off' as const } };
    expect(resolveLabel(on, 'copilot')).toBe(false);
    expect(resolveLabel(on, 'claude')).toBe(true);
  });
  it('fills in fields missing from older stored prefs', () => {
    expect(normalizePrefs({ excluded: ['x'] } as never)).toEqual({ ...DEFAULT_PREFS, excluded: ['x'] });
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
  });
});

