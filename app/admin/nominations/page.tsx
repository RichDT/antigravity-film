import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NominationsBallotForm from '@/components/NominationsBallotForm'

export const metadata = {
  title: 'Nominations Ballot | Admin | Rich Picks',
}

export default async function AdminNominationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  return <NominationsBallotForm />
}
