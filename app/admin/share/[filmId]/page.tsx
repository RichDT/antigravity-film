import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { query } from '@/lib/db'
import { getGradeValue } from '@/lib/awards'
import { fetchWikipediaCrew } from '@/lib/wikipedia-crew'
import AdminShareCard from '@/components/AdminShareCard'

type Props = { params: Promise<{ filmId: string }> }

export default async function AdminSharePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { filmId } = await params
  const id = parseInt(filmId, 10)
  if (isNaN(id)) return notFound()

  const [filmRes, crewRes] = await Promise.all([
    query(
      `SELECT f.film_id, f.title, f.release_year, r.grade, r.review_text
       FROM films f
       LEFT JOIN reviews r ON r.film_id = f.film_id
       WHERE f.film_id = $1`,
      [id]
    ),
    query(
      `SELECT p.name, fc.crew_role
       FROM film_crew fc
       JOIN people p ON fc.person_id = p.person_id
       WHERE fc.film_id = $1 AND fc.crew_role IN ('Director', 'Writer')
       ORDER BY fc.crew_role, p.name`,
      [id]
    ),
  ])

  if (!filmRes.rows.length) return notFound()
  const film = filmRes.rows[0]

  let directors: string[] = crewRes.rows
    .filter((r: any) => r.crew_role === 'Director')
    .map((r: any) => r.name)
  let writers: string[] = crewRes.rows
    .filter((r: any) => r.crew_role === 'Writer')
    .map((r: any) => r.name)

  // No crew in DB — fetch from Wikipedia and persist (self-healing for pre-existing films)
  if (directors.length === 0 && writers.length === 0 && film.release_year) {
    try {
      const { directors: wDirs, writers: wWriters } = await fetchWikipediaCrew(film.title, film.release_year)
      const insertCrewMember = async (name: string, role: string) => {
        let pRes = await query('SELECT person_id FROM people WHERE LOWER(name) = LOWER($1)', [name])
        let personId: number
        if (pRes.rows.length > 0) {
          personId = pRes.rows[0].person_id
        } else {
          pRes = await query('INSERT INTO people (name) VALUES ($1) RETURNING person_id', [name])
          personId = pRes.rows[0].person_id
        }
        await query(
          'INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [id, personId, role]
        )
      }
      await Promise.all([
        ...wDirs.map(n => insertCrewMember(n, 'Director')),
        ...wWriters.map(n => insertCrewMember(n, 'Writer')),
      ])
      directors = wDirs
      writers = wWriters
    } catch (err) {
      console.error('[share page] crew fallback failed:', err)
    }
  }

  // Final fallback for director: Rich Picks Directing nomination
  if (directors.length === 0) {
    const dirNomRes = await query(
      `SELECT DISTINCT p.name
       FROM nominations n
       JOIN categories cat ON n.category_id = cat.category_id
       JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
       JOIN awards a ON c.award_id = a.award_id
       JOIN organizations o ON a.organization_id = o.organization_id
       JOIN nomination_people np ON n.nomination_id = np.nomination_id
       JOIN people p ON np.person_id = p.person_id
       WHERE n.film_id = $1 AND o.short_name = 'Rich Picks' AND cat.name = 'Directing'
       LIMIT 3`,
      [id]
    )
    directors = dirNomRes.rows.map((r: any) => r.name)
  }

  let rank: number | undefined
  if (film.grade && film.release_year) {
    const yearFilmsRes = await query(
      `SELECT f.film_id, r.grade
       FROM films f
       JOIN reviews r ON r.film_id = f.film_id
       WHERE f.release_year = $1 AND r.grade IS NOT NULL`,
      [film.release_year]
    )
    const sorted = [...yearFilmsRes.rows].sort(
      (a: any, b: any) => getGradeValue(b.grade) - getGradeValue(a.grade)
    )
    const rankIdx = sorted.findIndex((r: any) => r.film_id === film.film_id)
    if (rankIdx >= 0 && rankIdx < 10) rank = rankIdx + 1
  }

  return (
    <AdminShareCard
      film={{
        id: film.film_id,
        title: film.title,
        year: film.release_year,
        grade: film.grade || '',
        reviewText: film.review_text || '',
        directors,
        writers,
        rank,
      }}
    />
  )
}
