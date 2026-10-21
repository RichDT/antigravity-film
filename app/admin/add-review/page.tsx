import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth'
import AdminReviewForm from '@/components/AdminReviewForm'

export const metadata = {
  title: 'Add Review | Admin | Rich Picks',
}

export default async function AdminAddReviewPage() {
  const user = await getAdminUser()

  if (!user) {
    redirect('/admin/login')
  }

  return <AdminReviewForm />
}
