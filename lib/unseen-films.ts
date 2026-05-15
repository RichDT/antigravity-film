import { query } from './db';

export interface UnseenFilm {
  film_id: number;
  title: string;
  release_year: number;
  awards_year: number;
  source: 'auto' | 'manual';
  status: 'unseen' | 'reviewed_late';
  review_year?: number;
}

export async function getUnseenFilmsForYear(year: number): Promise<UnseenFilm[]> {
  let res;
  try {
    res = await query(
    `
    -- Films nominated by external orgs in Live-Action/Animated/International feature categories
    SELECT DISTINCT
      f.film_id,
      f.title,
      f.release_year,
      c.year AS awards_year,
      'auto'::text AS source,
      r.grade,
      EXTRACT(year FROM r.updated_at)::int AS review_year
    FROM nominations n
    JOIN films f USING (film_id)
    JOIN ceremonies c USING (ceremony_id)
    JOIN awards a ON c.award_id = a.award_id
    JOIN organizations o ON a.organization_id = o.organization_id
    JOIN categories cat ON n.category_id = cat.category_id
    LEFT JOIN category_canonical_map ccm ON ccm.category_id = cat.category_id
    LEFT JOIN canonical_categories cc ON ccm.canonical_category_id = cc.canonical_category_id
    LEFT JOIN reviews r ON r.film_id = f.film_id
    WHERE c.year = $1
      AND o.short_name != 'Rich Picks'
      AND cc.name IN ('Live-Action Feature', 'Animated Feature', 'International Feature')

    UNION

    -- Manually-added films from the unseen_films table
    SELECT DISTINCT
      f.film_id,
      f.title,
      f.release_year,
      uf.year AS awards_year,
      'manual'::text AS source,
      r.grade,
      EXTRACT(year FROM r.updated_at)::int AS review_year
    FROM unseen_films uf
    JOIN films f USING (film_id)
    LEFT JOIN reviews r ON r.film_id = f.film_id
    WHERE uf.year = $1
    `,
      [year]
    );
  } catch (err: any) {
    // Gracefully handle case where unseen_films table hasn't been created yet
    if (err.code === '42P01') return [];
    throw err;
  }

  const seen = new Set<number>();
  const films: UnseenFilm[] = [];

  for (const row of res.rows) {
    if (seen.has(row.film_id)) continue;
    seen.add(row.film_id);

    const hasGrade = row.grade && row.grade !== '';
    const reviewYear: number | undefined = row.review_year ?? undefined;

    if (hasGrade && reviewYear !== undefined && reviewYear <= row.awards_year + 3) {
      // Reviewed within 3 years of the awards year — exclude entirely
      continue;
    }

    films.push({
      film_id: row.film_id,
      title: row.title,
      release_year: row.release_year,
      awards_year: row.awards_year,
      source: row.source as 'auto' | 'manual',
      status: hasGrade ? 'reviewed_late' : 'unseen',
      review_year: reviewYear,
    });
  }

  return films.sort((a, b) => a.title.localeCompare(b.title));
}
