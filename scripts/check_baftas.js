import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function checkBAFTAs() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const orgRes = await client.query(`SELECT * FROM organizations WHERE name ILIKE '%BAFTA%' OR short_name ILIKE '%BAFTA%'`);
        console.log('Organizations:', orgRes.rows);

        if (orgRes.rows.length > 0) {
            const orgId = orgRes.rows[0].organization_id;
            const awardRes = await client.query(`SELECT * FROM awards WHERE organization_id = $1`, [orgId]);
            console.log('Awards:', awardRes.rows);
            
            if (awardRes.rows.length > 0) {
                const awardId = awardRes.rows[0].award_id;
                const ceremoniesRes = await client.query(`SELECT * FROM ceremonies WHERE award_id = $1 ORDER BY year DESC`, [awardId]);
                console.log('Ceremonies count:', ceremoniesRes.rows.length);
                console.log('Ceremonies:', ceremoniesRes.rows.map(c => c.year).join(', '));
                
                // Get the earliest ceremony
                const earliestCeremony = ceremoniesRes.rows[ceremoniesRes.rows.length - 1];
                if (earliestCeremony) {
                    const nomsRes = await client.query(`
                        SELECT COUNT(*) FROM nominations WHERE ceremony_id = $1
                    `, [earliestCeremony.ceremony_id]);
                    console.log(`Nominations in earliest ceremony (${earliestCeremony.year}):`, nomsRes.rows[0].count);
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

checkBAFTAs();
