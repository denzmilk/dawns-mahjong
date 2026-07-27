import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  workers: 4,
  use: {
    baseURL: 'http://localhost:3100',
    // Dawn plays on a tablet in landscape, so that is the viewport every test
    // runs at. Desktop-sized runs would pass while the real board was unusable
    // — legibility is an acceptance criterion here, not polish (ADR-0002).
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
    isMobile: false,
    deviceScaleFactor: 2,
  },
  webServer: {
    command: 'npm run dev -- --no-open',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
