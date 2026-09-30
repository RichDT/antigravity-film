import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { enrichAnticipatedFilm } from '@/lib/enrich-film';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { filmTitle, year } = await request.json();

    if (!filmTitle || !year) {
      return NextResponse.json({ error: 'filmTitle and year are required' }, { status: 400 });
    }

    const yearInt = parseInt(year, 10);
    if (isNaN(yearInt)) {
      return NextResponse.json({ error: 'year must be a number' }, { status: 400 });
    }

    // Match only a film from this board's year (or the next) so a same-titled older film isn't reused
    const filmRes = await query(
      `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND release_year BETWEEN $2 AND $2 + 1
       ORDER BY release_year LIMIT 1`,
      [filmTitle.trim(), yearInt]
    );
    const filmId: number = filmRes.rows[0]?.film_id
      ?? (await query(`INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`, [filmTitle.trim(), yearInt])).rows[0].film_id;

    await query(
      `INSERT INTO unseen_films (film_id, year, source) VALUES ($1, $2, 'manual') ON CONFLICT (film_id, year) DO NOTHING`,
      [filmId, yearInt]
    );

    // Current and future boards get the full treatment: Wikipedia crew/cast, U.S. release date, official trailer
    const enriched = yearInt >= new Date().getFullYear() ? await enrichAnticipatedFilm(filmId) : null;

    revalidatePath('/');
    revalidatePath(`/year/${yearInt}`);
    if (enriched && enriched.boardYear !== yearInt) revalidatePath(`/year/${enriched.boardYear}`);

    return NextResponse.json({ success: true, filmId, enriched });
  } catch (err: any) {
    console.error('unseen-films POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
