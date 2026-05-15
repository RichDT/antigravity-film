'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Share2, Film, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FilmResult {
  film_id: number
  title: string
  release_year: number | null
  grade: string | null
}

function gradeColors(grade: string): { bg: string; text: string } {
  const letter = (grade.includes('//') ? grade.split('//')[0] : grade).charAt(0).toUpperCase()
  switch (letter) {
    case 'A': return { bg: '#059669', text: '#fff' }
    case 'B': return { bg: '#0284c7', text: '#fff' }
    case 'C': return { bg: '#d97706', text: '#fff' }
    case 'D': return { bg: '#ea580c', text: '#fff' }
    case 'F': return { bg: '#dc2626', text: '#fff' }
    default:  return { bg: '#6b5858', text: '#b8a8a0' }
  }
}

export default function AdminShareSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FilmResult[]>([])
  const [searching, setSearching] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/films-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.films || [])
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => search(value), 280)
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

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
            <div className="clip-hexagon bg-primary/20 flex items-center justify-center" style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}>
              <Share2 className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Share</h1>
            <p className="text-sm text-muted-foreground">Generate an Instagram card for any reviewed film</p>
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
        <Link href="/admin/add-review" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Add Review
        </Link>
        <Link href="/admin/nominations" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Nominations
        </Link>
        <Link href="/admin/winners" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Winners
        </Link>
        <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">Share</span>
        <Link href="/admin/feedback" className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Feedback
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            autoFocus
            className="w-full px-4 py-3.5 pl-12 bg-card/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-lg"
            placeholder="Search for a film…"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(film => {
            const gradeText = film.grade
              ? (film.grade.includes('//') ? film.grade.split('//')[0] : film.grade)
              : null
            const colors = gradeText ? gradeColors(film.grade!) : null

            return (
              <Link
                key={film.film_id}
                href={`/admin/share/${film.film_id}`}
                className="flex items-center justify-between px-4 py-3.5 bg-card/40 hover:bg-card border border-border/50 hover:border-border rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-8 clip-hexagon bg-muted/40 group-hover:bg-muted/60 flex items-center justify-center transition-colors shrink-0">
                    <Film className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-foreground font-medium group-hover:text-primary transition-colors">
                      {film.title}
                    </span>
                    {film.release_year && (
                      <span className="text-muted-foreground text-sm ml-2">{film.release_year}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {gradeText && colors ? (
                    <span
                      className="w-7 h-8 clip-hexagon flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {gradeText}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">no grade</span>
                  )}
                  <Share2 className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">No films found matching &ldquo;{query}&rdquo;</p>
      )}

      {query.length === 0 && (
        <p className="text-center text-muted-foreground/50 text-sm py-12">
          Start typing to search the film database
        </p>
      )}
    </div>
  )
}
