import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Relative base so the same build works locally and on GitHub Pages project sites.
  base: './',
  publicDir: 'public',
  server: {
    // 3100, not 3000: another of Chris's projects sits on 3000, and Vite's default
    // is to slide quietly to the next free port — which had the whole test suite
    // asserting against a different app. strictPort makes a clash fail loudly.
    port: 3100,
    strictPort: true,
    open: true,
  },
  build: { outDir: 'dist' },
});
