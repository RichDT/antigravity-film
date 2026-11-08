// Pasting rich text (e.g. from Substack) into a review textarea keeps its italics as *asterisks*
// and its paragraph breaks as blank lines.
import type React from 'react'

export function htmlToReviewMarkup(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const BLOCK = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'])
  const walk = (n: Node, italic: boolean): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? ''
    if (n.nodeType !== Node.ELEMENT_NODE) return ''
    const el = n as HTMLElement
    if (['SCRIPT', 'STYLE', 'META', 'LINK'].includes(el.tagName)) return ''
    if (el.tagName === 'BR') return '\n'
    const style = el.getAttribute('style') ?? ''
    const isItalic = !italic && (el.tagName === 'EM' || el.tagName === 'I' || /font-style:\s*italic/i.test(style))
    const inner = Array.from(el.childNodes).map(c => walk(c, italic || isItalic)).join('')
    if (isItalic) {
      const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!
      return m[2] ? `${m[1]}*${m[2]}*${m[3]}` : inner
    }
    return BLOCK.has(el.tagName) ? `${inner}\n\n` : inner
  }
  return walk(doc.body, false)
    .replace(/\*\*/g, '')            // adjacent italic runs merge
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** onPaste handler for a controlled textarea: converts pasted HTML, falls back to the browser default for plain text. */
export function pasteAsReviewMarkup(e: React.ClipboardEvent<HTMLTextAreaElement>, value: string, setValue: (v: string) => void) {
  const html = e.clipboardData.getData('text/html')
  if (!html) return
  const md = htmlToReviewMarkup(html)
  if (!md) return
  e.preventDefault()
  const ta = e.currentTarget
  const start = ta.selectionStart ?? value.length
  const end = ta.selectionEnd ?? value.length
  const next = value.slice(0, start) + md + value.slice(end)
  setValue(next)
  requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + md.length })
}
