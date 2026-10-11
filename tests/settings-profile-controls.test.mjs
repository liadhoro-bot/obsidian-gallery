import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('current settings account card exposes working profile controls', () => {
  const settings = read('../app/settings/settings-v3-preview.tsx')

  assert.match(settings, /<form action=\{updateAvatar\}>/)
  assert.match(settings, /<AvatarUploadInput \/>/)
  assert.match(settings, /<SettingsProfileEditor/)
  assert.match(settings, /username=\{user\.username \|\| 'No username yet'\}/)
})

test('profile editor submits username changes through the profile action', () => {
  const editor = read('../app/settings/settings-profile-editor.tsx')
  const actions = read('../app/settings/settings-actions.ts')

  assert.match(editor, /useActionState\(updateProfileAction, initialState\)/)
  assert.match(editor, /name="username"/)
  assert.match(actions, /\.from\('profiles'\)[\s\S]*\.update\(\{ username \}\)/)
})
