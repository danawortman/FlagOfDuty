import { defineConfig, devices } from '@playwright/test';

// Fixed viewport and scale so the screenshot baselines are comparable run to run.
// Baselines are per platform ({platform} in the path): text rasterizes differently
// on Windows and Linux, so each OS keeps its own set.
export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/report' }]],
  outputDir: 'test-results/artifacts',
  expect: {
    // Strict, so that small colour changes fail the comparison.
    toHaveScreenshot: { threshold: 0.02, maxDiffPixels: 40, animations: 'disabled' },
  },
  use: {
    baseURL: 'http://localhost:5191',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } }],
  webServer: {
    // Its own port, never reused, so a dev server left open cannot be tested by mistake.
    command: 'npx vite --port 5191 --strictPort',
    url: 'http://localhost:5191',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
