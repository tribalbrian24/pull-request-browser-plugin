import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Capture tests wait for real timers (menus, collapsed threads), so allow more than the 5s default.
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 },
});
