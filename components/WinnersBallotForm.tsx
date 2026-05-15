'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Trophy, Film, Star, User, Clapperboard, Camera, Music, Scissors, Sparkles,
  PenTool, Palette, Globe, FileText, Video, Volume2, Calendar, Check, LogOut,
  Crown, Award, ChevronDown
} from 'lucide-react'

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

const MAX_WINNERS = 3

function isActingCategory(name: string): boolean {
  return name.includes('Actor') || name.includes('Actress')
}

interface NominationRow {
  nomination_id: number
  film_id: number
  category_id: number
  win: boolean
  film_title: string
  release_year: number
  category_name: string
  song_title: string | null
  person_name: string | null
  role_name: string | null
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

// A "ballot item" groups one or more nomination_ids under a single selectable row
interface BallotItem {
  key: string                 // unique key for this item within its category
  nomination_ids: number[]    // all nomination_ids this item represents
  film_title: string
  person_names: string[]      // for acting: the nominated person; for film-based: all credited people
  song_title: string | null
  role_name: string | null
  win: boolean
  grade: string | null
}

interface GroupedCategory {
  category_name: string
  category_id: number
  items: BallotItem[]
}

export default function WinnersBallotForm() {
  const router = useRouter()
  const [year, setYear] = useState<number | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [categories, setCategories] = useState<GroupedCategory[]>([])
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map()) // catName → set of item keys
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Resolve all nomination_ids for selected keys
  function getSelectedNominationIds(): number[] {
    const ids: number[] = []
    for (const cat of categories) {
      const selKeys = selections.get(cat.category_name)
      if (!selKeys) continue
      for (const item of cat.items) {
        if (selKeys.has(item.key)) {
          ids.push(...item.nomination_ids)
        }
      }
    }
    return ids
  }

  const fetchData = useCallback(async (y: number) => {
    setFetching(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/nominations-list?year=${y}`)
      const data = await res.json()
      setAvailableYears(data.availableYears || [])

      const rawNoms: NominationRow[] = data.nominations || []

      // Group raw rows by category first
      const byCat = new Map<string, { category_id: number; rows: NominationRow[] }>()
      for (const n of rawNoms) {
        if (!byCat.has(n.category_name)) {
          byCat.set(n.category_name, { category_id: n.category_id, rows: [] })
        }
        byCat.get(n.category_name)!.rows.push(n)
      }

      // For each category, group into BallotItems by the correct key
      const grouped: GroupedCategory[] = []
      for (const [catName, { category_id, rows }] of byCat) {
        const acting = isActingCategory(catName)
        const isSong = catName === 'Original Song'
        const itemMap = new Map<string, BallotItem>()

        for (const row of rows) {
          let key: string
          if (acting) {
            // Group by person name (each person is a selectable ballot item)
            key = `person:${row.person_name || row.film_id}`
          } else if (isSong) {
            // Group by song title
            key = `song:${row.song_title || row.film_id}`
          } else {
            // Group by film (all nomination rows for the same film are one ballot item)
            key = `film:${row.film_id}`
          }

          if (!itemMap.has(key)) {
            itemMap.set(key, {
              key,
              nomination_ids: [],
              film_title: row.film_title,
              person_names: [],
               song_title: row.song_title,
               role_name: row.role_name,
               win: row.win,
               grade: row.grade,
             })
           }
           const item = itemMap.get(key)!
           if (!item.nomination_ids.includes(row.nomination_id)) {
             item.nomination_ids.push(row.nomination_id)
           }
           if (row.person_name && !item.person_names.includes(row.person_name)) {
             item.person_names.push(row.person_name)
           }
           // If any nomination in the group is a win, the group is a win
           if (row.win) item.win = true
           // Use highest grade
           if (getGradeWeight(row.grade) > getGradeWeight(item.grade)) {
             item.grade = row.grade
           }
         }
 
         grouped.push({
           category_name: catName,
           category_id,
           items: Array.from(itemMap.values()),
         })
       }
       setCategories(grouped)
 
       // Pre-select existing winners or fallback to top grade for Film
       const preSelections = new Map<string, Set<string>>()
       for (const cat of grouped) {
         const winnerKeys = new Set<string>()
         for (const item of cat.items) {
           if (item.win) winnerKeys.add(item.key)
         }
         
         if (winnerKeys.size === 0) {
           const group = CATEGORY_GROUPS.find(g => g.categories.includes(cat.category_name))
           if (group?.label === 'Film' && cat.items.length > 0) {
             const top1 = [...cat.items].sort((a, b) => getGradeWeight(b.grade) - getGradeWeight(a.grade))[0]
             winnerKeys.add(top1.key)
           }
         }
 
         if (winnerKeys.size > 0) preSelections.set(cat.category_name, winnerKeys)
       }
       setSelections(preSelections)

    } catch {
      setError('Failed to load nominations')
    }
    setFetching(false)
  }, [])

  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/admin/nominations-list?year=0`)
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
        if (catSet.size >= MAX_WINNERS) return prev
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

  async function handleSubmit() {
    if (!year) return
    setLoading(true)
    setError('')
    setSuccess(false)

    const allWinnerIds = getSelectedNominationIds()

    try {
      const res = await fetch('/api/admin/winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, winners: allWinnerIds }),
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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  function getItemLabel(item: BallotItem, catName: string): string {
    if (isActingCategory(catName)) {
      return item.person_names[0] || item.film_title
    }
    if (catName === 'Original Song') {
      return item.song_title ? `"${item.song_title}"` : item.film_title
    }
    return item.film_title
  }

  function getItemSecondary(item: BallotItem, catName: string): string | null {
    if (isActingCategory(catName)) {
      return item.film_title
    }
    if (catName === 'Original Song') {
      return item.film_title
    }
    // For film-based categories, show credited people if any
    if (item.person_names.length > 0) {
      return item.person_names.join(', ')
    }
    return null
  }

  const totalWinners = Array.from(selections.values()).reduce((sum, s) => sum + s.size, 0)

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-12 clip-hexagon bg-accent/30 flex items-center justify-center">
            <div className="clip-hexagon bg-accent/20 flex items-center justify-center" style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}>
              <Crown className="w-5 h-5 text-accent" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Winners Ballot</h1>
            <p className="text-sm text-muted-foreground">Select up to {MAX_WINNERS} winners per category</p>
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
        <Link href="/admin/nominations" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Nominations
        </Link>
        <span className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent font-medium">Winners</span>
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
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {!fetching && categories.length === 0 && (
        <div className="text-center text-muted-foreground py-20">
          No nominations found for {year || 'any year'}. Submit a nominations ballot first.
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
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-7 clip-hexagon bg-border/50 flex items-center justify-center">
                    <div className="clip-hexagon bg-muted/60 flex items-center justify-center" style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}>
                      <GroupIcon className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                  <h2 className="font-serif text-lg font-semibold text-foreground/80">{group.label}</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
                </div>

                <div className="space-y-4">
                  {catsInGroup.map(cat => {
                    const catIconName = CATEGORY_ICONS[cat.category_name] || 'trophy'
                    const CatIcon = ICON_MAP[catIconName] || Trophy
                    const selCount = getSelectionCount(cat.category_name)

                    return (
                      <div key={cat.category_name} className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-card/20">
                          <div className="w-5 h-6 clip-hexagon bg-muted/50 flex items-center justify-center">
                            <CatIcon className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          <span className="font-serif text-sm font-medium text-foreground flex-1">{cat.category_name}</span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                            selCount > 0 ? 'bg-accent/15 text-accent' : 'bg-muted/40 text-muted-foreground/60'
                          }`}>
                            {selCount}/{MAX_WINNERS} {selCount === 1 ? 'winner' : 'winners'}
                          </span>
                        </div>

                        <div className="divide-y divide-border/20">
                          {cat.items.map(item => {
                            const selected = isSelected(cat.category_name, item.key)
                            const atMax = selCount >= MAX_WINNERS && !selected

                            return (
                              <div
                                key={item.key}
                                onClick={() => !atMax && toggleSelection(cat.category_name, item.key)}
                                className={`flex items-start gap-3 px-4 py-3 transition-all cursor-pointer ${
                                  selected
                                    ? 'bg-accent/10'
                                    : atMax
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'hover:bg-secondary/30'
                                }`}
                              >
                                {/* Winner indicator */}
                                {selected ? (
                                  <div className="w-5 h-6 clip-hexagon bg-accent flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_8px_rgba(212,175,55,0.4)]">
                                    <Trophy className="w-2.5 h-2.5 text-accent-foreground" />
                                  </div>
                                ) : (
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-all border-muted-foreground/30`} />
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className={`text-[13px] font-medium ${selected ? 'text-foreground drop-shadow-sm' : 'text-foreground/90'}`}>
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

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
          )}
          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400 flex items-center gap-2">
              <Check className="w-4 h-4" /> Winners ballot submitted successfully! {totalWinners} winners set.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || totalWinners === 0}
            className="w-full py-3.5 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Crown className="w-5 h-5" />
                Submit Winners ({totalWinners} selected)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
