import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/auth'

const GRADE_RE = /^(A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-|F)$/

// Rich's grade (and optionally review text) saved from the site's community widgets — the
// admin's grade is always Rich's official grade, never a community rating.
export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { filmId, grade, reviewText } = await request.json()
  const id = parseInt(filmId)
  if (isNaN(id)) return NextResponse.json({ error: 'filmId is required' }, { status: 400 })
  if (grade != null && !GRADE_RE.test(grade)) return NextResponse.json({ error: 'Invalid grade' }, { status: 400 })
  if (grade == null && !reviewText?.trim()) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const film = await query(`SELECT release_year FROM films WHERE film_id = $1`, [id])
  if (!film.rows.length) return NextResponse.json({ error: 'Film not found' }, { status: 404 })

  await query(
    `INSERT INTO reviews (film_id, grade, review_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (film_id) DO UPDATE SET
       grade = COALESCE(EXCLUDED.grade, reviews.grade),
       review_text = COALESCE(EXCLUDED.review_text, reviews.review_text),
       updated_at = CURRENT_TIMESTAMP`,
    [id, grade ?? null, reviewText?.trim() || null]
  )

  revalidatePath(`/film/${id}`)
  revalidatePath('/')
  if (film.rows[0].release_year) revalidatePath(`/year/${film.rows[0].release_year}`)
  return NextResponse.json({ ok: true })
}
