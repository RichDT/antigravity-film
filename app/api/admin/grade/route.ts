import { NextRequest, NextResponse } from 'next/server'
import { refreshSiteData } from '@/lib/refresh-site'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/auth'

const GRADE_RE = /^(A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-|F)$/

// Rich's grade (and optionally review text) saved from the site's community widgets — the
// admin's grade is always Rich's official grade, never a community rating.
export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { filmId, grade, reviewText, replaceReview } = await request.json()
  const id = parseInt(filmId)
  if (isNaN(id)) return NextResponse.json({ error: 'filmId is required' }, { status: 400 })
  if (grade != null && !GRADE_RE.test(grade)) return NextResponse.json({ error: 'Invalid grade' }, { status: 400 })
  if (grade == null && !reviewText?.trim() && !replaceReview) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const film = await query(`SELECT release_year FROM films WHERE film_id = $1`, [id])
  if (!film.rows.length) return NextResponse.json({ error: 'Film not found' }, { status: 404 })

  // Full-text edit from the film page: replace the review text outright (empty clears it)
  if (replaceReview) {
    const text = typeof reviewText === 'string' ? reviewText.replace(/\r\n/g, '\n').trim() : ''
    await query(
      `INSERT INTO reviews (film_id, review_text) VALUES ($1, $2)
       ON CONFLICT (film_id) DO UPDATE SET review_text = EXCLUDED.review_text, updated_at = CURRENT_TIMESTAMP`,
      [id, text || null]
    )
    refreshSiteData()
    return NextResponse.json({ ok: true })
  }

  await query(
    `INSERT INTO reviews (film_id, grade, review_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (film_id) DO UPDATE SET
       grade = COALESCE(EXCLUDED.grade, reviews.grade),
       review_text = COALESCE(EXCLUDED.review_text, reviews.review_text),
       updated_at = CURRENT_TIMESTAMP`,
    [id, grade ?? null, reviewText?.trim() || null]
  )

  refreshSiteData()
  return NextResponse.json({ ok: true })
}
