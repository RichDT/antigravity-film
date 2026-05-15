/**
 * Merge near-duplicate film entries in the database.
 *
 * The source CSVs used inconsistent title formatting (all-caps, dropped
 * leading articles, punctuation variants), causing the same film to be
 * ingested twice under different film_ids.
 *
 * For each duplicate pair:
 *   1. Canonical = film with Rich Picks nominations; else the one with more
 *      total nominations; else lower film_id.
 *   2. All nominations, film_crew, songs, and considerations from the
 *      duplicate are re-pointed to the canonical film_id.
 *   3. The canonical title is updated to the better-formatted version where
 *      needed (e.g. "First Cow?" → "First Cow").
 *   4. The duplicate film row is deleted.
 *
 * Run:  npx tsx scripts/mergeFilmDuplicates.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------------------------------------------------------
// Title corrections: after merging, set the canonical title to this string.
// Only listed when the winning film_id has a suboptimal title.
// ---------------------------------------------------------------------------
const TITLE_OVERRIDES: Record<number, string> = {
  // First Cow? → First Cow  (canonical will be 1453 which already has correct title)
  // These are keyed by the *canonical* film_id after merge logic runs.
  // Populated dynamically below where needed.
};

async function main() {
  const client = await pool.connect();
  try {
    // ------------------------------------------------------------------
    // 1. Find all duplicate pairs
    // ------------------------------------------------------------------
    const { rows: pairs } = await client.query<{
      id_a: number; title_a: string;
      id_b: number; title_b: string;
      release_year: number;
      noms_a: number; noms_b: number;
      rp_a: number;  rp_b: number;
    }>(`
      WITH pairs AS (
        SELECT a.film_id AS id_a, a.title AS title_a,
               b.film_id AS id_b, b.title AS title_b,
               a.release_year
        FROM films a
        JOIN films b
          ON a.release_year = b.release_year
         AND a.film_id < b.film_id
        WHERE a.release_year IS NOT NULL
          AND lower(regexp_replace(regexp_replace(a.title, '^(The|A|An) ','','i'),'[^a-zA-Z0-9 ]','','g'))
            = lower(regexp_replace(regexp_replace(b.title, '^(The|A|An) ','','i'),'[^a-zA-Z0-9 ]','','g'))
      )
      SELECT p.id_a, p.title_a, p.id_b, p.title_b, p.release_year,
        (SELECT COUNT(*)::int FROM nominations WHERE film_id = p.id_a) AS noms_a,
        (SELECT COUNT(*)::int FROM nominations WHERE film_id = p.id_b) AS noms_b,
        (SELECT COUNT(*)::int FROM nominations n
           JOIN ceremonies c USING (ceremony_id)
           JOIN awards aw ON c.award_id = aw.award_id
           JOIN organizations o ON aw.organization_id = o.organization_id
           WHERE n.film_id = p.id_a AND o.short_name = 'Rich Picks') AS rp_a,
        (SELECT COUNT(*)::int FROM nominations n
           JOIN ceremonies c USING (ceremony_id)
           JOIN awards aw ON c.award_id = aw.award_id
           JOIN organizations o ON aw.organization_id = o.organization_id
           WHERE n.film_id = p.id_b AND o.short_name = 'Rich Picks') AS rp_b
      FROM pairs p
      ORDER BY p.release_year DESC
    `);

    if (pairs.length === 0) {
      console.log('No duplicate pairs found — nothing to do.');
      return;
    }

    console.log(`Found ${pairs.length} duplicate pairs.\n`);

    // ------------------------------------------------------------------
    // 2. Decide canonical / duplicate for each pair
    // ------------------------------------------------------------------
    type MergePlan = {
      canonicalId: number; canonicalTitle: string;
      duplicateId: number; duplicateTitle: string;
      year: number;
      finalTitle: string;
    };

    // Better-title heuristics: prefer proper title case over all-caps,
    // prefer titles with a leading "The/A" over stripped ones,
    // prefer no trailing punctuation artifact.
    function titleScore(t: string): number {
      let score = 0;
      if (/^(The|A|An) /i.test(t)) score += 2;           // has leading article
      if (t === t.toLowerCase() || t === t.toUpperCase()) score -= 3; // all-lower or all-upper
      if (/[?]$/.test(t)) score -= 2;                    // trailing ?
      if (/\.$/.test(t) && t.length > 6) score -= 1;    // trailing . (e.g. "Emma.")
      if (/[A-Z]/.test(t[0])) score += 1;               // starts with capital
      return score;
    }

    const plans: MergePlan[] = pairs.map(p => {
      let canonicalId: number;
      let duplicateId: number;

      // Priority 1: Rich Picks nominations
      if (p.rp_a > 0 && p.rp_b === 0) {
        canonicalId = p.id_a; duplicateId = p.id_b;
      } else if (p.rp_b > 0 && p.rp_a === 0) {
        canonicalId = p.id_b; duplicateId = p.id_a;
      }
      // Priority 2: total nomination count
      else if (p.noms_a > p.noms_b) {
        canonicalId = p.id_a; duplicateId = p.id_b;
      } else if (p.noms_b > p.noms_a) {
        canonicalId = p.id_b; duplicateId = p.id_a;
      }
      // Priority 3: lower film_id
      else {
        canonicalId = p.id_a; duplicateId = p.id_b;
      }

      const canonicalTitle = canonicalId === p.id_a ? p.title_a : p.title_b;
      const duplicateTitle = canonicalId === p.id_a ? p.title_b : p.title_a;

      // Choose the better-formatted title as the final display title
      const tsA = titleScore(p.title_a);
      const tsB = titleScore(p.title_b);
      const betterTitle = tsA >= tsB ? p.title_a : p.title_b;
      const finalTitle = TITLE_OVERRIDES[canonicalId] ?? betterTitle;

      return { canonicalId, canonicalTitle, duplicateId, duplicateTitle, year: p.release_year, finalTitle };
    });

    // Print plan
    plans.forEach(p => {
      const titleChange = p.finalTitle !== p.canonicalTitle ? ` → title: "${p.finalTitle}"` : '';
      console.log(`  ${p.year}: keep [${p.canonicalId}] "${p.canonicalTitle}"${titleChange}`);
      console.log(`         drop [${p.duplicateId}] "${p.duplicateTitle}"`);
    });

    // ------------------------------------------------------------------
    // 3. Execute inside a single transaction
    // ------------------------------------------------------------------
    console.log('\nExecuting...');
    await client.query('BEGIN');

    let totalNomsMoved = 0;
    let totalCrewMoved = 0;
    let totalSongsMoved = 0;

    for (const plan of plans) {
      const { canonicalId, duplicateId, finalTitle, canonicalTitle } = plan;

      // Re-point nominations
      const { rowCount: nomsMoved } = await client.query(
        `UPDATE nominations SET film_id = $1 WHERE film_id = $2`,
        [canonicalId, duplicateId]
      );
      totalNomsMoved += nomsMoved ?? 0;

      // Re-point film_crew — delete rows that would violate the unique constraint
      // (same film_id + person_id + crew_role already exists on canonical), then move the rest
      await client.query(
        `DELETE FROM film_crew fc
         WHERE fc.film_id = $2
           AND EXISTS (
             SELECT 1 FROM film_crew fc2
             WHERE fc2.film_id = $1
               AND fc2.person_id = fc.person_id
               AND fc2.crew_role = fc.crew_role
           )`,
        [canonicalId, duplicateId]
      );
      const { rowCount: crewMoved } = await client.query(
        `UPDATE film_crew SET film_id = $1 WHERE film_id = $2`,
        [canonicalId, duplicateId]
      );
      totalCrewMoved += crewMoved ?? 0;

      // Re-point songs
      const { rowCount: songsMoved } = await client.query(
        `UPDATE songs SET film_id = $1 WHERE film_id = $2`,
        [canonicalId, duplicateId]
      );
      totalSongsMoved += songsMoved ?? 0;

      // Re-point considerations (if any)
      await client.query(
        `UPDATE considerations SET film_id = $1 WHERE film_id = $2`,
        [canonicalId, duplicateId]
      );

      // Re-point reviews (if any)
      await client.query(
        `UPDATE reviews SET film_id = $1 WHERE film_id = $2`,
        [canonicalId, duplicateId]
      );

      // Update canonical title if needed
      if (finalTitle !== canonicalTitle) {
        await client.query(
          `UPDATE films SET title = $1 WHERE film_id = $2`,
          [finalTitle, canonicalId]
        );
      }

      // Delete duplicate
      await client.query(`DELETE FROM films WHERE film_id = $1`, [duplicateId]);
    }

    await client.query('COMMIT');

    console.log(`\n✅ Done.`);
    console.log(`   ${plans.length} pairs merged`);
    console.log(`   ${totalNomsMoved} nominations re-pointed`);
    console.log(`   ${totalCrewMoved} film_crew rows re-pointed`);
    console.log(`   ${totalSongsMoved} song rows re-pointed`);

  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Fatal — rolled back:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
