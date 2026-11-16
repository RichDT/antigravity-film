import type { MetadataRoute } from 'next'
import { query } from '@/lib/db'
import { slugify } from '@/lib/awards'

const SITE = 'https://www.richpicks.app'
export const revalidate = 86400

/**
 * The pages worth a reader's visit: years, categories, and the films and people that Rich has graded or that
 * appear in Rich Picks. The rest of the archive stays reachable by links but isn't advertised to crawlers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [years, cats, films, people] = await Promise.all([
    query(`SELECT DISTINCT c.year FROM ceremonies c JOIN nominations n USING (ceremony_id) ORDER BY 1`),
    query(`SELECT DISTINCT cat.name FROM nominations n JOIN ceremonies c USING (ceremony_id) JOIN awards a ON a.award_id = c.award_id
           JOIN organizations o ON o.organization_id = a.organization_id JOIN categories cat ON cat.category_id = n.category_id
           WHERE o.short_name = 'Rich Picks'`),
    query(`SELECT f.film_id, max(r.updated_at) AS updated FROM films f
           LEFT JOIN reviews r ON r.film_id = f.film_id AND coalesce(r.grade, '') <> ''
           WHERE r.film_id IS NOT NULL OR f.film_id IN (
             SELECT n.film_id FROM nominations n JOIN ceremonies c USING (ceremony_id) JOIN awards a ON a.award_id = c.award_id
             JOIN organizations o ON o.organization_id = a.organization_id WHERE o.short_name = 'Rich Picks')
           GROUP BY f.film_id`),
    query(`SELECT DISTINCT np.person_id FROM nomination_people np JOIN nominations n USING (nomination_id)
           JOIN ceremonies c USING (ceremony_id) JOIN awards a ON a.award_id = c.award_id
           JOIN organizations o ON o.organization_id = a.organization_id WHERE o.short_name = 'Rich Picks'`),
  ])
  return [
    { url: SITE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/faq`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/categories`, changeFrequency: 'weekly', priority: 0.6 },
    ...years.rows.map((r: any) => ({ url: `${SITE}/year/${r.year}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...cats.rows.map((r: any) => ({ url: `${SITE}/categories/${slugify(r.name)}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...films.rows.map((r: any) => ({ url: `${SITE}/film/${r.film_id}`, lastModified: r.updated ?? undefined, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...people.rows.map((r: any) => ({ url: `${SITE}/person/${r.person_id}`, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ]
}
