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
    // 1, not 2: headless Chromium falls back to software GL, and rasterising a
    // 2560×1600 buffer per frame took ~375 ms — which made the animated milestones
    // crawl and time out. Everything asserted here is measured in CSS pixels (dp),
    // which is exactly what the tablet presents, so the render resolution is not
    // part of what these tests are checking. A real GPU is unaffected either way.
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npm run dev -- --no-open',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
