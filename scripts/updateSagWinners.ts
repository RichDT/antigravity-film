import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const text = fs.readFileSync('/tmp/32nd_sag_wiki.txt', 'utf8');
  
  // Cut off television section since DB only has motion picture SAG awards
  let filmText = text.split('===Television===')[0] || text;
  const lines = filmText.split('\n');
  
  let currentCategory = '';
  const catRegex = /\{\{Award category\|[^\|]+\|\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]\}\}/;

  const winnersToUpdate: {category: string, matchText: string}[] = [];

  for (const line of lines) {
    let m = line.match(catRegex);
    if (m) {
      currentCategory = m[1].replace('Actor Award for ', '');
    } else if (line.includes('* \'\'\'') && currentCategory) {
      let cleaned = line;
      cleaned = cleaned.replace(/<ref[^>]*>.*?<\/ref>/g, '');
      cleaned = cleaned.replace(/<ref[^>]*\/>/g, '');
      
      let matchTextMatch = cleaned.match(/\* \'{3,5}\[\[([^\|\]]+)\|?([^\]]*)\]\]/);
      
      if (matchTextMatch) {
         winnersToUpdate.push({
           category: currentCategory,
           matchText: matchTextMatch[1]
         });
      }
    }
  }
  
  // Clear out any existing wins for ceremony 921
  await pool.query(`UPDATE nominations SET win = false WHERE ceremony_id = 921`);

  const allNoms = await pool.query(`
    SELECT n.nomination_id, f.title as film_title, c.name as category_name, p.name as person_name
    FROM nominations n
    JOIN films f ON n.film_id = f.film_id
    JOIN categories c ON n.category_id = c.category_id
    LEFT JOIN nomination_people np ON n.nomination_id = np.nomination_id
    LEFT JOIN people p ON np.person_id = p.person_id
    WHERE n.ceremony_id = 921
  `);

  let updatedCount = 0;

  for (const winner of winnersToUpdate) {
    let dbCategoryMatch = winner.category;
    if (winner.category === 'Outstanding Performance by a Male Actor in a Leading Role') dbCategoryMatch = 'Male Lead In A Motion Picture';
    else if (winner.category === 'Outstanding Performance by a Female Actor in a Leading Role') dbCategoryMatch = 'Female Lead In A Motion Picture';
    else if (winner.category === 'Outstanding Performance by a Male Actor in a Supporting Role') dbCategoryMatch = 'Male Support In A Motion Picture';
    else if (winner.category === 'Outstanding Performance by a Female Actor in a Supporting Role') dbCategoryMatch = 'Female Support In A Motion Picture';
    else if (winner.category === 'Outstanding Performance by a Cast in a Motion Picture') dbCategoryMatch = 'Cast In A Motion Picture';
    else if (winner.category === 'Outstanding Action Performance by a Stunt Ensemble in a Motion Picture') dbCategoryMatch = 'Stunt Ensemble In A Motion Picture';

    let cleanMatchText = winner.matchText.toLowerCase();
    if (cleanMatchText.includes(' (')) cleanMatchText = cleanMatchText.split(' (')[0];
    cleanMatchText = cleanMatchText.replace('mission: impossible – the final reckoning', 'the final reckoning');

    const matches = allNoms.rows.filter(r => {
      const catMatch = r.category_name === dbCategoryMatch;
      const personMatch = r.person_name && r.person_name.toLowerCase() === cleanMatchText;
      const filmMatch = r.film_title && r.film_title.toLowerCase() === cleanMatchText;

      if (dbCategoryMatch === 'Cast In A Motion Picture' || dbCategoryMatch === 'Stunt Ensemble In A Motion Picture') {
         return catMatch && filmMatch;
      }

      return catMatch && personMatch;
    });
    
    if (matches.length > 0) {
       console.log(`✅ Matched: ${winner.category} -> ${winner.matchText} (${matches.length} rows)`);
       for (const m of matches) {
          await pool.query(`UPDATE nominations SET win = true WHERE nomination_id = $1`, [m.nomination_id]);
          updatedCount++;
       }
    } else {
       console.log(`❌ Failed:  ${winner.category} -> ${winner.matchText} (clean match: ${cleanMatchText}) for cat ${dbCategoryMatch}`);
    }
  }

  console.log('Total updated rows:', updatedCount);
  await pool.end();
}

run().catch(console.error);
