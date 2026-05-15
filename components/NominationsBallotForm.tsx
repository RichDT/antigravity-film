'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Trophy, Film, Star, User, Clapperboard, Camera, Music, Scissors, Sparkles,
  PenTool, Palette, Globe, FileText, Video, Volume2, Calendar, Check, LogOut,
  ListChecks, Award, ChevronDown
} from 'lucide-react'

// Category meta
const CATEGORY_GROUPS = [
  { label: 'Film', icon: 'trophy', categories: ['Live-Action Feature', 'International Feature', 'Animated Feature', 'Documentary'] },
  { label: 'Directing & Editing', icon: 'clapperboard', categories: ['Directing', 'Editing'] },
  { label: 'Acting', icon: 'user', categories: ['Actor in a Leading Role', 'Actress in a Leading Role', 'Actor in a Supporting Role', 'Actress in a Supporting Role'] },
  { label: 'Writing', icon: 'pen', categories: ['Screenplay (Original)', 'Screenplay (Adapted)'] },
  { label: 'Visual', icon: 'camera', categories: ['Cinematography', 'Art Direction', 'Costuming', 'Make-Up & Hairstyling', 'Effects'] },
  { label: 'Sound & Music', icon: 'music', categories: ['Original Score', 'Original Song', 'Sound Mixing', 'Sound Editing'] },
]

const ICON_MAP: Record<string, any> = {
  trophy: Trophy, clapperboard: Clapperboard, user: User, pen: PenTool,
  camera: Camera, music: Music, scissors: Scissors, sparkles: Sparkles,
  palette: Palette, globe: Globe, file: FileText, video: Video, volume: Volume2,
}

const CATEGORY_ICONS: Record<string, string> = {
  'Live-Action Feature': 'trophy', 'International Feature': 'globe',
  'Animated Feature': 'video', 'Documentary': 'file',
  'Directing': 'clapperboard', 'Editing': 'scissors',
  'Actor in a Leading Role': 'user', 'Actress in a Leading Role': 'user',
  'Actor in a Supporting Role': 'user', 'Actress in a Supporting Role': 'user',
  'Screenplay (Original)': 'pen', 'Screenplay (Adapted)': 'pen',
  'Cinematography': 'camera', 'Art Direction': 'palette',
  'Costuming': 'scissors', 'Make-Up & Hairstyling': 'sparkles', 'Effects': 'sparkles',
  'Original Score': 'music', 'Original Song': 'music',
  'Sound Mixing': 'volume', 'Sound Editing': 'volume',
}

const MAX_NOMINATIONS = 5

function isActingCategory(name: string): boolean {
  return name.includes('Actor') || name.includes('Actress')
}

interface RawConsideration {
  consideration_id: number
  film_id: number
  category_id: number
  year: number
  detail: string | null
  film_title: string
  release_year: number
  category_name: string
  grade: string | null
}

const GRADE_WEIGHTS: Record<string, number> = {
  'A+': 13, 'A': 12, 'A-': 11,
  'B+': 10, 'B': 9, 'B-': 8,
  'C+': 7, 'C': 6, 'C-': 5,
  'D+': 4, 'D': 3, 'D-': 2,
  'F': 1,
}

function getGradeWeight(grade: string | null): number {
  if (!grade) return 0
  return GRADE_WEIGHTS[grade.toUpperCase()] || 0
}

// A "ballot item" groups one or more considerations under a single selectable row
interface BallotItem {
  key: string                     // unique key for grouping
  consideration_ids: number[]     // all consideration_ids this item represents
  film_id: number
  category_id: number
  film_title: string
  detail: string | null           // actor name or song title
  details: string[]               // all detail values (e.g. multiple people)
  grade: string | null            // film grade
}

interface GroupedCategory {
  category_name: string
  category_id: number
  items: BallotItem[]
}

export default function NominationsBallotForm() {
  const router = useRouter()
  const [year, setYear] = useState<number | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [categories, setCategories] = useState<GroupedCategory[]>([])
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map()) // catName → set of item keys
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Fetch considerations
  const fetchData = useCallback(async (y: number) => {
    setFetching(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/considerations?year=${y}`)
      const data = await res.json()
      setAvailableYears(data.availableYears || [])

      const rawItems: RawConsideration[] = data.considerations || []
      const existingNoms = data.existingNominations || []

      // Group by category first
      const byCat = new Map<string, { category_id: number; rows: RawConsideration[] }>()
      for (const c of rawItems) {
        if (!byCat.has(c.category_name)) {
          byCat.set(c.category_name, { category_id: c.category_id, rows: [] })
        }
        byCat.get(c.category_name)!.rows.push(c)
      }

      // Within each category, group into BallotItems by the correct key
      const grouped: GroupedCategory[] = []
      const initialSelections = new Map<string, Set<string>>()

      for (const [catName, { category_id, rows }] of byCat) {
        const acting = isActingCategory(catName)
        const isSong = catName === 'Original Song'
        const itemMap = new Map<string, BallotItem>()
        const catSelections = new Set<string>()

        for (const row of rows) {
          let key: string
          if (acting) {
            key = `person:${(row.detail || '').toLowerCase()}:${row.film_id}`
          } else if (isSong) {
            key = `song:${(row.detail || '').toLowerCase()}:${row.film_id}`
          } else {
            key = `film:${row.film_id}`
          }

          if (!itemMap.has(key)) {
            itemMap.set(key, {
              key,
              consideration_ids: [],
              film_id: row.film_id,
              category_id: row.category_id,
              film_title: row.film_title,
              detail: row.detail,
              details: [],
              grade: row.grade,
            })
          }
          const item = itemMap.get(key)!
          if (!item.consideration_ids.includes(row.consideration_id)) {
            item.consideration_ids.push(row.consideration_id)
          }
          if (row.detail && !item.details.includes(row.detail)) {
            item.details.push(row.detail)
          }
          // Use the highest grade if multiple rows exist
          if (getGradeWeight(row.grade) > getGradeWeight(item.grade)) {
            item.grade = row.grade
          }
        }

        const items = Array.from(itemMap.values())

        // Process existing nominations to pre-select items
        const nomsForCat = existingNoms.filter((n: any) => n.category_id === category_id)
        if (nomsForCat.length > 0) {
          for (const nom of nomsForCat) {
            let nomKey: string
            if (acting) {
              nomKey = `person:${(nom.person_name || '').toLowerCase()}:${nom.film_id}`
            } else if (isSong) {
              nomKey = `song:${(nom.song_title || '').toLowerCase()}:${nom.film_id}`
            } else {
              nomKey = `film:${nom.film_id}`
            }
            
            if (itemMap.has(nomKey)) {
              catSelections.add(nomKey)
            }
          }
        } else {
          const group = CATEGORY_GROUPS.find(g => g.categories.includes(catName))
          if (group?.label === 'Film') {
            // Rule: If no official nominations yet, pre-select top 5 by grade for Film categories
            const top5 = [...items]
              .sort((a, b) => getGradeWeight(b.grade) - getGradeWeight(a.grade))
              .slice(0, 5)
            for (const it of top5) {
              catSelections.add(it.key)
            }
          }
        }

        if (catSelections.size > 0) {
          initialSelections.set(catName, catSelections)
        }

        grouped.push({
          category_name: catName,
          category_id,
          items,
        })
      }
      setCategories(grouped)
      setSelections(initialSelections)
    } catch {
      setError('Failed to load considerations')
    }
    setFetching(false)
  }, [])

  // Initial load: fetch years, then load latest
  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/admin/considerations?year=0`)
      const data = await res.json()
      const years = data.availableYears || []
      setAvailableYears(years)
      if (years.length > 0) {
        const latestYear = years[0]
        setYear(latestYear)
        fetchData(latestYear)
      } else {
        setFetching(false)
      }
    }
    init()
  }, [fetchData])

  function handleYearChange(newYear: number) {
    setYear(newYear)
    setSelections(new Map())
    setSuccess(false)
    fetchData(newYear)
  }

  function toggleSelection(catName: string, itemKey: string) {
    setSelections(prev => {
      const next = new Map(prev)
      const catSet = new Set(next.get(catName) || [])
      if (catSet.has(itemKey)) {
        catSet.delete(itemKey)
      } else {
        if (catSet.size >= MAX_NOMINATIONS) return prev // Enforce max
        catSet.add(itemKey)
      }
      next.set(catName, catSet)
      return next
    })
  }

  function getSelectionCount(catName: string): number {
    return selections.get(catName)?.size || 0
  }

  function isSelected(catName: string, itemKey: string): boolean {
    return selections.get(catName)?.has(itemKey) || false
  }

  // Submit
  async function handleSubmit() {
    if (!year) return
    setLoading(true)
    setError('')
    setSuccess(false)

    // Build flat selections array from selected ballot items
    const flatSelections: { category_id: number; film_id: number; detail: string | null }[] = []
    for (const cat of categories) {
      const catSel = selections.get(cat.category_name)
      if (!catSel || catSel.size === 0) continue
      for (const item of cat.items) {
        if (catSel.has(item.key)) {
          flatSelections.push({
            category_id: item.category_id,
            film_id: item.film_id,
            detail: item.detail,
          })
        }
      }
    }

    try {
      const res = await fetch('/api/admin/nominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, selections: flatSelections }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Submission failed')
      } else {
        setSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    }
    setLoading(false)
  }

  // Sign out
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  // Determine primary label for an item
  function getItemLabel(item: BallotItem, catName: string): string {
    if (isActingCategory(catName)) {
      return item.detail || 'Unknown performer'
    }
    if (catName === 'Original Song') {
      return item.detail ? `"${item.detail}"` : 'Unknown song'
    }
    return item.film_title
  }

  // Get secondary info
  function getItemSecondary(item: BallotItem, catName: string): string | null {
    if (isActingCategory(catName)) {
      return item.film_title
    }
    if (catName === 'Original Song') {
      return item.film_title
    }
    // For film-based categories, show detail entries (people) if any
    if (item.details.length > 0) {
      return item.details.join(', ')
    }
    return null
  }

  const totalSelections = Array.from(selections.values()).reduce((sum, s) => sum + s.size, 0)

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-12 clip-hexagon bg-primary/30 flex items-center justify-center">
            <div className="clip-hexagon bg-primary/20 flex items-center justify-center" style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}>
              <ListChecks className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Nominations Ballot</h1>
            <p className="text-sm text-muted-foreground">Select up to {MAX_NOMINATIONS} considerations per category</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-secondary">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {/* Admin Nav */}
      <div className="flex gap-2 mb-8 text-sm flex-wrap">
        <Link href="/admin/add-review" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Add Review
        </Link>
        <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">Nominations</span>
        <Link href="/admin/winners" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Winners
        </Link>
        <Link href="/admin/share" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Share
        </Link>
        <Link href="/admin/feedback" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Feedback
        </Link>
      </div>

      {/* Year Selector */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          <Calendar className="w-4 h-4 inline mr-1.5 opacity-60" /> Film Year
        </label>
        <div className="relative w-40">
          <select
            value={year || ''}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-card/50 border border-border rounded-xl text-foreground font-serif text-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Loading */}
      {fetching && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Categories */}
      {!fetching && categories.length === 0 && (
        <div className="text-center text-muted-foreground py-20">
          No considerations found for {year || 'any year'}.
        </div>
      )}

      {!fetching && categories.length > 0 && (
        <div className="space-y-8">
          {CATEGORY_GROUPS.map((group) => {
            const GroupIcon = ICON_MAP[group.icon] || Trophy
            const catsInGroup = categories.filter(c => group.categories.includes(c.category_name))
            if (catsInGroup.length === 0) return null

            return (
              <div key={group.label}>
                {/* Group Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-7 clip-hexagon bg-border/50 flex items-center justify-center">
                    <div className="clip-hexagon bg-muted/60 flex items-center justify-center" style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}>
                      <GroupIcon className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                  <h2 className="font-serif text-lg font-semibold text-foreground/80">{group.label}</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
                </div>

                {/* Categories in group */}
                <div className="space-y-4">
                  {catsInGroup.map(cat => {
                    const catIconName = CATEGORY_ICONS[cat.category_name] || 'trophy'
                    const CatIcon = ICON_MAP[catIconName] || Trophy
                    const selCount = getSelectionCount(cat.category_name)

                    return (
                      <div key={cat.category_name} className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
                        {/* Category Header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-card/20">
                          <div className="w-5 h-6 clip-hexagon bg-muted/50 flex items-center justify-center">
                            <CatIcon className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          <span className="font-serif text-sm font-medium text-foreground flex-1">{cat.category_name}</span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                            selCount > 0 ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground/60'
                          }`}>
                            {selCount}/{MAX_NOMINATIONS}
                          </span>
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-border/20">
                          {cat.items.map(item => {
                            const selected = isSelected(cat.category_name, item.key)
                            const atMax = selCount >= MAX_NOMINATIONS && !selected

                            return (
                              <div
                                key={item.key}
                                onClick={() => !atMax && toggleSelection(cat.category_name, item.key)}
                                className={`flex items-start gap-3 px-4 py-3 transition-all cursor-pointer ${
                                  selected
                                    ? 'bg-primary/5'
                                    : atMax
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'hover:bg-secondary/30'
                                }`}
                              >
                                {/* Selection indicator */}
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  selected
                                    ? 'bg-primary border-primary'
                                    : 'border-muted-foreground/30'
                                }`}>
                                  {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] text-foreground font-medium">
                                    {getItemLabel(item, cat.category_name)}
                                  </div>
                                  {getItemSecondary(item, cat.category_name) && (
                                    <div className="text-[11px] text-muted-foreground mt-0.5 italic">
                                      {getItemSecondary(item, cat.category_name)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Error / Success */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
          )}
          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400 flex items-center gap-2">
              <Check className="w-4 h-4" /> Nominations ballot submitted successfully! {totalSelections} nominations created.
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || totalSelections === 0}
            className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Award className="w-5 h-5" />
                Submit Nominations ({totalSelections} selected)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
