import { revalidatePath } from 'next/cache'
import { bumpDataVersion, query } from '@/lib/db'

export type RefreshScope = {
  /** Films whose pages changed. Their year pages are refreshed too. */
  films?: number[]
  /** Year pages to refresh in addition to the films' own years. */
  years?: number[]
  /** People whose pages changed (e.g. a new nomination). */
  people?: number[]
  /** Nominations or winners changed: refresh the category pages too. */
  categories?: boolean
}

/**
 * Call after any admin write. Refreshes only the pages the write affects (and the homepage) instead of the
 * whole site, and bumps the data version so those pages are rebuilt from fresh data on their next visit.
 * Every other page keeps its cached copy until its normal daily refresh, so crawlers and visitors don't
 * trigger thousands of rebuilds after each save.
 */
export async function refreshSiteData(scope: RefreshScope = {}) {
  await bumpDataVersion()
  const films = [...new Set((scope.films ?? []).filter(Number.isFinite))]
  const years = new Set((scope.years ?? []).filter(Number.isFinite))
  if (films.length) {
    const res = await query(`SELECT release_year FROM films WHERE film_id = ANY($1::int[]) AND release_year IS NOT NULL`, [films])
    for (const r of res.rows) years.add(r.release_year)
  }
  revalidatePath('/')
  for (const id of films) revalidatePath(`/film/${id}`)
  for (const y of years) revalidatePath(`/year/${y}`)
  for (const id of new Set(scope.people ?? [])) revalidatePath(`/person/${id}`)
  if (scope.categories) {
    revalidatePath('/categories')
    revalidatePath('/categories/[slug]', 'page')
  }
}

/** Films and people attached to a set of nominations (for refreshing their pages). */
export async function scopeForNominations(nominationIds: number[]): Promise<RefreshScope> {
  if (!nominationIds.length) return {}
  const res = await query(
    `SELECT n.film_id, array_remove(array_agg(np.person_id), NULL) AS people
     FROM nominations n LEFT JOIN nomination_people np USING (nomination_id)
     WHERE n.nomination_id = ANY($1::int[]) GROUP BY n.film_id`, [nominationIds])
  return { films: res.rows.map((r: any) => r.film_id).filter(Boolean), people: res.rows.flatMap((r: any) => r.people ?? []) }
}
