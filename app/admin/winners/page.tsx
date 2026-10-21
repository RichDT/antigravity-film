import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth'
import WinnersBallotForm from '@/components/WinnersBallotForm'

export const metadata = {
  title: 'Winners Ballot | Admin | Rich Picks',
}

export default async function AdminWinnersPage() {
  const user = await getAdminUser()

  if (!user) {
    redirect('/admin/login')
  }

  return <WinnersBallotForm />
}
