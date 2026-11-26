import { browser } from 'wxt/browser';

const PAGE = 'pr-sidebar.html';
const TITLE = 'PR Companion';

if (import.meta.env.FIREFOX) {
  const create = browser.devtools.panels.elements.createSidebarPane as unknown as (
    title: string,
  ) => Promise<{ setPage(path: string): void }>;
  void create(TITLE).then(pane => pane.setPage(PAGE));
} else {
  browser.devtools.panels.elements.createSidebarPane(TITLE, pane => pane.setPage(PAGE));
}
