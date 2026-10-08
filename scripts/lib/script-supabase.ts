import { createClient } from '@supabase/supabase-js'

// Long-running import scripts make thousands of sequential requests; a single
// connect timeout shouldn't abort a run. Retries network failures (not HTTP
// errors, which Supabase reports in the response body) with backoff.
async function retryingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempts = 5
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      if (attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }
}

export function createScriptClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: retryingFetch },
    auth: { persistSession: false },
  })
}
