import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadNominationGallery } from '../../lib/contests/nomination-gallery'

type Row = Record<string, unknown>
function client(tables: Record<string, Row[]>) {
  return { from(table: string) {
    let rows = tables[table] ?? []
    const query = {
      select() { return query },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query },
      order() { return query },
      async maybeSingle() { return { data: rows[0] ?? null, error: null } },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve) },
    }
    return query
  } } as unknown as SupabaseClient
}

function fixture(options: { visible?: boolean; status?: string; viewerId?: string; sourceOwner?: string; type?: string } = {}) {
  const type = options.type ?? 'project'
  let serviceReads = 0
  const source = { id: 'source', user_id: options.sourceOwner ?? 'owner' }
  const images = Array.from({ length: 4 }, (_, index) => ({
    id: `photo-${index}`, entity_type: type, entity_id: 'source', user_id: 'owner', image_url: `/photo-${index}.jpg`,
  }))
  const service = client({ projects: [source], units: [source], image_assets: [
    ...images,
    { id: 'private', entity_type: type, entity_id: 'other', user_id: 'owner' },
    { id: 'wrong-owner', entity_type: type, entity_id: 'source', user_id: 'someone-else' },
    { id: 'wrong-type', entity_type: 'recipe', entity_id: 'source', user_id: 'owner' },
  ] })
  const access = {
    viewer: client({ contest_nominations: [{ id: 'entry', contest_id: 'contest', status: options.status ?? 'approved', owner_user_id: 'owner', source_type: type, source_project_id: 'source', source_unit_id: 'source' }] }),
    viewerId: options.viewerId ?? null,
    canViewContest: async () => options.visible ?? true,
    createService: () => { serviceReads++; return service },
  }
  return { access, serviceReads: () => serviceReads }
}

for (const type of ['project', 'unit']) {
  test(`visible approved ${type} includes all four photos and excludes unrelated assets`, async () => {
    const f = fixture({ type })
    const images = await loadNominationGallery('contest', 'entry', f.access)
    assert.deepEqual(images.map(image => image.id), ['photo-0', 'photo-1', 'photo-2', 'photo-3'])
  })
}

for (const status of ['pending', 'rejected', 'withdrawn', 'disqualified']) {
  test(`${status} entry does not expose photos to another viewer`, async () => {
    const f = fixture({ status, viewerId: 'other' })
    assert.deepEqual(await loadNominationGallery('contest', 'entry', f.access), [])
    assert.equal(f.serviceReads(), 0)
  })
}

test('private contest denies privileged reads', async () => {
  const f = fixture({ visible: false })
  assert.deepEqual(await loadNominationGallery('contest', 'entry', f.access), [])
  assert.equal(f.serviceReads(), 0)
})
test('entry cannot be accessed through a different contest', async () => {
  const f = fixture()
  assert.deepEqual(await loadNominationGallery('another-contest', 'entry', f.access), [])
  assert.equal(f.serviceReads(), 0)
})
test('owner can preview their pending nomination', async () => {
  const f = fixture({ status: 'pending', viewerId: 'owner' })
  assert.equal((await loadNominationGallery('contest', 'entry', f.access)).length, 4)
})
test('a transferred source no longer exposes its gallery via the old nomination', async () => {
  const f = fixture({ sourceOwner: 'new-owner' })
  assert.deepEqual(await loadNominationGallery('contest', 'entry', f.access), [])
})
test('guide nominations do not grant privileged gallery access', async () => {
  const f = fixture({ type: 'guide' })
  assert.deepEqual(await loadNominationGallery('contest', 'entry', f.access), [])
  assert.equal(f.serviceReads(), 0)
})
