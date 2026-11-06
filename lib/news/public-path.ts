// The public news pages. An exact match, because /community/newsroom shares
// the prefix and must stay behind the login and payment gates.
export function isPublicNewsPath(pathname: string) {
  return pathname === '/community/news' || pathname.startsWith('/community/news/')
}
