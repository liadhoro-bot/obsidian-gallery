import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const confirmUrl = new URL(request.url)
  confirmUrl.pathname = '/auth/confirm'

  return NextResponse.redirect(confirmUrl)
}
