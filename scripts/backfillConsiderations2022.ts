import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Category Mapping
const CAT_MAP: Record<string, string> = {
  'Director': 'Directing',
  'Film Editing': 'Editing',
  'Foreign Film': 'International Feature',
};

interface NomineeRow {
  Year: string;
  Film: string;
  Category: string;
  Outcome: string;
  Role: string;
  Title: string;
  p_id: string;
  Nominated: string;
}

function normalizeCategory(name: string): string {
  const trimmed = name.trim();
  return CAT_MAP[trimmed] || trimmed;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to DB');

  // Load Award and Categories
  const awardRes = await client.query("SELECT award_id FROM awards WHERE name = 'Rich Pick' LIMIT 1");
  const awardId = awardRes.rows[0].award_id;
  const catRes = await client.query("SELECT category_id, name FROM categories WHERE award_id = $1", [awardId]);
  const categoryIdMap = new Map<string, number>();
  for (const r of catRes.rows) categoryIdMap.set(r.name, r.category_id);

  // Helper to find film_id
  const filmCache = new Map<string, number>();
  async function getFilmId(title: string, year: number): Promise<number | null> {
    const key = `${title.toLowerCase()}|${year}`;
    if (filmCache.has(key)) return filmCache.get(key)!;
    const res = await client.query("SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND release_year = $2", [title, year]);
    if (res.rows.length > 0) {
      filmCache.set(key, res.rows[0].film_id);
      return res.rows[0].film_id;
    }
    return null;
  }

  // Helper to find person name from p_id
  const personNameCache = new Map<string, string>();
  async function getPersonName(pId: string): Promise<string | null> {
    if (!pId) return null;
    if (personNameCache.has(pId)) return personNameCache.get(pId)!;
    const res = await client.query("SELECT name FROM people WHERE imdb_id = $1 OR tmdb_id::text = $1 LIMIT 1", [pId.replace(/^p/, '')]);
    // Note: p_id in CSV might be prefixed with 'p' (our internal ID) or it might be IMDb ID.
    // The previous migration Core script created people with p000xxx as imdb_id or just imported them.
    // Let's check a few p_ids in the DB first.
    return res.rows.length > 0 ? res.rows[0].name : null;
  }
  
  // Wait, let's actually check how p_id maps to people.
  // I'll run a quick check within the script actually.
  const sampleP = await client.query("SELECT name, imdb_id FROM people LIMIT 5");
  console.log('Sample People:', sampleP.rows);

  let created = 0, existed = 0, skipped = 0;

  // --- 1. Process Longlist_Cuts.csv (2022) ---
  const cutsPath = path.join(process.cwd(), 'data', 'The SpyGlasses Full (2022 Update) - Longlist_Cuts.csv');
  if (fs.existsSync(cutsPath)) {
    console.log('Processing Longlist_Cuts.csv...');
    const cutsRaw = fs.readFileSync(cutsPath, 'utf8');
    const cutRows = parse(cutsRaw, { columns: false, skip_empty_lines: true });

    for (const row of cutRows) {
      const year = parseInt(row[0]);
      const title = row[1];
      const catRaw = row[2];
      const subjectName = row[3]; // Col 4
      const alternateInfo = row[9]; // Col 10 (Character / Info)

      if (year !== 2022) continue;

      const filmId = await getFilmId(title, year);
      const categoryId = categoryIdMap.get(normalizeCategory(catRaw));

      if (!filmId || !categoryId) {
        skipped++;
        continue;
      }

      let detail: string | null = null;
      const catName = normalizeCategory(catRaw);
      if (catName.includes('Actor') || catName.includes('Actress')) {
        detail = subjectName;
      } else if (catName === 'Original Song') {
        detail = alternateInfo || subjectName;
      } else if (catName === 'Screenplay (Adapted)') {
        detail = row[10] || alternateInfo; // Col 11 often has source
      } else {
        // For others, if it's a "named" consideration (like a specific person's work)
        // But usually we just want the film grouped.
        // If subjectName is present and category is e.g. Directing, we'll use subjectName.
        if (subjectName && subjectName !== title) {
          detail = subjectName;
        }
      }

      // Check for dupe
      const existing = await client.query(
        "SELECT consideration_id FROM considerations WHERE film_id = $1 AND category_id = $2 AND year = $3 AND (detail = $4 OR (detail IS NULL AND $4 IS NULL))",
        [filmId, categoryId, year, detail]
      );

      if (existing.rows.length === 0) {
        await client.query(
          "INSERT INTO considerations (film_id, category_id, year, detail) VALUES ($1, $2, $3, $4)",
          [filmId, categoryId, year, detail]
        );
        created++;
      } else {
        existed++;
      }
    }
  }

  // --- 2. Process Nominees.csv (2022-2024+) ---
  const nomineesPath = path.join(process.cwd(), 'data', 'The SpyGlasses Full (2022 Update) - Nominees.csv');
  if (fs.existsSync(nomineesPath)) {
    console.log('Processing Nominees.csv...');
    const nomineesRaw = fs.readFileSync(nomineesPath, 'utf8');
    const nomineeRows = parse(nomineesRaw, { columns: true, skip_empty_lines: true }) as NomineeRow[];

    for (const row of nomineeRows) {
      const year = parseInt(row.Year);
      if (isNaN(year) || year < 2022) continue;

      // For 2022, only TRUE. For 2023+, all.
      if (year === 2022 && row.Nominated !== 'TRUE') continue;

      const filmId = await getFilmId(row.Film, year);
      const categoryId = categoryIdMap.get(normalizeCategory(row.Category));

      if (!filmId || !categoryId) {
        skipped++;
        continue;
      }

      let detail: string | null = null;
      const catName = normalizeCategory(row.Category);
      
      if (catName.includes('Actor') || catName.includes('Actress')) {
        // Need to resolve Name from p_id
        // p_id is like 'p001816'
        // Let's try to find them in the DB
        const pId = row.p_id;
        const res = await client.query("SELECT name FROM people WHERE imdb_id = $1 LIMIT 1", [pId]);
        if (res.rows.length > 0) {
          detail = res.rows[0].name;
        } else {
          // Fallback? Maybe they are just not in DB yet?
          // But they should be from previous migrations.
          console.log(`  WARN: person ${pId} not found in DB`);
          skipped++;
          continue;
        }
      } else if (catName === 'Original Song' || catName === 'Screenplay (Adapted)') {
        detail = row.Title || null;
      } else {
        // For other categories, if there is a person linked in Nominees.csv,
        // we might want their name.
        if (row.p_id) {
          const res = await client.query("SELECT name FROM people WHERE imdb_id = $1 LIMIT 1", [row.p_id]);
          if (res.rows.length > 0) detail = res.rows[0].name;
        }
      }

      // Check for dupe
      const existing = await client.query(
        "SELECT consideration_id FROM considerations WHERE film_id = $1 AND category_id = $2 AND year = $3 AND (detail = $4 OR (detail IS NULL AND $4 IS NULL))",
        [filmId, categoryId, year, detail]
      );

      if (existing.rows.length === 0) {
        await client.query(
          "INSERT INTO considerations (film_id, category_id, year, detail) VALUES ($1, $2, $3, $4)",
          [filmId, categoryId, year, detail]
        );
        created++;
      } else {
        existed++;
      }
    }
  }

  console.log(`\n=== BACKFILL COMPLETE ===`);
  console.log(`Created: ${created}`);
  console.log(`Existed: ${existed}`);
  console.log(`Skipped: ${skipped}`);

  await client.end();
}

main().catch(console.error);
