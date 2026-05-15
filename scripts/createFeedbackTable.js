const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const query = `
    CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        email TEXT,
        page_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await client.query(query);
  console.log("Feedback table created successfully.");
  await client.end();
}

createTable().catch(console.error);
