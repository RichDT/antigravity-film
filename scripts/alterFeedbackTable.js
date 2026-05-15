const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function alterTable() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' NOT NULL;
    ALTER TABLE feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
  `);
  
  console.log("Feedback table altered successfully.");
  await client.end();
}
alterTable().catch(console.error);
