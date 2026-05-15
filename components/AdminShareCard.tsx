'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { Download, Share2, Check, Loader2, Film } from 'lucide-react'
import { toPng } from 'html-to-image'

interface FilmShareData {
  id: number
  title: string
  year: number
  grade: string
  reviewText: string
  directors: string[]
  writers: string[]
  rank?: number
}

const HEX_PATH = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function gradeDisplay(grade: string): string {
  return grade.includes('//') ? grade.split('//')[0] : grade
}

function gradeColors(grade: string): { bg: string; text: string; glow: string } {
  const letter = gradeDisplay(grade).charAt(0).toUpperCase()
  switch (letter) {
    case 'A': return { bg: '#059669', text: '#ffffff', glow: 'rgba(5,150,105,0.45)' }
    case 'B': return { bg: '#0284c7', text: '#ffffff', glow: 'rgba(2,132,199,0.45)' }
    case 'C': return { bg: '#d97706', text: '#ffffff', glow: 'rgba(217,119,6,0.45)' }
    case 'D': return { bg: '#ea580c', text: '#ffffff', glow: 'rgba(234,88,12,0.45)' }
    case 'F': return { bg: '#dc2626', text: '#ffffff', glow: 'rgba(220,38,38,0.45)' }
    default:  return { bg: '#6b5858', text: '#b8a8a0', glow: 'none' }
  }
}

// Joins the last two words with a non-breaking space so a single word can
// never be stranded alone on the final wrapped line of a title.
function preventOrphan(text: string): string {
  const words = text.split(' ')
  if (words.length <= 2) return text
  return words.slice(0, -1).join(' ') + ' ' + words[words.length - 1]
}

function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

// ─── Full-size download card (1080 × 1350 px, inline styles only) ─────────────
// This is the single source of truth — used for both preview (scaled down) and download.

function DownloadCard({ film }: { film: FilmShareData }) {
  const colors = gradeColors(film.grade)
  const displayGrade = gradeDisplay(film.grade)
  const excerpt = film.reviewText.length > 180
    ? film.reviewText.slice(0, 180).replace(/\s\S+$/, '') + '…'
    : film.reviewText
  const directorLine = joinNames(film.directors)
  const writerLine = joinNames(film.writers)
  const titleFontSize = film.title.length > 28 ? 68 : film.title.length > 18 ? 80 : 90

  return (
    <div
      style={{
        width: 1080, height: 1350,
        background: '#4a3b3b',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Brand header */}
      <div style={{
        paddingTop: 64, paddingLeft: 64, paddingRight: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 74,
            clipPath: HEX_PATH,
            background: '#d4af37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#2a2222', fontWeight: 'bold', fontSize: 28 }}>R</span>
          </div>
          <span style={{ color: '#f5f0eb', fontSize: 38, letterSpacing: '0.1em', fontWeight: 600 }}>RICH PICKS</span>
        </div>
        <span style={{ color: '#b8a8a0', fontSize: 38 }}>{film.year}</span>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 72, paddingRight: 72,
        position: 'relative', zIndex: 1,
      }}>
        {/* Grade hex: outer gold ring, inner grade color */}
        {film.grade && (
          // Outer: 248×286  (286 = 248 × 2/√3, regular hex proportions)
          // Inner: 192×222  (222 = 192 × 2/√3)
          // Gap each side: left=(248-192)/2=28, top=(286-222)/2=32
          <div style={{ position: 'relative', width: 248, height: 286, marginBottom: 52 }}>
            {/* Outer gold ring hex */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              clipPath: HEX_PATH,
              background: 'rgba(212,175,55,0.32)',
            }} />
            {/* Grade hex */}
            <div style={{
              position: 'absolute',
              top: 32, left: 28,
              width: 192, height: 222,
              clipPath: HEX_PATH,
              background: colors.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 70px ${colors.glow}`,
            }}>
              <span style={{ color: colors.text, fontSize: 88, fontWeight: 'bold', lineHeight: 1 }}>
                {displayGrade}
              </span>
            </div>
          </div>
        )}

        {/* Film title */}
        <h1 style={{
          color: '#f5f0eb',
          fontSize: titleFontSize,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 24,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          {preventOrphan(film.title)}
        </h1>

        {/* Credits */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 48 }}>
          {directorLine && (
            <p style={{ color: '#d4af37', fontSize: 30, letterSpacing: '0.03em', margin: 0 }}>
              Directed by {directorLine}
            </p>
          )}
          {writerLine && (
            <p style={{ color: '#d4af37', fontSize: 30, letterSpacing: '0.03em', margin: 0 }}>
              Written by {writerLine}
            </p>
          )}
        </div>

        {/* Decorative line */}
        <div style={{
          width: 160, height: 2,
          background: 'linear-gradient(to right, transparent, #d4af37, transparent)',
          marginBottom: 48,
        }} />

        {/* Review excerpt */}
        {excerpt && (
          <p style={{
            color: 'rgba(245,240,235,0.88)',
            fontSize: 46,
            textAlign: 'center',
            lineHeight: 1.6,
            maxWidth: 900,
            margin: 0,
          }}>
            &ldquo;{excerpt}&rdquo;
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{
        paddingBottom: 64, paddingLeft: 64, paddingRight: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 1,
      }}>
        {film.rank ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 56,
              clipPath: HEX_PATH,
              background: 'rgba(212,175,55,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 18 }}>#{film.rank}</span>
            </div>
            <span style={{ color: '#b8a8a0', fontSize: 28 }}>Top 10 of {film.year}</span>
          </div>
        ) : <div />}
        <span style={{ color: '#b8a8a0', fontSize: 30, letterSpacing: '0.08em' }}>richpicks.film</span>
      </div>

      {/* Corner accents */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 128, height: 128, borderTop: '2px solid rgba(212,175,55,0.2)', borderRight: '2px solid rgba(212,175,55,0.2)', borderTopRightRadius: 24 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 128, height: 128, borderBottom: '2px solid rgba(212,175,55,0.2)', borderLeft: '2px solid rgba(212,175,55,0.2)', borderBottomLeftRadius: 24 }} />
    </div>
  )
}

// ─── Font embedding helper ────────────────────────────────────────────────────
// html-to-image resolves @font-face src URLs relative to window.location, but
// Next.js/Turbopack serves fonts with relative paths like "../media/xxx.woff2"
// that are relative to the CSS chunk URL — so the fetch fails and the PNG falls
// back to a system font. This function correctly resolves and embeds the font.

async function buildPlayfairEmbedCSS(): Promise<string> {
  const parts: string[] = []

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style.fontFamily.replace(/['"]/g, '').trim()
      if (!family.includes('Playfair') && !family.includes('Inter')) continue

      const src = rule.style.getPropertyValue('src')
      const match = src.match(/url\(['"]?([^'")\s]+)['"]?\)/)
      if (!match) continue

      const resolvedUrl = new URL(match[1], sheet.href || window.location.href).href
      try {
        const resp = await fetch(resolvedUrl)
        const blob = await resp.blob()
        const dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res(reader.result as string)
          reader.onerror = rej
          reader.readAsDataURL(blob)
        })
        parts.push(rule.cssText.replace(match[0], `url(${dataUrl})`))
      } catch { /* skip unreachable variants */ }
    }
  }

  return parts.join('\n')
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function AdminShareCard({ film }: { film: FilmShareData }) {
  const downloadRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  // Scale the 1080px-wide card to fill the preview container
  const [previewScale, setPreviewScale] = useState(0.315)

  useEffect(() => {
    if (!previewContainerRef.current) return
    const measure = () => {
      if (!previewContainerRef.current) return
      setPreviewScale(previewContainerRef.current.clientWidth / 1080)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(previewContainerRef.current)
    return () => ro.disconnect()
  }, [])

  async function handleDownload() {
    if (!downloadRef.current) return
    setDownloading(true)
    try {
      const fontEmbedCSS = await buildPlayfairEmbedCSS()
      const dataUrl = await toPng(downloadRef.current, { cacheBust: true, pixelRatio: 1, fontEmbedCSS })
      const a = document.createElement('a')
      a.download = `${film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${film.year}.png`
      a.href = dataUrl
      a.click()
    } catch (err) {
      console.error('PNG export failed:', err)
    }
    setDownloading(false)
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayGrade = gradeDisplay(film.grade)
  const colors = gradeColors(film.grade)

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-12 clip-hexagon bg-primary/30 flex items-center justify-center">
            <div className="clip-hexagon bg-primary/20 flex items-center justify-center" style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}>
              <Film className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Share Asset</h1>
            <p className="text-sm text-muted-foreground">
              Instagram-ready card for <span className="text-foreground font-medium">{film.title}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Admin nav */}
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
        <Link href="/admin/share" className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">
          Share
        </Link>
        <Link href={`/film/${film.id}`} className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all ml-auto">
          View Film Page →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Preview — the actual DownloadCard scaled to fit */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Preview</p>
          {/*
            Container holds the exact aspect ratio (4:5 = 1080:1350).
            The DownloadCard is scaled down so its 1080px width matches the container width.
            overflow:hidden clips the untransformed layout space.
          */}
          <div
            ref={previewContainerRef}
            style={{
              width: '100%',
              aspectRatio: '4 / 5',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 12,
              border: '1px solid rgba(212,175,55,0.2)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
            }}>
              <div ref={downloadRef}>
                <DownloadCard film={film} />
              </div>
            </div>
          </div>
        </div>

        {/* Actions + details */}
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Export</p>
            <div className="space-y-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-xl transition-all"
              >
                {downloading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                {downloading ? 'Generating…' : 'Download as PNG (1080 × 1350)'}
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/60 hover:bg-secondary text-foreground rounded-xl transition-all text-sm"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Link copied!' : 'Copy share link'}
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Card Details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Film</span>
                <span className="font-medium text-foreground">{film.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Year</span>
                <span className="font-medium">{film.year}</span>
              </div>
              {film.grade && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Grade</span>
                  <span className="font-bold text-sm px-2.5 py-0.5 rounded" style={{ background: colors.bg, color: colors.text }}>
                    {displayGrade}
                  </span>
                </div>
              )}
              {film.directors.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Director</span>
                  <span className="font-medium text-right max-w-[60%]">{joinNames(film.directors)}</span>
                </div>
              )}
              {film.writers.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Writer</span>
                  <span className="font-medium text-right max-w-[60%]">{joinNames(film.writers)}</span>
                </div>
              )}
              {film.rank && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rank</span>
                  <span className="font-medium text-primary">#{film.rank} of {film.year}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Optimized for Instagram at <span className="text-foreground font-medium">1080 × 1350 px</span> (4:5 ratio). Works for feed posts; crop to 9:16 for Stories.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
