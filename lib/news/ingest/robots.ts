// A small robots.txt reader: picks the group for our bot (or *), then applies
// the longest matching Allow/Disallow rule, with Allow winning ties.

export const NEWS_BOT_TOKEN = 'obsidiangallerynewsbot'

type Rule = { allow: boolean; pattern: string }
type Group = { agents: string[]; rules: Rule[] }

export type RobotsPolicy = { rules: Rule[] }

export function parseRobots(text: string, botToken = NEWS_BOT_TOKEN): RobotsPolicy {
  const groups: Group[] = []
  let current: Group | null = null
  let lastWasAgent = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }

    lastWasAgent = false
    if (!current) continue
    if (field === 'allow' || field === 'disallow') {
      // An empty Disallow allows everything, so it adds no rule.
      if (value) current.rules.push({ allow: field === 'allow', pattern: value })
    }
  }

  const token = botToken.toLowerCase()
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== '*' && token.includes(agent))
  )
  const chosen = specific.length > 0 ? specific : groups.filter((group) => group.agents.includes('*'))
  return { rules: chosen.flatMap((group) => group.rules) }
}

function patternToRegExp(pattern: string) {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

export function isAllowedByRobots(policy: RobotsPolicy, pathWithQuery: string) {
  let best: Rule | null = null
  for (const rule of policy.rules) {
    if (!patternToRegExp(rule.pattern).test(pathWithQuery)) continue
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule
    }
  }
  return best ? best.allow : true
}
