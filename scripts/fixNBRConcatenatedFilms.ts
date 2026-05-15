/**
 * Fix NBR nominations where multiple film titles were concatenated into a single
 * film record. For each case:
 *   1. Find or create proper film records for each individual title
 *   2. Create separate nominations for each film, linked to the same person
 *   3. Delete the original nomination and orphaned concatenated film record
 *
 * Two categories of fixes:
 *   A. Best Film ties: two separate winning nominations (no person attached)
 *   B. Acting/directing multi-film recognitions: one person, multiple film nominations
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.migration' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Fix definitions ───────────────────────────────────────────────────────────

// Category A: Best Film ties (no person)
const bestFilmTies = [
  { nom_id: 179209, film_id: 11269, titles: ['Chariots of Fire', 'Reds'], year: 1981 },
];

// Category B: Acting/directing multi-film recognitions (one person, many films)
const multiFilmNoms = [
  { nom_id: 180109, film_id: 11540, titles: ['The Heiress', 'The Fallen Idol'], year: 1949 },
  { nom_id: 180094, film_id: 11533, titles: ['Face to Face', 'The Desert Rats', 'The Man Between', 'Julius Caesar'], year: 1953 },
  { nom_id: 180095, film_id: 11534, titles: ['Young Bess', 'The Robe', 'The Actress'], year: 1953 },
  { nom_id: 180089, film_id: 11530, titles: ['The Country Girl', 'Dial M for Murder', 'Rear Window'], year: 1954 },
  { nom_id: 180090, film_id: 11531, titles: ['Sabrina', 'Dial M for Murder'], year: 1954 },
  { nom_id: 180085, film_id: 11528, titles: ['A Man Called Peter', "The View from Pompey's Head"], year: 1955 },
  { nom_id: 180076, film_id: 11526, titles: ['The King and I', 'Anastasia', 'The Ten Commandments'], year: 1956 },
  { nom_id: 180071, film_id: 11523, titles: ['The Three Faces of Eve', 'No Down Payment'], year: 1957 },
  { nom_id: 180064, film_id: 11520, titles: ['The Old Man and the Sea', 'The Last Hurrah'], year: 1958 },
  { nom_id: 180066, film_id: 11521, titles: ['The Brothers Karamazov', 'The Bravados'], year: 1958 },
  { nom_id: 180052, film_id: 11518, titles: ['The Sundowners', 'Home from the Hill'], year: 1960 },
  { nom_id: 180040, film_id: 11514, titles: ["Long Day's Journey Into Night", 'Tender is the Night'], year: 1962 },
  { nom_id: 180043, film_id: 11516, titles: ['The Manchurian Candidate', 'All Fall Down'], year: 1962 },
  { nom_id: 180002, film_id: 11500, titles: ['Cat Ballou', 'Ship of Fools'], year: 1965 },
  { nom_id: 180003, film_id: 11501, titles: ['Doctor Zhivago', 'Darling'], year: 1965 },
  { nom_id: 180004, film_id: 11502, titles: ['The Agony and the Ecstasy', 'The Hill'], year: 1965 },
  { nom_id: 179991, film_id: 11498, titles: ['Hour of the Wolf', 'Shame'], year: 1968 },
  { nom_id: 180884, film_id: 11823, titles: ['Diary of a Mad Housewife', 'The Twelve Chairs'], year: 1970 },
  { nom_id: 179982, film_id: 11496, titles: ['The Devils', 'The Boy Friend'], year: 1971 },
  { nom_id: 179971, film_id: 11494, titles: ['Man of La Mancha', 'The Ruling Class'], year: 1972 },
  { nom_id: 179909, film_id: 11482, titles: ['Manhattan', 'The Seduction of Joe Tynan', 'Kramer vs. Kramer'], year: 1979 },
  { nom_id: 179888, film_id: 11477, titles: ['Reuben, Reuben', 'Merry Christmas, Mr. Lawrence'], year: 1983 },
  { nom_id: 179745, film_id: 11446, titles: ['The Remains of the Day', 'Shadowlands'], year: 1993 },
  { nom_id: 179713, film_id: 11437, titles: ['The Usual Suspects', 'Se7en'], year: 1995 },
  { nom_id: 179676, film_id: 11427, titles: ['Donnie Brasco', 'Wag the Dog'], year: 1997 },
  { nom_id: 179639, film_id: 11417, titles: ['Magnolia', 'The Talented Mr. Ripley'], year: 1999 },
  { nom_id: 179640, film_id: 11418, titles: ['Magnolia', 'A Map of the World', 'An Ideal Husband'], year: 1999 },
  { nom_id: 179586, film_id: 11396, titles: ["The Man Who Wasn't There", "Monster's Ball", 'Bandits'], year: 2001 },
  { nom_id: 179589, film_id: 11398, titles: ['The Lord of the Rings: The Fellowship of the Ring', 'The Man Who Cried', 'The Shipping News'], year: 2001 },
  { nom_id: 180500, film_id: 11646, titles: ['Adaptation.', 'Confessions of a Dangerous Mind', 'Human Nature'], year: 2002 },
  { nom_id: 180378, film_id: 11572, titles: ['Crash', "Get Rich or Die Tryin'", 'Hustle & Flow'], year: 2005 },
];

async function findOrCreateFilm(title: string, year: number): Promise<number> {
  // Try exact match first
  let res = await pool.query(
    `SELECT film_id FROM films WHERE title = $1 AND release_year = $2 LIMIT 1`,
    [title, year]
  );
  if (res.rows.length > 0) return res.rows[0].film_id;

  // Try case-insensitive
  res = await pool.query(
    `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND release_year = $2 LIMIT 1`,
    [title, year]
  );
  if (res.rows.length > 0) return res.rows[0].film_id;

  // Try without release_year constraint (some films may have slightly different years)
  res = await pool.query(
    `SELECT film_id FROM films WHERE LOWER(title) = LOWER($1) AND ABS(release_year - $2) <= 1 LIMIT 1`,
    [title, year]
  );
  if (res.rows.length > 0) return res.rows[0].film_id;

  // Create new film
  res = await pool.query(
    `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
    [title, year]
  );
  console.log(`    Created new film: "${title}" (${year}) → film_id=${res.rows[0].film_id}`);
  return res.rows[0].film_id;
}

async function main() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // ── Fix Best Film ties ────────────────────────────────────────────────────
    for (const fix of bestFilmTies) {
      console.log(`\nFIXING Best Film tie: nom_id=${fix.nom_id} "${fix.titles.join(', ')}"`);
      
      // Get ceremony_id and category_id from the original nomination
      const origRes = await client.query(
        `SELECT ceremony_id, category_id, win, notes FROM nominations WHERE nomination_id = $1`,
        [fix.nom_id]
      );
      if (origRes.rows.length === 0) {
        console.log(`  ⚠ Nomination ${fix.nom_id} not found, skipping`);
        continue;
      }
      const { ceremony_id, category_id, win, notes } = origRes.rows[0];
      
      for (const title of fix.titles) {
        const filmId = await findOrCreateFilm(title, fix.year);
        const newNom = await client.query(
          `INSERT INTO nominations (ceremony_id, category_id, film_id, win, notes)
           VALUES ($1, $2, $3, $4, $5) RETURNING nomination_id`,
          [ceremony_id, category_id, filmId, win, notes]
        );
        console.log(`  ✓ Created nom_id=${newNom.rows[0].nomination_id} for "${title}" (film_id=${filmId})`);
      }
      
      // Delete original nomination
      await client.query(`DELETE FROM nomination_people WHERE nomination_id = $1`, [fix.nom_id]);
      await client.query(`DELETE FROM nominations WHERE nomination_id = $1`, [fix.nom_id]);
      console.log(`  ✓ Deleted original nom_id=${fix.nom_id}`);
    }

    // ── Fix acting/directing multi-film recognitions ──────────────────────────
    for (const fix of multiFilmNoms) {
      console.log(`\nFIXING multi-film: nom_id=${fix.nom_id} "${fix.titles.join(', ')}"`);
      
      const origRes = await client.query(
        `SELECT ceremony_id, category_id, win, notes FROM nominations WHERE nomination_id = $1`,
        [fix.nom_id]
      );
      if (origRes.rows.length === 0) {
        console.log(`  ⚠ Nomination ${fix.nom_id} not found, skipping`);
        continue;
      }
      const { ceremony_id, category_id, win, notes } = origRes.rows[0];
      
      // Get attached people
      const peopleRes = await client.query(
        `SELECT person_id, role_id FROM nomination_people WHERE nomination_id = $1`,
        [fix.nom_id]
      );
      const people = peopleRes.rows;
      
      for (const title of fix.titles) {
        const filmId = await findOrCreateFilm(title, fix.year);
        const newNom = await client.query(
          `INSERT INTO nominations (ceremony_id, category_id, film_id, win, notes)
           VALUES ($1, $2, $3, $4, $5) RETURNING nomination_id`,
          [ceremony_id, category_id, filmId, win, notes]
        );
        const newNomId = newNom.rows[0].nomination_id;
        
        // Attach same people
        for (const p of people) {
          await client.query(
            `INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)`,
            [newNomId, p.person_id, p.role_id]
          );
        }
        console.log(`  ✓ Created nom_id=${newNomId} for "${title}" (film_id=${filmId}) with ${people.length} people`);
      }
      
      // Delete original
      await client.query(`DELETE FROM nomination_people WHERE nomination_id = $1`, [fix.nom_id]);
      await client.query(`DELETE FROM nominations WHERE nomination_id = $1`, [fix.nom_id]);
      console.log(`  ✓ Deleted original nom_id=${fix.nom_id}`);
    }

    // ── Clean up orphaned concatenated film records ────────────────────────────
    const orphanFilmIds = [
      ...bestFilmTies.map(f => f.film_id),
      ...multiFilmNoms.map(f => f.film_id),
    ];
    
    for (const filmId of orphanFilmIds) {
      // Check if the film record still has any nominations
      const nomCheck = await client.query(
        `SELECT COUNT(*) as cnt FROM nominations WHERE film_id = $1`, [filmId]
      );
      if (parseInt(nomCheck.rows[0].cnt) === 0) {
        // Safe to delete — no remaining references
        await client.query(`DELETE FROM film_crew WHERE film_id = $1`, [filmId]);
        await client.query(`DELETE FROM reviews WHERE film_id = $1`, [filmId]);
        await client.query(`DELETE FROM considerations WHERE film_id = $1`, [filmId]);
        await client.query(`DELETE FROM films WHERE film_id = $1`, [filmId]);
        console.log(`  🗑 Deleted orphaned film_id=${filmId}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ All fixes committed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error — rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
