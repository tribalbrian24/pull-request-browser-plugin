import { browser } from 'wxt/browser';
import { createRoot, type Root } from 'react-dom/client';
import '@/assets/tailwind.css';
import { createPageHandler } from '@/core/bridge/handler';
import type { PageMsg } from '@/core/bridge/messages';
import { reportDoctor } from '@/core/doctor/report';
import { onNavigate } from '@/core/filters/instance';
import { InspectSession } from '@/core/inspect/session';
import { registry } from '@/core/instance';
import { isPrPath } from '@/core/pr';
import { locatorOverrides } from '@/core/storage';
import { Panel } from '@/ui/Panel';

export default defineContentScript({
  matches: ['https://github.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let ui: { remove(): void } | null = null;

    const handle = createPageHandler({
      reg: registry,
      session: new InspectSession(),
      persist: v => locatorOverrides.setValue(v),
      readBack: () => locatorOverrides.getValue(),
      doctor: reportDoctor,
    });
    const onMessage = (msg: PageMsg, _sender: unknown, sendResponse: (r: unknown) => void) => {
      void handle(msg).then(sendResponse);
      return true;
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onMessage));

    const sync = async (url: string | URL) => {
      const onPr = isPrPath(new URL(url).pathname);
      onNavigate(new URL(url).pathname);
      if (onPr && !ui) {
        const created = await createShadowRootUi<Root>(ctx, {
          name: 'prc-panel',
          position: 'inline',
          anchor: 'body',
          append: 'last',
          onMount: container => {
            const root = createRoot(container);
            root.render(<Panel />);
            return root;
          },
          onRemove: root => root?.unmount(),
        });
        created.mount();
        ui = created;
      } else if (!onPr && ui) {
        ui.remove();
        ui = null;
      }
      ctx.setTimeout(() => void reportDoctor(), 1500);
    };

    await sync(location.href);
    ctx.addEventListener(window, 'wxt:locationchange', e => void sync(e.newUrl));
  },
});
