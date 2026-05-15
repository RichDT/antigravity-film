import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShareSearch from '@/components/AdminShareSearch'

export const metadata = { title: 'Share | Admin | Rich Picks' }

export default async function AdminShareIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return <AdminShareSearch />
}
