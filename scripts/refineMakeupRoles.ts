import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const EXACT_ROLES: Record<string, string> = {
  'Mike Hill': 'Prosthetic Designer',
  'Jordan Samuel': 'Makeup Designer',
  'Cliona Furey': 'Hair Designer',
  
  'Kyoko Toyokawa': 'Makeup Designer',
  'Naomi Hibino': 'Makeup Designer',
  'Tadashi Nishimatsu': 'Hair Designer',
  
  'Ken Diaz': 'Makeup Designer',
  'Mike Fontaine': 'Prosthetic Designer',
  'Shunika Terry': 'Hair Designer',
  
  'Kazu Hiro': 'Prosthetic Designer',
  'Glen Griffin': 'Makeup Designer',
  'Bjoern Rehbein': 'Makeup Designer',

  'Frances Hannon': 'Makeup & Hair Designer',
  'Mark Coulier': 'Prosthetic Designer'
};

async function ensureRole(roleName: string): Promise<number> {
  const result = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
  if (result.rows.length > 0) return result.rows[0].role_id;
  const ins = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id', [roleName]);
  return ins.rows[0].role_id;
}

async function run() {
  const roleCache: Record<string, number> = {};
  for (const roleStr of Object.values(EXACT_ROLES)) {
     if (!roleCache[roleStr]) {
         roleCache[roleStr] = await ensureRole(roleStr);
     }
  }

  // Find all nominations in 2025 makeup category 
  const nomResult = await pool.query(`
    SELECT n.nomination_id, f.title
    FROM nominations n
    JOIN films f ON n.film_id = f.film_id
    JOIN categories cat ON n.category_id = cat.category_id
    JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
    WHERE (cat.name ILIKE '%Make-up%' OR cat.name ILIKE '%Makeup%' OR cat.name ILIKE '%Hairstyling%')
      AND ce.year = 2025
  `);

  let updateCount = 0;

  for (const nom of nomResult.rows) {
     const peopleInNom = await pool.query(`
         SELECT np.nomination_person_id, p.name 
         FROM nomination_people np
         JOIN people p ON np.person_id = p.person_id
         WHERE np.nomination_id = $1
     `, [nom.nomination_id]);

     for (const personRow of peopleInNom.rows) {
          const expectedRole = EXACT_ROLES[personRow.name];
          if (expectedRole) {
              const rId = roleCache[expectedRole];
              await pool.query(`
                 UPDATE nomination_people SET role_id = $1 WHERE nomination_person_id = $2
              `, [rId, personRow.nomination_person_id]);
              updateCount++;
          }
     }
  }
  
  console.log(`Updated ${updateCount} specific granular roles across Makeup & Hairstyling.`);

  await pool.end();
}

run().catch(console.error);
