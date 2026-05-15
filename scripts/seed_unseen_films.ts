/**
 * Seeds the unseen_films table with known films Rich Picks did not screen.
 * Run after create_unseen_films_table.sql has been applied.
 *
 * Usage: npx tsx scripts/seed_unseen_films.ts
 */

import { query } from '../lib/db';

const UNSEEN_FILMS: Array<{ title: string; year: number }> = [
  // 2023
  { title: 'Memory', year: 2023 },
  { title: 'Monster', year: 2023 },
  { title: 'Sparta', year: 2023 },
  { title: 'Strange Way of Life', year: 2023 },
  { title: 'Sound of Freedom', year: 2023 },
  { title: 'Master Gardener', year: 2023 },
  { title: 'The Peasants', year: 2023 },
  { title: 'Suzume', year: 2023 },
  { title: 'Mad about the Boy: The Noël Coward Story', year: 2023 },
  { title: 'Flora and Son', year: 2023 },
  { title: '20 Days in Mariupol', year: 2023 },

  // 2024
  { title: 'All We Imagine as Light', year: 2024 },
  { title: 'The End', year: 2024 },
  { title: 'Parthenope', year: 2024 },
  { title: 'The Outrun', year: 2024 },
  { title: 'Made in England: The Films of Powell and Pressburger', year: 2024 },
  { title: 'The Fall Guy', year: 2024 },
  { title: 'Mufasa', year: 2024 },
  { title: 'Hit Man', year: 2024 },

  // 2025
  { title: 'Sound of Falling', year: 2025 },
  { title: 'The Ugly Stepsister', year: 2025 },
  { title: 'The Phoenician Scheme', year: 2025 },
  { title: 'Superman', year: 2025 },
  { title: 'Snow White', year: 2025 },
  { title: 'I Swear', year: 2025 },
  { title: 'Dragonfly', year: 2025 },
  { title: 'Urchin', year: 2025 },
  { title: 'Ballad of a Wallis Island', year: 2025 },
  { title: 'The Great Arch', year: 2025 },
  { title: 'Beautiful Evening, Beautiful Day', year: 2025 },
  { title: 'Jean Cocteau', year: 2025 },
  { title: 'A Night Like This', year: 2025 },
  { title: 'The Story of Stone', year: 2025 },
  { title: 'Demon Slayer: Kimetsu no Yaiba – The Movie: Infinity Castle', year: 2025 },
  { title: 'In Your Dreams', year: 2025 },
  { title: 'Predator: Killer of Killers', year: 2025 },
];

async function findOrCreateFilm(title: string, year: number): Promise<number> {
  // Try exact match first
  let res = await query(
    `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1)`,
    [title]
  );
  if (res.rows.length > 0) return res.rows[0].film_id;

  // Partial match as fallback
  res = await query(
    `SELECT film_id FROM films WHERE LOWER(title) ILIKE $1 ORDER BY ABS(release_year - $2) NULLS LAST LIMIT 1`,
    [`%${title.toLowerCase()}%`, year]
  );
  if (res.rows.length > 0) {
    console.log(`  ~ fuzzy match for "${title}" → existing record`);
    return res.rows[0].film_id;
  }

  // Create stub record
  const ins = await query(
    `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
    [title, year]
  );
  console.log(`  + created stub film: "${title}" (${year})`);
  return ins.rows[0].film_id;
}

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const { title, year } of UNSEEN_FILMS) {
    try {
      const filmId = await findOrCreateFilm(title, year);
      const res = await query(
        `INSERT INTO unseen_films (film_id, year) VALUES ($1, $2) ON CONFLICT (film_id, year) DO NOTHING`,
        [filmId, year]
      );
      if ((res.rowCount ?? 0) > 0) {
        inserted++;
        console.log(`  ✓ ${year} – ${title}`);
      } else {
        skipped++;
        console.log(`  · ${year} – ${title} (already exists)`);
      }
    } catch (err: any) {
      console.error(`  ✗ ${year} – ${title}: ${err.message}`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
