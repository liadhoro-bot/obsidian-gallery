import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isLocalV3PreviewHost } from '../../lib/v3-preview'
import DialogDemo from './dialog-demo'

// Local-only showcase for OgDialog. 404s anywhere but localhost.
export default async function V3DialogDemoPage() {
  const headerStore = await headers()
  if (!isLocalV3PreviewHost(headerStore.get('host'))) notFound()
  return <DialogDemo />
}
