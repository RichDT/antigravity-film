import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, selections } = body
    // selections: Array<{ category_id, film_id, detail: string | null }>

    if (!year || !selections || !Array.isArray(selections)) {
      return NextResponse.json({ error: 'year and selections are required' }, { status: 400 })
    }

    const yearInt = parseInt(year)

    // Get Rich Picks award_id
    const awardRes = await query(
      `SELECT a.award_id FROM awards a
       JOIN organizations o USING (organization_id)
       WHERE o.short_name = 'Rich Picks'`
    )
    if (awardRes.rows.length === 0) {
      return NextResponse.json({ error: 'Rich Picks award not found' }, { status: 500 })
    }
    const awardId = awardRes.rows[0].award_id

    // Find or create ceremony
    let ceremonyRes = await query(
      `SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`,
      [awardId, yearInt]
    )
    let ceremonyId: number
    if (ceremonyRes.rows.length > 0) {
      ceremonyId = ceremonyRes.rows[0].ceremony_id
    } else {
      const insertC = await query(
        `INSERT INTO ceremonies (award_id, year, ceremony_number)
         VALUES ($1, $2, $3)
         ON CONFLICT (award_id, year) DO UPDATE SET year = EXCLUDED.year
         RETURNING ceremony_id`,
        [awardId, yearInt, yearInt - 2004]
      )
      ceremonyId = insertC.rows[0].ceremony_id
    }

    // OVERWRITE SEMANTICS: Delete existing Rich Picks nominations for this ceremony
    // that belong to categories included in the new selections.
    // First, get all category_ids being submitted.
    const submittedCatIds = [...new Set(selections.map((s: any) => s.category_id))]

    for (const catId of submittedCatIds) {
      // Delete nomination_people and nomination_songs for existing nominations
      await query(
        `DELETE FROM nomination_people WHERE nomination_id IN (
           SELECT nomination_id FROM nominations WHERE ceremony_id = $1 AND category_id = $2
         )`,
        [ceremonyId, catId]
      )
      await query(
        `DELETE FROM nomination_songs WHERE nomination_id IN (
           SELECT nomination_id FROM nominations WHERE ceremony_id = $1 AND category_id = $2
         )`,
        [ceremonyId, catId]
      )
      await query(
        `DELETE FROM nominations WHERE ceremony_id = $1 AND category_id = $2`,
        [ceremonyId, catId]
      )
    }

    // Insert new nominations
    let created = 0
    for (const sel of selections) {
      const { category_id, film_id, detail } = sel

      // Get category name to determine type
      const catRes = await query(
        `SELECT name FROM categories WHERE category_id = $1`, [category_id]
      )
      const catName = catRes.rows[0]?.name || ''

      // Insert the nomination
      const nomRes = await query(
        `INSERT INTO nominations (ceremony_id, category_id, film_id, win)
         VALUES ($1, $2, $3, false)
         RETURNING nomination_id`,
        [ceremonyId, category_id, film_id]
      )
      const nominationId = nomRes.rows[0].nomination_id

      // For all non-song categories with a detail: link to person via nomination_people
      if (detail && catName !== 'Original Song') {
        // Find or create person
        let personRes = await query(
          `SELECT person_id FROM people WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [detail.trim()]
        )
        let personId: number
        if (personRes.rows.length > 0) {
          personId = personRes.rows[0].person_id
        } else {
          const parts = detail.trim().split(/\s+/)
          const firstName = parts[0] || ''
          const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
          const insertP = await query(
            `INSERT INTO people (name, first_name, last_name)
             VALUES ($1, $2, $3) RETURNING person_id`,
            [detail.trim(), firstName, lastName]
          )
          personId = insertP.rows[0].person_id
        }
        await query(
          `INSERT INTO nomination_people (nomination_id, person_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [nominationId, personId]
        )
      }

      // For Original Song: link to song via nomination_songs
      if (detail && catName === 'Original Song') {
        // Find or create song
        let songRes = await query(
          `SELECT song_id FROM songs WHERE LOWER(title) = LOWER($1) AND film_id = $2 LIMIT 1`,
          [detail.trim(), film_id]
        )
        let songId: number
        if (songRes.rows.length > 0) {
          songId = songRes.rows[0].song_id
        } else {
          const insertS = await query(
            `INSERT INTO songs (title, film_id)
             VALUES ($1, $2) RETURNING song_id`,
            [detail.trim(), film_id]
          )
          songId = insertS.rows[0].song_id
        }
        await query(
          `INSERT INTO nomination_songs (nomination_id, song_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [nominationId, songId]
        )
      }

      created++
    }

    return NextResponse.json({ success: true, created })
  } catch (err: any) {
    console.error('POST nominations error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
