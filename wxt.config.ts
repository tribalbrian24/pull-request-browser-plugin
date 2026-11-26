import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // Not a dot-folder: Chrome's "Load unpacked" picker hides hidden folders (.output).
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  // Keep source maps and readable code in every build so errors point at real source lines.
  vite: () => ({ build: { sourcemap: true, minify: false } }),
  manifest: ({ browser, command, manifestVersion }) => ({
    name: 'PR Review Companion',
    description: 'Capture PR review feedback as markdown and filter Files changed. Local only, no network.',
    permissions: ['storage', 'clipboardWrite'],
    host_permissions: ['https://github.com/*'],
    // Never granted at install: the popup's Access tab asks, per org, when the user clicks Allow.
    ...(manifestVersion === 3
      ? { optional_host_permissions: ['https://raw.githubusercontent.com/*'] }
      : { optional_permissions: ['https://raw.githubusercontent.com/*'] }),
    ...(manifestVersion === 3 && command === 'build'
      ? { content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'" } }
      : {}),
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'pr-review-companion@local',
              data_collection_permissions: { required: ['none'] },
            },
          } as never,
        }
      : {}),
  }),
});
