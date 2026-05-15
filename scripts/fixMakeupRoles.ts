import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DATA = [
  {
    title: 'Frankenstein',
    people: ['Mike Hill', 'Jordan Samuel', 'Cliona Furey']
  },
  {
    title: 'Kokuhō',
    people: ['Kyoko Toyokawa', 'Naomi Hibino', 'Tadashi Nishimatsu']
  },
  {
    title: 'Kokuho', // just in case
    people: ['Kyoko Toyokawa', 'Naomi Hibino', 'Tadashi Nishimatsu']
  },
  {
    title: 'Sinners',
    people: ['Ken Diaz', 'Mike Fontaine', 'Shunika Terry']
  },
  {
    title: 'The Smashing Machine',
    people: ['Kazu Hiro', 'Glen Griffin', 'Bjoern Rehbein']
  },
  {
    title: 'Wicked: For Good',
    people: ['Frances Hannon', 'Mark Coulier']
  }
];

async function ensurePerson(name: string): Promise<number> {
  const result = await pool.query('SELECT person_id FROM people WHERE name = $1', [name]);
  if (result.rows.length > 0) return result.rows[0].person_id;
  const ins = await pool.query('INSERT INTO people (name) VALUES ($1) RETURNING person_id', [name]);
  return ins.rows[0].person_id;
}

async function ensureRole(roleName: string): Promise<number> {
  const result = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
  if (result.rows.length > 0) return result.rows[0].role_id;
  const ins = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id', [roleName]);
  return ins.rows[0].role_id;
}

async function run() {
  const roleId = await ensureRole('Makeup & Hair Designer');

  for (const item of DATA) {
    const personIds = [];
    for (const p of item.people) {
      personIds.push(await ensurePerson(p));
    }

    // Find all nominations for this film for Makeup in 2025
    const nomResult = await pool.query(`
      SELECT n.nomination_id, f.title
      FROM nominations n
      JOIN films f ON n.film_id = f.film_id
      JOIN categories cat ON n.category_id = cat.category_id
      JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
      WHERE f.title = $1
        AND (cat.name ILIKE '%Make-up%' OR cat.name ILIKE '%Makeup%' OR cat.name ILIKE '%Hairstyling%')
        AND ce.year = 2025
    `, [item.title]);

    for (const nom of nomResult.rows) {
      for (const pId of personIds) {
          const check = await pool.query('SELECT nomination_person_id FROM nomination_people WHERE nomination_id = $1 AND person_id = $2', [nom.nomination_id, pId]);
          if (check.rows.length > 0) {
            await pool.query('UPDATE nomination_people SET role_id = $1 WHERE nomination_person_id = $2', [roleId, check.rows[0].nomination_person_id]);
          } else {
            await pool.query('INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)', [nom.nomination_id, pId, roleId]);
          }
      }
      
      // Cleanup generic/other people that aren't in the canonical list for this nomination to avoid bloat
      await pool.query(`
        DELETE FROM nomination_people 
        WHERE nomination_id = $1 
          AND person_id NOT IN (${personIds.join(',')})
      `, [nom.nomination_id]);
    }
    console.log(`Updated Makeup & Hairstyling records for ${item.title}`);
  }

  await pool.end();
}

run().catch(console.error);
