import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

function ordinal(n: number): string {
    const mod100 = n % 100;
    const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th' :
        n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return `${n}${suffix}`;
}

async function fetchWikitext(n: number): Promise<string | null> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(ordinal(n)+'_Academy_Awards')}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarTest/1.0' } });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

async function check(n: number) {
    const wt = await fetchWikitext(n);
    if (!wt) { console.log(`${n}: NOT FOUND`); return; }
    
    // Count {{Award category}} occurrences
    const awardCatCount = (wt.match(/\{\{Award category/g) || []).length;
    
    console.log(`\n${ordinal(n)} Academy Awards (film year ${n+1927}):`);
    console.log(`  {{Award category}} count: ${awardCatCount}`);
    
    if (awardCatCount === 0) {
        // Show first 2000 chars to understand format
        const idx = wt.indexOf('==');
        console.log('  First headers and content:');
        console.log(wt.substring(idx > 0 ? idx : 0, (idx > 0 ? idx : 0) + 1500));
    } else {
        // Show first Award category
        const idx = wt.indexOf('{{Award category');
        console.log('  First Award category template:');
        console.log(wt.substring(idx, idx + 200));
    }
}

async function main() {
    const missing = [54, 28, 27, 23, 22];
    for (const n of missing) {
        await check(n);
        await new Promise(r => setTimeout(r, 500));
    }
}
main().catch(console.error);
