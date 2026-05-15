import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, winners } = body
    // winners: Array<nomination_id>

    if (!year || !winners || !Array.isArray(winners)) {
      return NextResponse.json({ error: 'year and winners are required' }, { status: 400 })
    }

    const yearInt = parseInt(year)

    // Get Rich Picks award_id + ceremony_id
    const awardRes = await query(
      `SELECT a.award_id FROM awards a
       JOIN organizations o USING (organization_id)
       WHERE o.short_name = 'Rich Picks'`
    )
    if (awardRes.rows.length === 0) {
      return NextResponse.json({ error: 'Rich Picks award not found' }, { status: 500 })
    }
    const awardId = awardRes.rows[0].award_id

    const cerRes = await query(
      `SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`,
      [awardId, yearInt]
    )
    if (cerRes.rows.length === 0) {
      return NextResponse.json({ error: 'No ceremony found for this year' }, { status: 404 })
    }
    const ceremonyId = cerRes.rows[0].ceremony_id

    // OVERWRITE SEMANTICS: Get which categories are being submitted
    // We find the category_ids of the submitted nomination_ids
    if (winners.length > 0) {
      const winnerNomRes = await query(
        `SELECT DISTINCT category_id FROM nominations
         WHERE nomination_id = ANY($1::int[])`,
        [winners]
      )
      const catIds = winnerNomRes.rows.map((r: any) => r.category_id)

      // Reset all wins for those categories in this ceremony
      for (const catId of catIds) {
        await query(
          `UPDATE nominations SET win = false
           WHERE ceremony_id = $1 AND category_id = $2`,
          [ceremonyId, catId]
        )
      }

      // Set winners
      await query(
        `UPDATE nominations SET win = true
         WHERE nomination_id = ANY($1::int[])`,
        [winners]
      )
    }

    return NextResponse.json({ success: true, winnersSet: winners.length })
  } catch (err: any) {
    console.error('POST winners error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
