import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth'
import NominationsBallotForm from '@/components/NominationsBallotForm'

export const metadata = {
  title: 'Nominations Ballot | Admin | Rich Picks',
}

export default async function AdminNominationsPage() {
  const user = await getAdminUser()

  if (!user) {
    redirect('/admin/login')
  }

  return <NominationsBallotForm />
}
