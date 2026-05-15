'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Trophy, Film, Star, User, Clapperboard, Camera, Music, Scissors, Sparkles,
  PenTool, Palette, Globe, FileText, Wand2, Brush, Volume2, Calendar, Check, LogOut, Search, Plus, X,
  FileVideoCamera, UserStar, BookOpen, Theater, Shirt, MirrorRound, Piano, MicVocal, Headphones, SlidersHorizontal
} from 'lucide-react'

// Full grade scale including fractional grades and F variants
const GRADE_ROWS = [
  ['A+', 'A+//A', 'A', 'A//A-', 'A-', 'A-//B+'],
  ['B+', 'B+//B', 'B', 'B//B-', 'B-', 'B-//C+'],
  ['C+', 'C+//C', 'C', 'C//C-', 'C-', 'C-//D+'],
  ['D+', 'D+//D', 'D', 'D//D-', 'D-', 'D-//F+'],
  ['F+', 'F+//F', 'F', 'F//F-', 'F-'],
]

function getGradeColor(grade: string): string {
  const g = grade.split('//')[0]
  if (g.startsWith('A')) return 'bg-green-600/80 text-green-100'
  if (g.startsWith('B')) return 'bg-blue-600/80 text-blue-100'
  if (g.startsWith('C')) return 'bg-yellow-600/80 text-yellow-100'
  if (g.startsWith('D')) return 'bg-orange-600/80 text-orange-100'
  return 'bg-red-600/80 text-red-100'
}

function getGradeRingColor(grade: string): string {
  const g = grade.split('//')[0]
  if (g.startsWith('A')) return 'ring-green-500/60'
  if (g.startsWith('B')) return 'ring-blue-500/60'
  if (g.startsWith('C')) return 'ring-yellow-500/60'
  if (g.startsWith('D')) return 'ring-orange-500/60'
  return 'ring-red-500/60'
}

// Category groups matching Year page ordering
const CATEGORY_GROUPS = [
  {
    label: 'Film',
    icon: 'trophy',
    categories: [
      'Live-Action Feature',
      'International Feature',
      'Animated Feature',
      'Documentary',
    ],
  },
  {
    label: 'Directing & Editing',
    icon: 'clapperboard',
    categories: ['Directing', 'Editing'],
  },
  {
    label: 'Acting',
    icon: 'user',
    categories: [
      'Actor in a Leading Role',
      'Actress in a Leading Role',
      'Actor in a Supporting Role',
      'Actress in a Supporting Role',
    ],
  },
  {
    label: 'Writing',
    icon: 'pen',
    categories: ['Screenplay (Original)', 'Screenplay (Adapted)'],
  },
  {
    label: 'Visual',
    icon: 'camera',
    categories: ['Cinematography', 'Art Direction', 'Costuming', 'Make-Up & Hairstyling', 'Effects'],
  },
  {
    label: 'Sound & Music',
    icon: 'music',
    categories: ['Original Score', 'Original Song', 'Sound Mixing', 'Sound Editing'],
  },
]

const ICON_MAP: Record<string, any> = {
  trophy: Trophy, clapperboard: Clapperboard, user: User, pen: PenTool,
  camera: Camera, music: Music, scissors: Scissors, sparkles: Sparkles,
  palette: Palette, globe: Globe, file: FileText, wand: Wand2, brush: Brush, volume: Volume2,
  film: Film, filevideo: FileVideoCamera, userstar: UserStar, pentool: PenTool,
  bookopen: BookOpen, theater: Theater, shirt: Shirt, mirror: MirrorRound,
  piano: Piano, micvocal: MicVocal, headphones: Headphones, sliders: SlidersHorizontal,
}

const CATEGORY_ICONS: Record<string, string> = {
  'Live-Action Feature': 'film',
  'Live-Action Short': 'filevideo',
  'International Feature': 'globe',
  'Animated Feature': 'wand',
  'Animated Short': 'brush',
  'Documentary': 'file',
  'Directing': 'clapperboard',
  'Editing': 'scissors',
  'Actor in a Leading Role': 'userstar',
  'Actress in a Leading Role': 'userstar',
  'Actor in a Supporting Role': 'user',
  'Actress in a Supporting Role': 'user',
  'Screenplay (Original)': 'pentool',
  'Screenplay (Adapted)': 'bookopen',
  'Cinematography': 'camera',
  'Art Direction': 'theater',
  'Costuming': 'shirt',
  'Make-Up & Hairstyling': 'mirror',
  'Effects': 'sparkles',
  'Original Score': 'piano',
  'Original Song': 'micvocal',
  'Sound Mixing': 'sliders',
  'Sound Editing': 'headphones',
}

// Categories that require per-entry detail (person names / song titles)
const DETAIL_CATEGORIES = new Set([
  'Actor in a Leading Role',
  'Actress in a Leading Role',
  'Actor in a Supporting Role',
  'Actress in a Supporting Role',
  'Original Song',
  'Directing',
  'Editing',
  'Cinematography',
  'Original Score',
  'Screenplay (Original)',
  'Screenplay (Adapted)',
  'Art Direction',
  'Costuming',
  'Make-Up & Hairstyling',
])

function getDetailPlaceholder(category: string): string {
  if (category === 'Original Song') return 'Song title'
  if (category === 'Directing') return 'Director name'
  if (category === 'Editing') return 'Editor name'
  if (category === 'Cinematography') return 'Cinematographer name'
  if (category === 'Original Score') return 'Composer name'
  if (category.startsWith('Screenplay')) return 'Writer name'
  if (category === 'Art Direction') return 'Production designer name'
  if (category === 'Costuming') return 'Costume designer name'
  if (category === 'Make-Up & Hairstyling') return 'Designer name'
  return 'Actor name'
}

function getDetailLabel(category: string): string {
  if (category === 'Original Song') return 'Songs under consideration'
  if (category === 'Directing') return 'Directors under consideration'
  if (category === 'Editing') return 'Editors under consideration'
  if (category === 'Cinematography') return 'Cinematographers under consideration'
  if (category === 'Original Score') return 'Composers under consideration'
  if (category.startsWith('Screenplay')) return 'Writers under consideration'
  if (category === 'Art Direction') return 'Production designers under consideration'
  if (category === 'Costuming') return 'Costume designers under consideration'
  if (category === 'Make-Up & Hairstyling') return 'Designers under consideration'
  return 'Performances under consideration'
}

interface SelectedCategory {
  name: string
  details: string[] // actor names or song titles
}

interface FilmResult {
  film_id: number
  title: string
  release_year: number | null
}

export default function AdminReviewForm() {
  const router = useRouter()

  // Form state
  const [filmTitle, setFilmTitle] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [grade, setGrade] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Autocomplete state
  const [filmResults, setFilmResults] = useState<FilmResult[]>([])
  const [showFilmDropdown, setShowFilmDropdown] = useState(false)
  const [searchingFilms, setSearchingFilms] = useState(false)
  const filmInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          filmInputRef.current && !filmInputRef.current.contains(e.target as Node)) {
        setShowFilmDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Film autocomplete search
  const searchFilms = useCallback(async (q: string) => {
    if (q.length < 2) {
      setFilmResults([])
      setShowFilmDropdown(false)
      return
    }
    setSearchingFilms(true)
    try {
      const res = await fetch(`/api/admin/films-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setFilmResults(data.films || [])
      setShowFilmDropdown(true)
    } catch {
      setFilmResults([])
    }
    setSearchingFilms(false)
  }, [])

  function handleFilmInputChange(value: string) {
    setFilmTitle(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => searchFilms(value), 300)
  }

  function selectFilm(film: FilmResult) {
    setFilmTitle(film.title)
    if (film.release_year) setYear(film.release_year)
    setShowFilmDropdown(false)
  }

  // Category toggle
  function toggleCategory(categoryName: string) {
    setSelectedCategories(prev => {
      const exists = prev.find(c => c.name === categoryName)
      if (exists) return prev.filter(c => c.name !== categoryName)
      // If it's a detail category, start with one empty detail entry
      const details = DETAIL_CATEGORIES.has(categoryName) ? [''] : []
      return [...prev, { name: categoryName, details }]
    })
  }

  function isCategorySelected(name: string) {
    return selectedCategories.some(c => c.name === name)
  }

  // Detail management for acting/song categories
  function updateDetail(categoryName: string, index: number, value: string) {
    setSelectedCategories(prev =>
      prev.map(c => {
        if (c.name !== categoryName) return c
        const newDetails = [...c.details]
        newDetails[index] = value
        return { ...c, details: newDetails }
      })
    )
  }

  function addDetail(categoryName: string) {
    setSelectedCategories(prev =>
      prev.map(c => {
        if (c.name !== categoryName) return c
        return { ...c, details: [...c.details, ''] }
      })
    )
  }

  function removeDetail(categoryName: string, index: number) {
    setSelectedCategories(prev =>
      prev.map(c => {
        if (c.name !== categoryName) return c
        const newDetails = c.details.filter((_, i) => i !== index)
        return { ...c, details: newDetails.length === 0 ? [''] : newDetails }
      })
    )
  }

  // Submit
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/add-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filmTitle,
          year,
          grade: grade || null,
          reviewText: reviewText || null,
          considerations: selectedCategories.map(c => ({
            name: c.name,
            details: c.details.filter(d => d.trim() !== ''),
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Submission failed')
        setLoading(false)
        return
      }

      router.push(`/admin/share/${data.filmId}`)
    } catch (err: any) {
      setError(err.message || 'Network error')
      setLoading(false)
    }
  }

  // Sign out
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-12 clip-hexagon bg-primary/30 flex items-center justify-center">
            <div className="clip-hexagon bg-primary/20 flex items-center justify-center" style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}>
              <Film className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Add Review</h1>
            <p className="text-sm text-muted-foreground">Grade a film & mark categories for consideration</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-secondary"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Admin Nav */}
      <div className="flex gap-2 mb-8 text-sm flex-wrap">
        <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">Add Review</span>
        <Link href="/admin/nominations" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Nominations
        </Link>
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Film Title with Autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            <Film className="w-4 h-4 inline mr-1.5 opacity-60" />
            Film Title
          </label>
          <div className="relative">
            <input
              ref={filmInputRef}
              type="text"
              value={filmTitle}
              onChange={(e) => handleFilmInputChange(e.target.value)}
              onFocus={() => { if (filmResults.length > 0) setShowFilmDropdown(true) }}
              required
              className="w-full px-4 py-3 bg-card/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-lg"
              placeholder="Start typing a film title..."
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          </div>

          {showFilmDropdown && filmResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
            >
              {filmResults.map((f) => (
                <button
                  key={f.film_id}
                  type="button"
                  onClick={() => selectFilm(f)}
                  className="w-full px-4 py-2.5 text-left hover:bg-secondary transition-colors flex items-center justify-between"
                >
                  <span className="text-foreground">{f.title}</span>
                  {f.release_year && (
                    <span className="text-sm text-muted-foreground">{f.release_year}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {searchingFilms && (
            <div className="absolute right-12 top-[42px] -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            <Calendar className="w-4 h-4 inline mr-1.5 opacity-60" />
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
            min={1900}
            max={2099}
            className="w-32 px-4 py-3 bg-card/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-lg font-serif"
          />
        </div>

        {/* Grade Selector */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            <Star className="w-4 h-4 inline mr-1.5 opacity-60" />
            Letter Grade
          </label>
          <div className="space-y-2">
            {GRADE_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex flex-wrap gap-1.5 justify-start">
                {row.map((g) => {
                  const isFractional = g.includes('//')
                  const isSelected = grade === g
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(grade === g ? '' : g)}
                      className={`flex items-center justify-center text-[10px] font-bold transition-all ${
                        isFractional
                          ? `px-2 py-1 rounded-md min-w-[44px] h-12 ${
                              isSelected
                                ? `${getGradeColor(g)} ring-2 ${getGradeRingColor(g)} scale-105`
                                : 'bg-muted/30 text-muted-foreground/70 hover:bg-muted/50 border border-dashed border-border/50'
                            }`
                          : `w-10 h-12 clip-hexagon ${
                              isSelected
                                ? `${getGradeColor(g)} ring-2 ${getGradeRingColor(g)} scale-110`
                                : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:scale-105'
                            }`
                      }`}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Categories for Consideration */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            <Trophy className="w-4 h-4 inline mr-1.5 opacity-60" />
            Categories for Consideration
          </label>
          <p className="text-xs text-muted-foreground/70 mb-4">
            Select categories this film should be considered for. Considerations are not official nominations — those are determined at the end of each film year.
          </p>

          <div className="space-y-6">
            {CATEGORY_GROUPS.map((group) => {
              const GroupIcon = ICON_MAP[group.icon] || Trophy
              return (
                <div key={group.label}>
                  {/* Group Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-6 clip-hexagon bg-muted/60 flex items-center justify-center">
                      <GroupIcon className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-serif font-medium text-foreground/80">{group.label}</span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>

                  {/* Category Checkboxes */}
                  <div className="space-y-2">
                    {group.categories.map((cat) => {
                      const catIconName = CATEGORY_ICONS[cat] || 'trophy'
                      const CatIcon = ICON_MAP[catIconName] || Trophy
                      const selected = isCategorySelected(cat)
                      const hasDetailInput = DETAIL_CATEGORIES.has(cat)
                      const catData = selectedCategories.find(c => c.name === cat)

                      return (
                        <div key={cat} className="space-y-0">
                          {/* Category row */}
                          <div
                            className={`flex items-center gap-3 p-3 border transition-all cursor-pointer ${
                              selected
                                ? 'bg-primary/5 border-primary/30 rounded-xl'
                                : 'bg-card/30 border-border/50 hover:border-border rounded-xl'
                            } ${selected && hasDetailInput && catData && catData.details.length > 0 ? 'rounded-b-none border-b-0' : ''}`}
                            onClick={() => toggleCategory(cat)}
                          >
                            <div className={`w-6 h-7 clip-hexagon flex items-center justify-center shrink-0 transition-colors ${
                              selected ? 'bg-primary/20 text-primary' : 'bg-muted/40 text-muted-foreground'
                            }`}>
                              <CatIcon className="w-3 h-3" />
                            </div>
                            <span className={`text-sm flex-1 transition-colors ${
                              selected ? 'text-foreground font-medium' : 'text-muted-foreground'
                            }`}>
                              {cat}
                            </span>
                            {selected && (
                              <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                Considering
                              </span>
                            )}
                          </div>

                          {/* Detail inputs for acting/song categories */}
                          {selected && hasDetailInput && catData && (
                            <div className="bg-card/20 border border-t-0 border-primary/20 rounded-b-xl px-4 py-3 space-y-2">
                              <p className="text-[11px] text-muted-foreground/70 font-medium uppercase tracking-wider">
                                {getDetailLabel(cat)}
                              </p>
                              {catData.details.map((detail, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={detail}
                                    onChange={(e) => updateDetail(cat, idx, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder={getDetailPlaceholder(cat)}
                                    className="flex-1 px-3 py-1.5 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                                  />
                                  {catData.details.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); removeDetail(cat, idx) }}
                                      className="p-1 text-muted-foreground/50 hover:text-red-400 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); addDetail(cat) }}
                                className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors mt-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add another {cat === 'Original Song' ? 'song' : 'performance'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Review Text */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            <PenTool className="w-4 h-4 inline mr-1.5 opacity-60" />
            Written Review <span className="opacity-50">(optional)</span>
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 bg-card/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-y"
            placeholder="Write your review here..."
          />
        </div>

        {/* Error / Success */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Review & considerations submitted successfully!
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !filmTitle}
          className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <>
              <Trophy className="w-5 h-5" />
              Submit Review
            </>
          )}
        </button>
      </form>
    </div>
  )
}
