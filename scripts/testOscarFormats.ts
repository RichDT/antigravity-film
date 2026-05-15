import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

function ordinal(n: number): string {
    const mod100 = n % 100;
    const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th' :
        n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return `${n}${suffix}`;
}

async function fetchWikitext(ceremony: number): Promise<string | null> {
    const title = `${ordinal(ceremony)}_Academy_Awards`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarTest/1.0' } });
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

async function showCategoryBlock(ceremony: number) {
    const wt = await fetchWikitext(ceremony);
    if (!wt) { console.log(`${ordinal(ceremony)}: NOT FOUND`); return; }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${ordinal(ceremony)} Academy Awards`);
    console.log('='.repeat(60));
    
    // Show first 300 chars after first category marker
    const awardCatIdx = wt.indexOf('{{Award category');
    const sectionIdx = wt.search(/\n={2,4}[^=]/);
    
    if (awardCatIdx !== -1 && (sectionIdx === -1 || awardCatIdx < sectionIdx + 2000)) {
        console.log('FORMAT: {{Award category}} template');
        console.log(wt.substring(awardCatIdx, awardCatIdx + 800));
    } else if (sectionIdx !== -1) {
        console.log('FORMAT: Section headers');
        console.log(wt.substring(sectionIdx, sectionIdx + 800));
    } else {
        console.log('FORMAT: Unknown');
        console.log(wt.substring(0, 500));
    }
}

async function main() {
    // Sample across decades
    for (const n of [70, 60, 50, 40, 30, 20, 10, 5, 1]) {
        await showCategoryBlock(n);
        await new Promise(r => setTimeout(r, 300));
    }
}

main().catch(console.error);
