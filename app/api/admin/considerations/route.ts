import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const CREW_ROLE_MAP: Record<string, string> = {
  'Directing': 'Director',
  'Editing': 'Editor',
  'Cinematography': 'Cinematographer',
  'Original Score': 'Composer',
  'Screenplay (Original)': 'Writer',
  'Screenplay (Adapted)': 'Writer',
}

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year')

  if (!year) {
    return NextResponse.json({ error: 'year is required' }, { status: 400 })
  }

  const yearInt = parseInt(year)

  // Get all considerations for this year, joined with film + category info
  const res = await query(
    `SELECT 
        c.consideration_id,
        c.film_id,
        c.category_id,
        c.year,
        c.detail,
        f.title AS film_title,
        f.release_year,
        cat.name AS category_name,
        r.grade
     FROM considerations c
     JOIN films f USING (film_id)
     JOIN categories cat USING (category_id)
     LEFT JOIN reviews r USING (film_id)
     WHERE c.year = $1
     ORDER BY cat.name, f.title, c.detail`,
    [yearInt]
  )

  // Also get existing nominations for this year to mark already-nominated items
  const awardRes = await query(
    `SELECT a.award_id FROM awards a
     JOIN organizations o USING (organization_id)
     WHERE o.short_name = 'Rich Picks'`
  )
  const awardId = awardRes.rows[0]?.award_id

  let existingNominations: any[] = []
  if (awardId) {
    const nomRes = await query(
      `SELECT n.nomination_id, n.film_id, n.category_id, n.win,
              s.title AS song_title,
              p.name AS person_name,
              np.role_id,
              r.role_name
       FROM nominations n
       JOIN ceremonies cer USING (ceremony_id)
       LEFT JOIN nomination_songs ns USING (nomination_id)
       LEFT JOIN songs s USING (song_id)
       LEFT JOIN nomination_people np USING (nomination_id)
       LEFT JOIN people p USING (person_id)
       LEFT JOIN roles r USING (role_id)
       WHERE cer.award_id = $1 AND cer.year = $2`,
      [awardId, yearInt]
    )
    existingNominations = nomRes.rows
  }

  // For null-detail considerations in crew categories, augment with film_crew data
  // so the ballot form can show the correct person without requiring a DB update
  const rows = res.rows as any[]
  const nullCrewRows = rows.filter(r => r.detail === null && CREW_ROLE_MAP[r.category_name])
  if (nullCrewRows.length > 0) {
    // Fetch crew for all relevant films in one query
    const filmIds = [...new Set(nullCrewRows.map((r: any) => r.film_id))]
    const crewRes = await query(
      `SELECT fc.film_id, fc.crew_role, p.name
       FROM film_crew fc
       JOIN people p ON fc.person_id = p.person_id
       WHERE fc.film_id = ANY($1)`,
      [filmIds]
    )
    // Build a lookup: film_id + crew_role → names[]
    const crewMap = new Map<string, string[]>()
    for (const cr of crewRes.rows as any[]) {
      const k = `${cr.film_id}|${cr.crew_role}`
      if (!crewMap.has(k)) crewMap.set(k, [])
      crewMap.get(k)!.push(cr.name)
    }
    // Replace null-detail rows with augmented rows (one per crew member if found)
    const augmented: any[] = []
    for (const r of rows) {
      if (r.detail === null && CREW_ROLE_MAP[r.category_name]) {
        const crewRole = CREW_ROLE_MAP[r.category_name]
        const names = crewMap.get(`${r.film_id}|${crewRole}`)
        if (names && names.length > 0) {
          for (const name of names) {
            augmented.push({ ...r, detail: name })
          }
          continue
        }
      }
      augmented.push(r)
    }

    // Get available years for the year selector
    const yearsRes = await query(
      `SELECT DISTINCT year FROM considerations ORDER BY year DESC`
    )
    return NextResponse.json({
      considerations: augmented,
      existingNominations,
      availableYears: yearsRes.rows.map((r: any) => r.year),
    })
  }

  // Get available years for the year selector
  const yearsRes = await query(
    `SELECT DISTINCT year FROM considerations ORDER BY year DESC`
  )

  return NextResponse.json({
    considerations: rows,
    existingNominations,
    availableYears: yearsRes.rows.map((r: any) => r.year),
  })
}
