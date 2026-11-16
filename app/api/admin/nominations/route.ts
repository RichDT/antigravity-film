import { refreshSiteData, scopeForNominations } from '@/lib/refresh-site'
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Which selections belong to the same nomination (Rich's rule): acting categories = one per performer,
// song categories = one per song, every other category = one per film.
function isActingCategory(name: string): boolean {
  return name.includes('Actor') || name.includes('Actress')
}
function isSongCategory(name: string): boolean {
  return /song/i.test(name) && !/song score/i.test(name)
}
function nominationKey(catName: string, filmId: number, detail: string | null | undefined): string {
  const d = (detail || '').trim().toLowerCase()
  if (isSongCategory(catName)) return `${catName}|${filmId}|song:${d}`
  if (isActingCategory(catName)) return `${catName}|${filmId}|person:${d}`
  return `${catName}|${filmId}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, selections } = body
    // selections: Array<{ category_id, film_id, detail: string | null, details?: string[] }>
    // One row in `nominations` per real nomination (see nominationKey); people go in nomination_people,
    // songs in nomination_songs.

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

    // Category names decide how selections group into nominations
    const catRows = await query(
      `SELECT category_id, name FROM categories WHERE category_id = ANY($1::int[])`,
      [submittedCatIds]
    )
    const catNames = new Map<number, string>(catRows.rows.map((r: any) => [r.category_id, r.name]))

    // Remember wins already recorded, so re-saving nominations doesn't wipe the winners
    const priorRes = await query(
      `SELECT n.category_id, n.film_id, n.win,
              (SELECT p.name FROM nomination_people np JOIN people p ON p.person_id = np.person_id
                WHERE np.nomination_id = n.nomination_id ORDER BY np.nomination_person_id LIMIT 1) AS person_name,
              (SELECT s.title FROM nomination_songs ns JOIN songs s ON s.song_id = ns.song_id
                WHERE ns.nomination_id = n.nomination_id LIMIT 1) AS song_title
         FROM nominations n
        WHERE n.ceremony_id = $1 AND n.category_id = ANY($2::int[]) AND n.win`,
      [ceremonyId, submittedCatIds]
    )
    const priorWins = new Set<string>(priorRes.rows.map((r: any) =>
      nominationKey(catNames.get(r.category_id) || '', r.film_id, r.song_title || r.person_name)))

    // Pages of films and people on the nominations being replaced need refreshing too
    const priorIdsRes = await query(
      `SELECT nomination_id FROM nominations WHERE ceremony_id = $1 AND category_id = ANY($2::int[])`,
      [ceremonyId, submittedCatIds]
    )
    const priorScope = await scopeForNominations(priorIdsRes.rows.map((r: any) => r.nomination_id))

    // Remember who was credited and in what role(s), so a re-save keeps the same person records and their
    // roles (job titles, or character names on acting nominations) instead of wiping them
    const priorPeopleRes = await query(
      `SELECT n.category_id, n.film_id, p.person_id, LOWER(p.name) AS name, np.role_id
         FROM nominations n
         JOIN nomination_people np ON np.nomination_id = n.nomination_id
         JOIN people p ON p.person_id = np.person_id
        WHERE n.ceremony_id = $1 AND n.category_id = ANY($2::int[])`,
      [ceremonyId, submittedCatIds]
    )
    // Song nominations: the form sends only the song title, so keep the songwriters credited on the replaced nomination
    const priorSongPeopleRes = await query(
      `SELECT n.category_id, n.film_id, s.title AS song, np.person_id, np.role_id, np.credit_order
         FROM nominations n
         JOIN nomination_songs ns ON ns.nomination_id = n.nomination_id
         JOIN songs s ON s.song_id = ns.song_id
         JOIN nomination_people np ON np.nomination_id = n.nomination_id
        WHERE n.ceremony_id = $1 AND n.category_id = ANY($2::int[])
        ORDER BY np.credit_order NULLS LAST, np.nomination_person_id`,
      [ceremonyId, submittedCatIds]
    )
    const priorSongPeople = new Map<string, { personId: number; roleId: number | null; creditOrder: number | null }[]>()
    for (const r of priorSongPeopleRes.rows) {
      const k = nominationKey(catNames.get(r.category_id) || '', r.film_id, r.song)
      priorSongPeople.set(k, [...(priorSongPeople.get(k) || []), { personId: r.person_id, roleId: r.role_id, creditOrder: r.credit_order }])
    }

    const priorPeople = new Map<string, { personId: number; roleIds: (number | null)[] }>()
    for (const r of priorPeopleRes.rows) {
      const k = `${r.category_id}|${r.film_id}|${r.name}`
      const e = priorPeople.get(k) || { personId: r.person_id, roleIds: [] as (number | null)[] }
      if (!e.roleIds.includes(r.role_id)) e.roleIds.push(r.role_id)
      priorPeople.set(k, e)
    }

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

    // Group the selections into nominations: acting = one per performer, song = one per song,
    // every other category = one per film carrying all of its people.
    const groups = new Map<string, { category_id: number; film_id: number; catName: string; people: string[]; song: string | null }>()
    for (const sel of selections) {
      const { category_id, film_id } = sel
      const catName = catNames.get(category_id) || ''
      const names: string[] = [...new Set(
        [sel.detail, ...(Array.isArray(sel.details) ? sel.details : [])]
          .filter((d: unknown): d is string => typeof d === 'string' && d.trim() !== '')
          .map((d: string) => d.trim())
      )]
      const song = isSongCategory(catName) ? (names[0] || null) : null
      const key = nominationKey(catName, film_id, song || (isActingCategory(catName) ? names[0] : null))
      const g = groups.get(key) || { category_id, film_id, catName, people: [] as string[], song }
      if (!isSongCategory(catName)) {
        for (const n of (isActingCategory(catName) ? names.slice(0, 1) : names)) {
          if (!g.people.some(p => p.toLowerCase() === n.toLowerCase())) g.people.push(n)
        }
      }
      groups.set(key, g)
    }

    let created = 0
    const createdIds: number[] = []
    for (const [key, g] of groups) {
      const nomRes = await query(
        `INSERT INTO nominations (ceremony_id, category_id, film_id, win)
         VALUES ($1, $2, $3, $4)
         RETURNING nomination_id`,
        [ceremonyId, g.category_id, g.film_id, priorWins.has(key)]
      )
      const nominationId = nomRes.rows[0].nomination_id
      createdIds.push(nominationId)

      // People: one nomination_people row per person (and per role they held on the replaced nomination)
      for (const [i, name] of g.people.entries()) {
        const prior = priorPeople.get(`${g.category_id}|${g.film_id}|${name.toLowerCase()}`)
        const personRes = prior ? { rows: [{ person_id: prior.personId }] } : await query(
          `SELECT person_id FROM people WHERE LOWER(name) = LOWER($1) ORDER BY person_id LIMIT 1`,
          [name]
        )
        let personId: number
        if (personRes.rows.length > 0) {
          personId = personRes.rows[0].person_id
        } else {
          const parts = name.split(/\s+/)
          const insertP = await query(
            `INSERT INTO people (name, first_name, last_name)
             VALUES ($1, $2, $3) RETURNING person_id`,
            [name, parts[0] || '', parts.length > 1 ? parts[parts.length - 1] : '']
          )
          personId = insertP.rows[0].person_id
        }
        for (const roleId of prior?.roleIds ?? [null]) {
          await query(
            `INSERT INTO nomination_people (nomination_id, person_id, role_id, credit_order)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [nominationId, personId, roleId, i + 1]
          )
        }
      }

      // Songwriters carried over from the replaced nomination of the same song
      if (g.song) {
        for (const sp of priorSongPeople.get(key) || []) {
          await query(
            `INSERT INTO nomination_people (nomination_id, person_id, role_id, credit_order)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [nominationId, sp.personId, sp.roleId, sp.creditOrder]
          )
        }
      }

      // Song: one nomination_songs row
      if (g.song) {
        const songRes = await query(
          `SELECT song_id FROM songs WHERE LOWER(title) = LOWER($1) AND film_id = $2 LIMIT 1`,
          [g.song, g.film_id]
        )
        let songId: number
        if (songRes.rows.length > 0) {
          songId = songRes.rows[0].song_id
        } else {
          const insertS = await query(
            `INSERT INTO songs (title, film_id)
             VALUES ($1, $2) RETURNING song_id`,
            [g.song, g.film_id]
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

    const newScope = await scopeForNominations(createdIds)
    await refreshSiteData({
      films: [...(priorScope.films ?? []), ...(newScope.films ?? [])],
      people: [...(priorScope.people ?? []), ...(newScope.people ?? [])],
      years: [yearInt],
      categories: true,
    })
    return NextResponse.json({ success: true, created })
  } catch (err: any) {
    console.error('POST nominations error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
