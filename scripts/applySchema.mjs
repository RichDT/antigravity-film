import { Client } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

dns.setDefaultResultOrder('ipv6first');

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function applySchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const schemaSql = fs.readFileSync(path.join(process.cwd(), 'scripts', 'schema.sql'), 'utf-8');
        await client.connect();
        console.log('Connected to database, applying schema...');

        await client.query(schemaSql);
        console.log('Schema applied successfully.');
    } catch (error) {
        console.error('Error applying schema:', error);
    } finally {
        await client.end();
    }
}

applySchema();
