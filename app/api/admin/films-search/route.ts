import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const q = searchParams.get('q')

  if (!q || q.length < 2) {
    return NextResponse.json({ films: [] })
  }

  const res = await query(
    `SELECT f.film_id, f.title, f.release_year, r.grade
     FROM films f
     LEFT JOIN reviews r ON r.film_id = f.film_id
     WHERE f.title ILIKE $1
     ORDER BY f.release_year DESC NULLS LAST, f.title ASC
     LIMIT 15`,
    [`%${q}%`]
  )

  return NextResponse.json({ films: res.rows })
}
