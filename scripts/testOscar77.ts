import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

function ordinalSuffix(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'th';
    const mod10 = n % 10;
    if (mod10 === 1) return 'st';
    if (mod10 === 2) return 'nd';
    if (mod10 === 3) return 'rd';
    return 'th';
}
function ordinal(n: number): string { return `${n}${ordinalSuffix(n)}`; }

async function main() {
    const title = `${ordinal(77)}_Academy_Awards`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarTest/1.0' } });
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    const wt = page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
    if (!wt) { console.log('NOT FOUND'); return; }
    
    console.log('=== WIKITEXT PREVIEW (first 5000 chars) ===');
    console.log(wt.substring(0, 5000));
    console.log('\n=== SECTION HEADERS ===');
    const sectionRe = /\n(={2,4})([^=\n]+)\1\s*\n/g;
    let m;
    while ((m = sectionRe.exec(wt)) !== null) console.log(`${m[1].length}× "${m[2].trim()}"`);
}

main().catch(console.error);
