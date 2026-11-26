import { resolve } from 'node:path';
import { defineWebExtConfig } from 'wxt';

// `pnpm dev` otherwise opens a brand-new browser profile every run, which forgets saved selectors and logins.
export default defineWebExtConfig({
  chromiumProfile: resolve('.dev-profile/chromium'),
  firefoxProfile: resolve('.dev-profile/firefox'),
  keepProfileChanges: true,
});
