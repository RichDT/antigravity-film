import type { MetadataRoute } from 'next'

const SITE = 'https://www.richpicks.app'

// AI training and bulk-scraping crawlers: they fetch every one of the site's ~37,000 pages, which costs hosting
// usage and gives visitors nothing back. Search engines stay welcome (they bring readers).
const AI_SCRAPERS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'CCBot', 'Google-Extended',
  'Applebot-Extended', 'Bytespider', 'Amazonbot', 'meta-externalagent', 'FacebookBot', 'PerplexityBot', 'cohere-ai',
  'cohere-training-data-crawler', 'Diffbot', 'ImagesiftBot', 'Omgilibot', 'Timpibot', 'YouBot', 'AI2Bot', 'PetalBot',
  'DataForSeoBot', 'SemrushBot', 'AhrefsBot', 'MJ12bot', 'DotBot',
]

// Pages that are private, per-visitor, or not worth indexing
const PRIVATE = ['/admin', '/api/', '/account', '/signin', '/auth/', '/list/', '/search']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_SCRAPERS, disallow: '/' },
      // Crawl-delay is honored by Bing, Yandex and others (Google sets its own pace)
      { userAgent: '*', allow: '/', disallow: PRIVATE, crawlDelay: 5 },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
