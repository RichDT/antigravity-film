// Budget and box office from each film's Wikipedia infobox. Films in release keep earning, so these are
// refreshed on a schedule (app/api/cron/film-money) for recent years, not just captured once.
import { query } from '@/lib/db'
import { extractInfoboxField, fetchWikitext, findFilmWikitext } from '@/lib/wikipedia-crew'

/** Turn an infobox money value's wikitext into readable text, e.g. "€36.7 million (Spain)". */
export function cleanMoneyWikitext(raw: string): string | null {
  let s = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/&nbsp;|&#160;/g, ' ')
  // Templates, innermost first: lists become "a; b", currency templates keep their symbol, the rest keep their text
  for (let k = 0; k < 6 && /\{\{/.test(s); k++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => {
      const parts = inner.split('|').map(p => p.trim())
      const name = parts[0].toLowerCase()
      const args = parts.slice(1).filter(p => !/^[a-z_]+\s*=/.test(p))
      if (/^(ubl|unbulleted list|plainlist|plain list|flatlist|hlist|bulleted list)$/.test(name)) return args.join('; ')
      if (name === 'us$' || name === 'usd') return `$${args[0] ?? ''}`
      if (name === 'a$') return `A$${args[0] ?? ''}`
      if (name === 'ca$') return `CA$${args[0] ?? ''}`
      if (/^(nowrap|nobr|small|abbr)$/.test(name)) return args[0] ?? ''
      if (/^(efn|refn|sfn|citation needed|cn|when|update after|as of)$/.test(name)) return ''
      if (/^(currency)$/.test(name)) return args.join(' ')
      return args.join(' ')
    })
  }
  s = s
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')   // [[euro|€]] → €
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/(\d)(million|billion)/gi, '$1 $2')
    .replace(/\s*;\s*(;\s*)*/g, '; ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[;,\s]+|[;,\s]+$/g, '')
    .trim()
  return s && /\d/.test(s) ? s : null
}

export function extractMoney(wikitext: string): { budget: string | null; gross: string | null } {
  return {
    budget: cleanMoneyWikitext(extractInfoboxField(wikitext, 'budget')),
    gross: cleanMoneyWikitext(extractInfoboxField(wikitext, 'gross')),
  }
}

const pageTitleFromUrl = (url: string) => decodeURIComponent(url.replace(/^.*\/wiki\//, '')).replace(/_/g, ' ')

/** Refresh budget/box office for the given films. Returns the films whose figures changed. */
export async function refreshFilmMoney(films: { film_id: number; title: string; release_year: number; wikipedia_url: string | null; budget: string | null; box_office: string | null }[]) {
  const changed: { film_id: number; title: string; budget: string | null; box_office: string | null }[] = []
  for (const f of films) {
    const wikitext = f.wikipedia_url ? await fetchWikitext(pageTitleFromUrl(f.wikipedia_url)) : await findFilmWikitext(f.title, f.release_year)
    await query(`UPDATE films SET money_checked_at = now() WHERE film_id = $1`, [f.film_id])
    if (!wikitext) continue
    const { budget, gross } = extractMoney(wikitext)
    const nextBudget = budget ?? f.budget, nextGross = gross ?? f.box_office
    if (nextBudget !== f.budget || nextGross !== f.box_office) {
      await query(`UPDATE films SET budget = $1, box_office = $2 WHERE film_id = $3`, [nextBudget, nextGross, f.film_id])
      changed.push({ film_id: f.film_id, title: f.title, budget: nextBudget, box_office: nextGross })
    }
    await new Promise(r => setTimeout(r, 400)) // be gentle with Wikipedia
  }
  return changed
}

/** The recent films (this year and last) least recently checked. */
export async function filmsDueForMoneyRefresh(limit: number) {
  const year = new Date().getFullYear()
  const res = await query(
    `SELECT film_id, title, release_year, wikipedia_url, budget, box_office FROM films
     WHERE release_year BETWEEN $1 AND $2
     ORDER BY money_checked_at NULLS FIRST, film_id DESC
     LIMIT $3`, [year - 1, year, limit])
  return res.rows as Parameters<typeof refreshFilmMoney>[0]
}
