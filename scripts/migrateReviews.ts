import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface FilmData {
  title: string;
  year: string;
  grade: string;
}

async function migrateReviews() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB');

  try {
    // Read films.json
    const filmsPath = path.join(process.cwd(), 'data', 'films.json');
    const rawData = fs.readFileSync(filmsPath, 'utf8');
    const films: FilmData[] = JSON.parse(rawData);

    // Filter to films with grades
    const graded = films.filter(f => f.grade && f.grade.trim() !== '');
    console.log(`Found ${graded.length} films with grades out of ${films.length} total`);

    let inserted = 0;
    let skipped = 0;
    let notFound = 0;

    for (const f of graded) {
      const yearInt = parseInt(f.year);
      if (isNaN(yearInt)) {
        skipped++;
        continue;
      }

      // Try to find the film in the DB
      const filmRes = await client.query(
        `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND release_year = $2`,
        [f.title.trim(), yearInt]
      );

      if (filmRes.rows.length === 0) {
        // Try without year match
        const looseRes = await client.query(
          `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) ORDER BY release_year DESC LIMIT 1`,
          [f.title.trim()]
        );
        if (looseRes.rows.length === 0) {
          notFound++;
          continue;
        }
        const filmId = looseRes.rows[0].film_id;
        await client.query(
          `INSERT INTO reviews (film_id, grade) VALUES ($1, $2)
           ON CONFLICT (film_id) DO UPDATE SET grade = EXCLUDED.grade, updated_at = CURRENT_TIMESTAMP`,
          [filmId, f.grade.trim()]
        );
        inserted++;
      } else {
        const filmId = filmRes.rows[0].film_id;
        await client.query(
          `INSERT INTO reviews (film_id, grade) VALUES ($1, $2)
           ON CONFLICT (film_id) DO UPDATE SET grade = EXCLUDED.grade, updated_at = CURRENT_TIMESTAMP`,
          [filmId, f.grade.trim()]
        );
        inserted++;
      }
    }

    console.log(`Migration complete: ${inserted} reviews inserted, ${skipped} skipped, ${notFound} not found in DB`);

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await client.end();
  }
}

migrateReviews();
