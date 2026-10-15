import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT || 5173)
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port ' + port,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
