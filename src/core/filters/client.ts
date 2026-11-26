import { browser } from 'wxt/browser';
import type { BgMsg, FetchReply } from '../bridge/messages';

export async function fetchFileViaBackground(repo: string, ref: string, path: string): Promise<FetchReply> {
  try {
    return (await browser.runtime.sendMessage({ type: 'fetch-file', repo, ref, path } satisfies BgMsg)) as FetchReply;
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message };
  }
}
