import assert from 'node:assert/strict'
import test from 'node:test'
import type { User } from '@supabase/supabase-js'
import {
  parseForwardedUser,
  serializeForwardedUser,
} from '../lib/auth/forwarded-user'

test('verified proxy user survives the internal header round trip', () => {
  const user = {
    id: 'user-1',
    email: 'person@example.com',
    created_at: '2026-09-27T00:00:00.000Z',
    user_metadata: {
      full_name: 'Test Person',
      terms_accepted_at: '2026-09-26T00:00:00.000Z',
      unrelated_large_value: 'not forwarded',
    },
  } as unknown as User

  const parsed = parseForwardedUser(serializeForwardedUser(user))

  assert.equal(parsed?.id, user.id)
  assert.equal(parsed?.email, user.email)
  assert.equal(parsed?.created_at, user.created_at)
  assert.deepEqual(parsed?.user_metadata, {
    full_name: 'Test Person',
    terms_accepted_at: '2026-09-26T00:00:00.000Z',
  })
})

test('malformed internal user headers are rejected', () => {
  assert.equal(parseForwardedUser(null), null)
  assert.equal(parseForwardedUser('not-json'), null)
  assert.equal(parseForwardedUser(encodeURIComponent('{}')), null)
})
