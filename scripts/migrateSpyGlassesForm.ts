/**
 * Import SpyGlasses CSV data into Supabase tables.
 * - Creates films if they don't exist
 * - Creates reviews (grades) if they don't exist
 * - Creates considerations for each category + detail
 * Avoids duplicates at every step.
 */
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface CsvRow {
  Timestamp: string;
  Year: string;
  'Film Title': string;
  Grade: string;
  Categories: string;
  'Actor(s) in a Leading Role': string;
  'Actor(s) in a Supporting Role': string;
  'Actress(es) in a Leading Role': string;
  'Actress(es) in a Supporting Role': string;
  'Original Song(s)': string;
}

// Map CSV category names to DB category names
const CATEGORY_NAME_MAP: Record<string, string> = {
  'Foreign Film': 'International Feature',
};

function normalizeCategoryName(name: string): string {
  const trimmed = name.trim();
  return CATEGORY_NAME_MAP[trimmed] || trimmed;
}

// Parse multi-value detail fields: actors may be comma-separated, songs use semicolons
function parseActorNames(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  // Split on comma, but also handle newlines
  return raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
}

function parseSongTitles(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  // Songs are separated by semicolons; each may have surrounding quotes
  return raw.split(';').map(s => s.trim().replace(/^"+|"+$/g, '').trim()).filter(Boolean);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to DB');

  // Read CSV
  const csvPath = path.join(process.cwd(), 'data', 'The SpyGlasses Full (2022 Update) - Form.csv');
  const csvRaw = fs.readFileSync(csvPath, 'utf8');
  const rows: CsvRow[] = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Get Rich Picks award_id
  const awardRes = await client.query(
    `SELECT a.award_id FROM awards a JOIN organizations o USING (organization_id) WHERE o.short_name = 'Rich Picks'`
  );
  if (awardRes.rows.length === 0) {
    console.error('Rich Picks award not found!');
    process.exit(1);
  }
  const awardId = awardRes.rows[0].award_id;

  // Pre-load all category_ids for this award
  const catRes = await client.query(
    `SELECT category_id, name FROM categories WHERE award_id = $1`,
    [awardId]
  );
  const categoryMap = new Map<string, number>();
  for (const r of catRes.rows) {
    categoryMap.set(r.name, r.category_id);
  }

  let filmsCreated = 0, filmsExisted = 0;
  let reviewsCreated = 0, reviewsExisted = 0;
  let considerationsCreated = 0, considerationsExisted = 0;

  for (const row of rows) {
    const title = row['Film Title']?.trim();
    const yearStr = row['Year']?.trim();
    const grade = row['Grade']?.trim() || '';
    const categoriesRaw = row['Categories']?.trim() || '';

    if (!title || !yearStr) {
      console.log(`  SKIP: missing title or year`);
      continue;
    }

    const yearInt = parseInt(yearStr);
    if (isNaN(yearInt)) continue;

    // 1. Find or create film
    let filmRes = await client.query(
      `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND release_year = $2`,
      [title, yearInt]
    );

    let filmId: number;
    if (filmRes.rows.length > 0) {
      filmId = filmRes.rows[0].film_id;
      filmsExisted++;
    } else {
      const insertRes = await client.query(
        `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
        [title, yearInt]
      );
      filmId = insertRes.rows[0].film_id;
      filmsCreated++;
      console.log(`  NEW FILM: "${title}" (${yearInt}) → film_id=${filmId}`);
    }

    // 2. Upsert review (grade)
    if (grade) {
      const existingReview = await client.query(
        `SELECT review_id FROM reviews WHERE film_id = $1`, [filmId]
      );
      if (existingReview.rows.length > 0) {
        reviewsExisted++;
      } else {
        await client.query(
          `INSERT INTO reviews (film_id, grade) VALUES ($1, $2)
           ON CONFLICT (film_id) DO NOTHING`,
          [filmId, grade]
        );
        reviewsCreated++;
      }
    }

    // 3. Insert considerations for each category
    if (!categoriesRaw) continue;

    const categories = categoriesRaw.split(',').map(s => normalizeCategoryName(s));

    // Build detail map from the CSV columns
    const detailMap: Record<string, string[]> = {
      'Actor in a Leading Role': parseActorNames(row['Actor(s) in a Leading Role'] || ''),
      'Actor in a Supporting Role': parseActorNames(row['Actor(s) in a Supporting Role'] || ''),
      'Actress in a Leading Role': parseActorNames(row['Actress(es) in a Leading Role'] || ''),
      'Actress in a Supporting Role': parseActorNames(row['Actress(es) in a Supporting Role'] || ''),
      'Original Song': parseSongTitles(row['Original Song(s)'] || ''),
    };

    // Find or create ceremony
    let ceremonyRes = await client.query(
      `SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`,
      [awardId, yearInt]
    );

    let ceremonyId: number;
    if (ceremonyRes.rows.length > 0) {
      ceremonyId = ceremonyRes.rows[0].ceremony_id;
    } else {
      const insertC = await client.query(
        `INSERT INTO ceremonies (award_id, year, ceremony_number)
         VALUES ($1, $2, $3)
         ON CONFLICT (award_id, year) DO UPDATE SET year = EXCLUDED.year
         RETURNING ceremony_id`,
        [awardId, yearInt, yearInt - 2004]
      );
      ceremonyId = insertC.rows[0].ceremony_id;
      console.log(`  NEW CEREMONY: year=${yearInt} → ceremony_id=${ceremonyId}`);
    }

    for (const catName of categories) {
      const categoryId = categoryMap.get(catName);
      if (!categoryId) {
        console.log(`  WARN: unknown category "${catName}" for "${title}"`);
        continue;
      }

      const details = detailMap[catName] || [];

      if (details.length > 0) {
        for (const detail of details) {
          const existing = await client.query(
            `SELECT consideration_id FROM considerations
             WHERE film_id = $1 AND category_id = $2 AND year = $3 AND detail = $4`,
            [filmId, categoryId, yearInt, detail]
          );
          if (existing.rows.length > 0) {
            considerationsExisted++;
          } else {
            await client.query(
              `INSERT INTO considerations (film_id, category_id, year, detail)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (film_id, category_id, year, detail) DO NOTHING`,
              [filmId, categoryId, yearInt, detail]
            );
            considerationsCreated++;
          }
        }
      } else {
        // No detail — insert a single consideration with NULL detail
        const existing = await client.query(
          `SELECT consideration_id FROM considerations
           WHERE film_id = $1 AND category_id = $2 AND year = $3 AND detail IS NULL`,
          [filmId, categoryId, yearInt]
        );
        if (existing.rows.length > 0) {
          considerationsExisted++;
        } else {
          await client.query(
            `INSERT INTO considerations (film_id, category_id, year, detail)
             VALUES ($1, $2, $3, NULL)`,
            [filmId, categoryId, yearInt]
          );
          considerationsCreated++;
        }
      }
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`Films:          ${filmsCreated} created, ${filmsExisted} already existed`);
  console.log(`Reviews:        ${reviewsCreated} created, ${reviewsExisted} already existed`);
  console.log(`Considerations: ${considerationsCreated} created, ${considerationsExisted} already existed`);

  await client.end();
}

main().catch(console.error);
