import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminReviewForm from '@/components/AdminReviewForm'

export const metadata = {
  title: 'Add Review | Admin | Rich Picks',
}

export default async function AdminAddReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  return <AdminReviewForm />
}
