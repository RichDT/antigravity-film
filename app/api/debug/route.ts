import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const filmTitle = "Spider-Man: Across the Spider-Verse";
  const numRes = await query(`
    SELECT n.nomination_id, cat.name as category, o.short_name as org
    FROM nominations n
    JOIN ceremonies c USING (ceremony_id)
    JOIN categories cat USING (category_id)
    JOIN awards a ON c.award_id = a.award_id
    JOIN organizations o ON a.organization_id = o.organization_id
    JOIN films f ON n.film_id = f.film_id
    WHERE f.title = $1 AND (cat.name ILIKE '%effect%' OR o.short_name = 'VES')
  `, [filmTitle]);

  return NextResponse.json({
    data: numRes.rows
  });
}
