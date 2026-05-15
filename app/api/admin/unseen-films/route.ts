import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { filmTitle, year } = await request.json();

    if (!filmTitle || !year) {
      return NextResponse.json({ error: 'filmTitle and year are required' }, { status: 400 });
    }

    const yearInt = parseInt(year, 10);
    if (isNaN(yearInt)) {
      return NextResponse.json({ error: 'year must be a number' }, { status: 400 });
    }

    // Find or create the film
    let filmRes = await query(
      `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1)`,
      [filmTitle.trim()]
    );

    let filmId: number;
    if (filmRes.rows.length > 0) {
      filmId = filmRes.rows[0].film_id;
    } else {
      const ins = await query(
        `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
        [filmTitle.trim(), yearInt]
      );
      filmId = ins.rows[0].film_id;
    }

    await query(
      `INSERT INTO unseen_films (film_id, year) VALUES ($1, $2) ON CONFLICT (film_id, year) DO NOTHING`,
      [filmId, yearInt]
    );

    revalidatePath(`/year/${yearInt}`);

    return NextResponse.json({ success: true, filmId });
  } catch (err: any) {
    console.error('unseen-films POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
