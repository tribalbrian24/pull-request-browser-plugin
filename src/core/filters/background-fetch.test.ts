import { describe, expect, it } from 'vitest';
import { handleFetchFile, rawOriginFor } from './background-fetch';

const msg = { repo: 'acme/widgets', ref: 'abc1234', path: 'package.json' };
const res = (status: number, body = '') => async () => ({ ok: status >= 200 && status < 300, status, text: async () => body });

describe('handleFetchFile', () => {
  it('refuses until the org permission is granted and never fetches', async () => {
    let fetched = false;
    const asked: string[] = [];
    const r = await handleFetchFile(msg, {
      hasPermission: async o => {
        asked.push(o);
        return false;
      },
      fetchFn: async () => {
        fetched = true;
        return { ok: true, status: 200, text: async () => '' };
      },
    });
    expect(r.reason).toBe('permission');
    expect(r.message).toMatch(/Access tab/);
    expect(fetched).toBe(false);
    expect(asked).toEqual(['https://raw.githubusercontent.com/acme/*']);
  });

  it('fetches the same-origin raw URL with credentials once allowed', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const r = await handleFetchFile(msg, {
      hasPermission: async () => true,
      fetchFn: async (u, i) => {
        url = u;
        init = i;
        return { ok: true, status: 200, text: async () => '{"jest":{}}' };
      },
    });
    expect(r).toEqual({ ok: true, text: '{"jest":{}}' });
    expect(url).toBe('https://github.com/acme/widgets/raw/abc1234/package.json');
    expect(init?.credentials).toBe('include');
  });

  it('maps 404, other statuses and exceptions', async () => {
    const allow = { hasPermission: async () => true };
    expect((await handleFetchFile(msg, { ...allow, fetchFn: res(404) })).reason).toBe('not-found');
    expect((await handleFetchFile(msg, { ...allow, fetchFn: res(500) })).message).toBe('HTTP 500');
    expect((await handleFetchFile(msg, { ...allow, fetchFn: async () => { throw new Error('net'); } })).message).toBe('net');
  });

  it('rejects malformed requests before asking for anything', async () => {
    let asked = false;
    const deps = { hasPermission: async () => ((asked = true), true), fetchFn: res(200) };
    for (const bad of [{ ...msg, path: '../x' }, { ...msg, repo: 'a b/c' }, { ...msg, ref: '' }]) {
      expect((await handleFetchFile(bad, deps)).reason).toBe('error');
    }
    expect(asked).toBe(false);
  });

  it('scopes the permission to one org', () => {
    expect(rawOriginFor('acme')).toBe('https://raw.githubusercontent.com/acme/*');
  });
});
