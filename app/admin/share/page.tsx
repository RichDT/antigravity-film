import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth'
import AdminShareSearch from '@/components/AdminShareSearch'

export const metadata = { title: 'Share | Admin | Rich Picks' }

export default async function AdminShareIndexPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return <AdminShareSearch />
}
