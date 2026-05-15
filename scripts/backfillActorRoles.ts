import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // Fix specific considerations explicitly cited by the user
  console.log('Deleting duplicate considerations 28 and 133...');
  await pool.query(`DELETE FROM considerations WHERE consideration_id IN (28, 133)`);

  // Goal: Find all 2025 Rich Picks nominations that have a role assigned.
  // Then, for the same film, category category group, and person, assign that same role to any other organizations' nominations where role_id is null or different.
  
  // Note: we can map exact category, but RP category names sometimes differ slightly from external orgs.
  // A safer approach: simply group by film_id and person_id within the same year (2025),
  // provided the category implies acting.
  
  console.log('Querying 2025 RP actor roles...');
  const rpRolesResult = await pool.query(`
    SELECT n.film_id, np.person_id, np.role_id, f.title
    FROM nominations n
    JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
    JOIN organizations o ON ce.award_id = (SELECT award_id FROM awards WHERE award_id = ce.award_id LIMIT 1) -- get org
    JOIN nomination_people np ON n.nomination_id = np.nomination_id
    JOIN categories cat ON n.category_id = cat.category_id
    JOIN films f ON n.film_id = f.film_id
    WHERE o.short_name = 'Rich Picks' 
      AND ce.year = 2025
      AND np.role_id IS NOT NULL
      AND (cat.name ILIKE '%Actor%' OR cat.name ILIKE '%Actress%' OR cat.name ILIKE '%Performance%' OR cat.name ILIKE '%Cast%' OR cat.name ILIKE '%Ensemble%')
  `);
  
  let updatedCount = 0;
  
  for (const row of rpRolesResult.rows) {
      if (!row.role_id) continue;
      
      const updateRes = await pool.query(`
         UPDATE nomination_people np
         SET role_id = $1
         FROM nominations n
         JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
         WHERE np.nomination_id = n.nomination_id
           AND n.film_id = $2
           AND np.person_id = $3
           AND (np.role_id IS NULL OR np.role_id != $1)
           AND ce.year = 2025
      `, [row.role_id, row.film_id, row.person_id]);
      
      if (updateRes.rowCount && updateRes.rowCount > 0) {
         console.log(`Updated ${updateRes.rowCount} nominations to match RP role for person ${row.person_id} in film ${row.title}`);
         updatedCount += updateRes.rowCount;
      }
  }

  console.log(`Successfully backfilled ${updatedCount} roles across other nominations based on 2025 RP data.`);
  
  await pool.end();
}

run().catch(console.error);
