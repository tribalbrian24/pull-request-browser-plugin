import { browser } from 'wxt/browser';
import { storage } from '#imports';
import type { BgMsg } from '@/core/bridge/messages';
import type { DoctorReport } from '@/core/doctor/checks';
import { handleFetchFile } from '@/core/filters/background-fetch';

const COLORS = { error: '#d1242f', warn: '#bf8700' } as const;

export default defineBackground(() => {
  const action = browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;

  const setBadge = async (tabId: number, level: DoctorReport['level']) => {
    await action.setBadgeText({ tabId, text: level === 'ok' ? '' : '!' });
    if (level !== 'ok') await action.setBadgeBackgroundColor({ tabId, color: COLORS[level] });
  };

  browser.runtime.onMessage.addListener((msg: BgMsg, sender, sendResponse) => {
    if (msg.type === 'doctor:report') {
      const tabId = sender.tab?.id;
      if (tabId != null) {
        void storage.setItem(`session:doctor:${tabId}`, msg.report);
        void setBadge(tabId, msg.report.level);
      }
      return false;
    }
    if (msg.type === 'relay') {
      browser.tabs.sendMessage(msg.tabId, msg.payload).then(sendResponse, e => sendResponse({ ok: false, message: String(e) }));
      return true;
    }
    if (msg.type === 'fetch-file') {
      void handleFetchFile(msg, {
        hasPermission: origin => browser.permissions.contains({ origins: [origin] }),
        fetchFn: (url, init) => fetch(url, init),
      }).then(sendResponse);
      return true;
    }
    return false;
  });

  browser.tabs.onRemoved.addListener(tabId => void storage.removeItem(`session:doctor:${tabId}`));
});
