import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WinnersBallotForm from '@/components/WinnersBallotForm'

export const metadata = {
  title: 'Winners Ballot | Admin | Rich Picks',
}

export default async function AdminWinnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  return <WinnersBallotForm />
}
