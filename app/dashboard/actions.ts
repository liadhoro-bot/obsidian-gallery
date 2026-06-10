'use server'

import { redirect } from 'next/navigation'
import { startUnitSession } from '../units/[id]/actions'

export async function startDashboardUnitSession(formData: FormData) {
  const unitId = String(formData.get('unitId') || '').trim()

  if (!unitId) {
    throw new Error('Missing unit id')
  }

  await startUnitSession(unitId)
  redirect(`/units/${unitId}?session=started`)
}
