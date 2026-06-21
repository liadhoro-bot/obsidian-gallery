import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PERF_PORT ?? 3102)
const baseURL = process.env.PERF_BASE_URL ?? `http://127.0.0.1:${port}`
const storageState =
  process.env.PERF_STORAGE_STATE && existsSync(process.env.PERF_STORAGE_STATE)
    ? process.env.PERF_STORAGE_STATE
    : undefined

export default defineConfig({
  testDir: './tests/performance',
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/performance', open: 'never' }],
    ['json', { outputFile: 'test-results/performance-results.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    storageState,
    trace: 'retain-on-failure',
  },
})
