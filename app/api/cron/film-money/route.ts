import { NextRequest, NextResponse } from 'next/server'
import { filmsDueForMoneyRefresh, refreshFilmMoney } from '@/lib/film-money'
import { refreshSiteData } from '@/lib/refresh-site'

// Daily (vercel.json crons): refresh budget/box office from Wikipedia for this year's and last
// year's films, oldest-checked first, so each recent film is refreshed about once a week.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const films = await filmsDueForMoneyRefresh(50)
  const changed = await refreshFilmMoney(films)
  if (changed.length) refreshSiteData()
  return NextResponse.json({ checked: films.length, changed })
}
