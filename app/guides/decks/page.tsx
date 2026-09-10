import { redirect } from 'next/navigation'

export default function GuideDecksIndexPage() {
  redirect('/guides?preview=1')
}
