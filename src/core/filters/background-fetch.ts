import type { FetchReply } from '../bridge/messages';
import { isSafeRepoPath, rawUrl } from './fetch';

export interface FetchDeps {
  hasPermission: (origin: string) => Promise<boolean>;
  fetchFn: (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;
}

export const rawOriginFor = (org: string) => `https://raw.githubusercontent.com/${org}/*`;

/** Runs in the background worker. Refuses unless the user granted that org's raw.githubusercontent.com access. */
export async function handleFetchFile(
  msg: { repo: string; ref: string; path: string },
  { hasPermission, fetchFn }: FetchDeps,
): Promise<FetchReply> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(msg.repo) || !isSafeRepoPath(msg.path) || !msg.ref || msg.ref.length > 200) {
    return { ok: false, reason: 'error', message: 'invalid request' };
  }
  const org = msg.repo.split('/')[0];
  if (!(await hasPermission(rawOriginFor(org)))) {
    return {
      ok: false,
      reason: 'permission',
      message: `Reading ${org} files is not allowed yet. Open the extension popup, Access tab, and click Allow.`,
    };
  }
  try {
    const res = await fetchFn(rawUrl('https://github.com', msg.repo, msg.ref, msg.path), {
      credentials: 'include',
      redirect: 'follow',
    });
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    return res.ok ? { ok: true, text: await res.text() } : { ok: false, reason: 'error', message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message };
  }
}
