import { NextResponse } from 'next/server';
import { queryCached as query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q || q.length < 2) {
    return NextResponse.json({ films: [], people: [] });
  }

  const searchTerm = `%${q}%`;

  try {
    const filmsPromise = query(`
      SELECT 
        f.film_id as id, 
        f.title, 
        f.release_year as year,
        (
          SELECT p.name
          FROM nominations n
          JOIN nomination_people np ON n.nomination_id = np.nomination_id
          JOIN categories c ON n.category_id = c.category_id
          JOIN people p ON np.person_id = p.person_id
          WHERE n.film_id = f.film_id AND c.name IN ('Directing', 'Director')
          LIMIT 1
        ) as director
      FROM films f
      WHERE f.title ILIKE $1
      ORDER BY f.release_year DESC NULLS LAST, f.title ASC
      LIMIT 20
    `, [searchTerm]);

    const peoplePromise = query(`
      SELECT person_id as id, name
      FROM people
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 20
    `, [searchTerm]);

    const [filmsRes, peopleRes] = await Promise.all([filmsPromise, peoplePromise]);

    return NextResponse.json({
      films: filmsRes.rows,
      people: peopleRes.rows
    });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
