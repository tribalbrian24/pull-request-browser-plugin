import { installClipboardHook } from '@/core/clipboardHook';

export default defineContentScript({
  matches: ['https://github.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main: installClipboardHook,
});
