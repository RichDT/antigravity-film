import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

function ordinal(n: number): string {
    const mod100 = n % 100;
    const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th' :
        n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return `${n}${suffix}`;
}

async function main() {
    const title = `${ordinal(77)}_Academy_Awards`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarTest/1.0' } });
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    const wt = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
    
    // Find the "Awards" section and print its content
    const awardsIdx = wt.indexOf('\n===Awards===');
    if (awardsIdx === -1) {
        // Try alternative
        const altIdx = wt.indexOf('==Awards==');
        console.log('altIdx:', altIdx);
        console.log(wt.substring(altIdx, altIdx + 3000));
    } else {
        console.log(wt.substring(awardsIdx, awardsIdx + 5000));
    }
}

main().catch(console.error);
