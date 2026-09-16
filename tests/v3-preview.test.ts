import assert from 'node:assert/strict'
import test from 'node:test'
import {
  V3_PREVIEW_COOKIE,
  canUseV3PreviewParam,
  canUseV3PreviewCookie,
  hasV3PreviewDocumentSession,
  isV3DeploymentHost,
} from '../lib/v3-preview'

test('the original production alias now uses v3, including existing PWA launches', () => {
  assert.equal(isV3DeploymentHost('obsidian-gallery-rust.vercel.app'), true)
  assert.equal(
    hasV3PreviewDocumentSession(
      `${V3_PREVIEW_COOKIE}=1; other=value`,
      'obsidian-gallery-rust.vercel.app'
    ),
    true
  )
})

test('v3 preview cookies are only trusted on v3 and local preview hosts', () => {
  assert.equal(canUseV3PreviewCookie('obsidian-gallery-v3.vercel.app'), true)
  assert.equal(canUseV3PreviewCookie('obsidian-gallery-v3-git-main.vercel.app'), true)
  assert.equal(canUseV3PreviewCookie('localhost:3000'), true)
  assert.equal(canUseV3PreviewCookie('127.0.0.1:3000'), true)
  assert.equal(canUseV3PreviewCookie('obsidian-gallery-rust.vercel.app'), true)
  assert.equal(canUseV3PreviewCookie('unrelated.vercel.app'), false)
})

test('v3 preview query params work on both production aliases and local development', () => {
  assert.equal(canUseV3PreviewParam('obsidian-gallery-rust.vercel.app', '1'), true)
  assert.equal(canUseV3PreviewParam('obsidian-gallery-rust.vercel.app', 'true'), true)
  assert.equal(canUseV3PreviewParam('unrelated.vercel.app', '1'), false)
  assert.equal(canUseV3PreviewParam('localhost:3000', '1'), true)
  assert.equal(canUseV3PreviewParam('obsidian-gallery-v3.vercel.app', '1'), true)
})
