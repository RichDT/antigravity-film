import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year')

  if (!year) {
    return NextResponse.json({ error: 'year is required' }, { status: 400 })
  }

  const yearInt = parseInt(year)

  // Get Rich Picks award
  const awardRes = await query(
    `SELECT a.award_id FROM awards a
     JOIN organizations o USING (organization_id)
     WHERE o.short_name = 'Rich Picks'`
  )
  if (awardRes.rows.length === 0) {
    return NextResponse.json({ nominations: [], availableYears: [] })
  }
  const awardId = awardRes.rows[0].award_id

  // Get all nominations for this year with full details
  const nomRes = await query(
    `SELECT 
        n.nomination_id,
        n.film_id,
        n.category_id,
        n.win,
        f.title AS film_title,
        f.release_year,
        cat.name AS category_name,
        s.title AS song_title,
        s.song_id,
        p.name AS person_name,
        p.person_id,
        r.role_name,
        rev.grade
     FROM nominations n
     JOIN ceremonies cer USING (ceremony_id)
     JOIN films f USING (film_id)
     JOIN categories cat USING (category_id)
     LEFT JOIN reviews rev ON n.film_id = rev.film_id
     LEFT JOIN nomination_songs ns USING (nomination_id)
     LEFT JOIN songs s USING (song_id)
     LEFT JOIN nomination_people np USING (nomination_id)
     LEFT JOIN people p USING (person_id)
     LEFT JOIN roles r ON np.role_id = r.role_id
     WHERE cer.award_id = $1 AND cer.year = $2
     ORDER BY cat.name, f.title, p.name`,
    [awardId, yearInt]
  )

  // Get available years from ceremonies
  const yearsRes = await query(
    `SELECT DISTINCT cer.year FROM ceremonies cer
     JOIN nominations n USING (ceremony_id)
     WHERE cer.award_id = $1
     ORDER BY cer.year DESC`,
    [awardId]
  )

  return NextResponse.json({
    nominations: nomRes.rows,
    availableYears: yearsRes.rows.map((r: any) => r.year),
  })
}
