import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Call after any admin write. Expires every cached database read (tagged 'db' in lib/db.ts) and
 * marks every page stale, so the next visit to any page shows the change right away instead of
 * waiting out the 24-hour query cache and the pages' hourly refresh.
 */
export function refreshSiteData() {
  revalidateTag('db', { expire: 0 })
  revalidatePath('/', 'layout')
}
