import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { fetchWikipediaCrew } from '@/lib/wikipedia-crew'

// Maps Rich Picks category names to film_crew.crew_role values for auto-population
const CREW_ROLE_MAP: Record<string, string> = {
  'Directing': 'Director',
  'Editing': 'Editor',
  'Cinematography': 'Cinematographer',
  'Original Score': 'Composer',
  'Screenplay (Original)': 'Writer',
  'Screenplay (Adapted)': 'Writer',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filmTitle, year, grade, reviewText, considerations } = body

    if (!filmTitle || !year) {
      return NextResponse.json({ error: 'Film title and year are required' }, { status: 400 })
    }

    const yearInt = parseInt(year)
    if (isNaN(yearInt)) {
      return NextResponse.json({ error: 'Year must be a valid number' }, { status: 400 })
    }

    // 1. Find or create the film
    let filmRes = await query(
      `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND release_year = $2`,
      [filmTitle.trim(), yearInt]
    )

    let filmId: number
    if (filmRes.rows.length > 0) {
      filmId = filmRes.rows[0].film_id
    } else {
      const insertRes = await query(
        `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
        [filmTitle.trim(), yearInt]
      )
      filmId = insertRes.rows[0].film_id
    }

    // 2. Upsert the review (grade + review text)
    if (grade || reviewText) {
      await query(
        `INSERT INTO reviews (film_id, grade, review_text)
         VALUES ($1, $2, $3)
         ON CONFLICT (film_id) DO UPDATE SET
           grade = COALESCE(EXCLUDED.grade, reviews.grade),
           review_text = COALESCE(EXCLUDED.review_text, reviews.review_text),
           updated_at = CURRENT_TIMESTAMP`,
        [filmId, grade || null, reviewText || null]
      )
    }

    // 3. Insert considerations for selected categories
    if (considerations && considerations.length > 0) {
      // Get the Rich Picks award_id
      const awardRes = await query(
        `SELECT a.award_id FROM awards a
         JOIN organizations o USING (organization_id)
         WHERE o.short_name = 'Rich Picks'`
      )

      if (awardRes.rows.length === 0) {
        return NextResponse.json({ error: 'Rich Picks award not found in database' }, { status: 500 })
      }

      const awardId = awardRes.rows[0].award_id

      for (const consideration of considerations) {
        const { name, details } = consideration

        // Find category_id
        const catRes = await query(
          `SELECT category_id FROM categories WHERE award_id = $1 AND name = $2`,
          [awardId, name]
        )
        if (catRes.rows.length === 0) continue

        const categoryId = catRes.rows[0].category_id

        if (details && details.length > 0) {
          // Insert one consideration per detail entry (e.g., per person or per song)
          for (const detail of details) {
            const detailText = detail.trim()
            if (!detailText) continue
            await query(
              `INSERT INTO considerations (film_id, category_id, year, detail)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (film_id, category_id, year, detail) DO NOTHING`,
              [filmId, categoryId, yearInt, detailText]
            )
          }
        } else {
          // No details provided — auto-populate from film_crew for crew categories
          const crewRole = CREW_ROLE_MAP[name]
          if (crewRole) {
            const crewRes = await query(
              `SELECT p.name FROM film_crew fc
               JOIN people p ON fc.person_id = p.person_id
               WHERE fc.film_id = $1 AND fc.crew_role = $2`,
              [filmId, crewRole]
            )
            if (crewRes.rows.length > 0) {
              for (const row of crewRes.rows) {
                await query(
                  `INSERT INTO considerations (film_id, category_id, year, detail)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (film_id, category_id, year, detail) DO NOTHING`,
                  [filmId, categoryId, yearInt, row.name]
                )
              }
            } else {
              // No crew found — save without detail
              await query(
                `INSERT INTO considerations (film_id, category_id, year, detail)
                 VALUES ($1, $2, $3, NULL)
                 ON CONFLICT (film_id, category_id, year, detail) DO NOTHING`,
                [filmId, categoryId, yearInt]
              )
            }
          } else {
            // Non-crew category — save without detail
            await query(
              `INSERT INTO considerations (film_id, category_id, year, detail)
               VALUES ($1, $2, $3, NULL)
               ON CONFLICT (film_id, category_id, year, detail) DO NOTHING`,
              [filmId, categoryId, yearInt]
            )
          }
        }
      }
    }

    // Populate film_crew from Wikipedia if this film has no crew data yet
    const crewCheck = await query('SELECT 1 FROM film_crew WHERE film_id = $1 LIMIT 1', [filmId])
    if (crewCheck.rows.length === 0) {
      try {
        const { directors, writers } = await fetchWikipediaCrew(filmTitle.trim(), yearInt)

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
            [filmId, personId, role]
          )
        }

        await Promise.all([
          ...directors.map(name => insertCrewMember(name, 'Director')),
          ...writers.map(name => insertCrewMember(name, 'Writer')),
        ])
      } catch (crewErr) {
        console.error('Wikipedia crew fetch failed (non-fatal):', crewErr)
      }
    }

    return NextResponse.json({ success: true, filmId })
  } catch (err: any) {
    console.error('Add review error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
