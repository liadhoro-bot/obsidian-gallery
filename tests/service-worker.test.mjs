import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

function worker({ fullCache = false } = {}) {
  const handlers = {}
  const stores = new Map()
  const calls = []
  let offline = false
  const scope = {
    URL,
    self: {location: new URL('https://obsidian-gallery-rust.vercel.app'), addEventListener: (name, handler) => { handlers[name] = handler }},
    caches: {open: async name => {
      if (!stores.has(name)) stores.set(name,new Map())
      const store = stores.get(name)
      return {match: async request => store.get(request.url ?? request), put: async (request,response) => {
        if (fullCache) throw new Error('Quota exceeded')
        store.set(request.url ?? request,response)
      }}
    }},
    fetch: async request => {
      calls.push(request.url)
      if (offline) throw new Error('offline')
      return new Response(`network-${calls.length}`)
    },
  }
  runInNewContext(readFileSync('public/sw.js','utf8'),scope)
  return { calls, setOffline: () => { offline = true }, async fetch(path, overrides = {}) {
    const request = {url: new URL(path,scope.self.location).href,method:'GET',mode:'cors',headers:new Headers(),destination:'',...overrides}
    let response
    handlers.fetch({request,respondWith: promise => { response = promise }})
    return response ? await response : undefined
  }}
}

test('unversioned public assets refresh while fingerprinted chunks reuse cache', async () => {
  const sw = worker()
  assert.equal(await (await sw.fetch('/theme.css')).text(),'network-1')
  assert.equal(await (await sw.fetch('/theme.css')).text(),'network-2')
  await sw.fetch('/_next/static/chunks/abc123.js')
  await sw.fetch('/_next/static/chunks/abc123.js')
  assert.equal(sw.calls.length,3)
})

test('navigation is network-only and RSC/auth/API requests bypass the worker', async () => {
  const sw = worker()
  await sw.fetch('/units/one',{mode:'navigate'})
  await sw.fetch('/units/one',{mode:'navigate'})
  assert.equal(sw.calls.length,2)
  for (const path of ['/api/theme-paint-search','/auth/callback','/login']) {
    assert.equal(await sw.fetch(path),undefined)
  }
  assert.equal(await sw.fetch('/units/one',{headers:new Headers({RSC:'1'})}),undefined)
})

test('cached public assets and background image refresh handle offline failures', async () => {
  const sw = worker()
  await sw.fetch('/theme.css')
  await sw.fetch('/icons/nav/projects.svg',{destination:'image'})
  sw.setOffline()
  assert.equal(await (await sw.fetch('/theme.css')).text(),'network-1')
  assert.equal(await (await sw.fetch('/icons/nav/projects.svg',{destination:'image'})).text(),'network-2')
  await new Promise(resolve => setImmediate(resolve))
})

test('cache quota failures do not prevent successful network responses', async () => {
  const sw = worker({fullCache:true})
  for (const path of ['/theme.css','/_next/static/chunks/abc123.js','/icons/nav/projects.svg']) {
    const response = await sw.fetch(path,{destination:'image'})
    assert.equal(response.ok,true)
  }
})
