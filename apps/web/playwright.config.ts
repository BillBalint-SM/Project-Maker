import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node e2e/start-api-for-e2e.mjs',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec ng serve --host 127.0.0.1 --port 4200 --prebundle=false',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
