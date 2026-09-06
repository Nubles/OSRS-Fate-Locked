import { defineConfig, devices } from '@playwright/test';
declare const process: { env: Record<string, string | undefined> };

const runeProofPreview = process.env.RUNEPROOF_BROWSER_PREVIEW === '1';

const baseURL = `http://127.0.0.1:4191${process.env.VITE_BASE || '/'}`;

export default defineConfig({
  testDir: './browser-tests',
  testIgnore: runeProofPreview ? [] : ['**/runeproof-source.spec.ts', '**/runeproof.spec.ts'],
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/browser-results.json' }]],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port 4191 --strictPort${runeProofPreview ? ' --outDir dist-runeproof-preview' : ''}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
