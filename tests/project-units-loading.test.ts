import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getProjectUnits } from '../app/projects/[id]/project-units-data'

test('deduplicates direct/linked units while excluding inactive and foreign-owned units', async () => {
  const units = [
    { id: 'a', user_id: 'owner', project_id: 'project', is_active: true, created_at: '2026-01-01', name: 'A', updated_at: '2026-01-01' },
    { id: 'b', user_id: 'owner', project_id: null, is_active: true, created_at: '2026-02-01', name: 'B', updated_at: '2026-02-01' },
    { id: 'inactive', user_id: 'owner', project_id: 'project', is_active: false },
    { id: 'foreign', user_id: 'other', project_id: 'project', is_active: true },
  ]
  const links = ['a', 'b', 'foreign'].map(unit_id => ({ unit_id, user_id: 'owner', project_id: 'project' }))
  const requests: string[] = []
  const client = { from(table: string) {
    let rows = [...(table === 'units' ? units : links)] as Record<string, unknown>[]
    const query = {
      select() { return query },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query },
      in(key: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[key])); return query },
      order(key: string, { ascending }: { ascending: boolean }) { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)); return query },
      then(resolve: (result: unknown) => unknown) { requests.push(table); return Promise.resolve({ data: rows, error: null }).then(resolve) },
    }
    return query
  } } as unknown as SupabaseClient
  const result = await getProjectUnits(client, 'project', 'owner', 'units')
  assert.deepEqual(result.ids, ['a', 'b'])
  assert.deepEqual(result.units.map(unit => unit.name), ['B', 'A'])
  assert.equal(requests.filter(table => table === 'units').length, 2, 'candidate lookup plus display rows; no third units fetch')
  const details = await getProjectUnits(client, 'project', 'owner', 'details')
  assert.deepEqual(details.ids, ['a', 'b'])
  assert.deepEqual(details.units, [])
})
