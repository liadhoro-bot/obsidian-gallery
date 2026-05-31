import { NextResponse } from 'next/server'
import { getCuratorMessage } from '../../../components/curator/get-curator-message'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const surface = searchParams.get('surface') || 'dashboard'
  const entityId = searchParams.get('entityId')
  const auto = searchParams.get('auto') === 'true'

  const result = await getCuratorMessage({
    surface,
    entityId,
    auto,
  })

  return NextResponse.json(result)
}