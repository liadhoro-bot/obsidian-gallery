import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.QA_PORT ?? 3202)
const baseURL = process.env.QA_BASE_URL ?? `http://127.0.0.1:${port}`
const defaultStorageStatePath = resolve('.qa/functional-storage-state.json')
const storageState =
  (process.env.QA_STORAGE_STATE &&
    existsSync(process.env.QA_STORAGE_STATE) &&
    process.env.QA_STORAGE_STATE) ||
  (existsSync(defaultStorageStatePath) ? defaultStorageStatePath : undefined)

export default defineConfig({
  testDir: './tests/functional',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/functional', open: 'never' }],
    ['json', { outputFile: 'test-results/functional-results.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    storageState,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
