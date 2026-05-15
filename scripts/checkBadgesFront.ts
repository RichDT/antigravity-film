import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migration' });
import { getCategoriesForYear } from '../lib/awards';

async function main() {
    console.log("Fetching categories for 2010...");
    const cats = await getCategoriesForYear(2010);
    const adapted = cats.find(c => c.name === 'Screenplay (Adapted)');
    if (adapted) {
        console.log("Adapted Screenplay nominees:");
        console.dir(adapted.nominees, { depth: null });
        console.log("Adapted Screenplay winner:");
        console.dir(adapted.winner, { depth: null });
    }
    process.exit(0);
}

main();
