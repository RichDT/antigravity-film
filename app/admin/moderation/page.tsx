import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth'
import { ModerationQueue } from '@/components/admin/ModerationQueue'

export const metadata = { title: 'Moderation | Admin | Rich Picks' }

export default async function AdminModerationPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return <ModerationQueue />
}
