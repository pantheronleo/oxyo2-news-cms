import { parseFeed, type FeedItem } from './verification.js'

export type ConfiguredSource = { feedUrl: string }
export type FeedDiscovery = {
  items: FeedItem[]
  request: { feedUrl: string; finalUrl: string; status: number; attempts: number }
}
export class FeedRequestError extends Error {
  constructor(message: string, readonly context: Record<string, unknown>) {
    super(message)
    this.name = 'FeedRequestError'
  }
}
export interface NewsSourceAdapter {
  id: string
  discover(source: ConfiguredSource): Promise<FeedDiscovery>
}

const FEED_MAX_ATTEMPTS = 3
const feedHeaders = {
  // This remains an identifiable bot rather than impersonating a browser. The
  // additional contact URL helps publishers diagnose a blocked feed request.
  'user-agent': 'ThePaperLeafNewsBot/1.0 (+https://thepaperleaf.com/llms.txt)',
  accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.1',
  'accept-language': 'en-MY,en;q=0.9,zh-CN;q=0.8'
}

/** Transient publisher/WAF failures are worth retrying; malformed and missing feeds are not. */
export function shouldRetryFeedStatus(status: number) {
  return status === 403 || status === 408 || status === 425 || status === 429 || status >= 500
}

function retryDelay(response: Response | undefined, attempt: number) {
  const retryAfter = response?.headers.get('retry-after')
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0
  return Math.min(seconds > 0 ? seconds * 1000 : 600 * attempt, 5_000)
}

async function wait(milliseconds: number) { await new Promise(resolve => setTimeout(resolve, milliseconds)) }

export async function discoverRssAtomFeed(feedUrl: string): Promise<FeedDiscovery> {
  let lastResponse: Response | undefined
  let lastError: unknown
  for (let attempt = 1; attempt <= FEED_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(feedUrl, { headers: feedHeaders, signal: AbortSignal.timeout(20_000), redirect: 'follow' })
      if (response.ok) return { items: parseFeed(await response.text(), response.url), request: { feedUrl, finalUrl: response.url, status: response.status, attempts: attempt } }
      lastResponse = response
      if (!shouldRetryFeedStatus(response.status) || attempt === FEED_MAX_ATTEMPTS) break
      await wait(retryDelay(response, attempt))
    } catch (error) {
      lastError = error
      if (attempt === FEED_MAX_ATTEMPTS) break
      await wait(600 * attempt)
    }
  }
  const failureContext = lastResponse
    ? {
        feedUrl,
        finalUrl: lastResponse.url,
        status: lastResponse.status,
        statusText: lastResponse.statusText,
        attempts: FEED_MAX_ATTEMPTS,
        server: lastResponse.headers.get('server'),
        cloudflareRay: lastResponse.headers.get('cf-ray'),
        retryAfter: lastResponse.headers.get('retry-after')
      }
    : { feedUrl, attempts: FEED_MAX_ATTEMPTS, networkError: lastError instanceof Error ? lastError.message : 'network error' }
  const suffix = lastResponse
    ? `${lastResponse.status} ${lastResponse.statusText} after ${FEED_MAX_ATTEMPTS} attempts${lastResponse.status === 403 ? ' (the publisher or its web-application firewall refused the bot request)' : ''}`
    : `${lastError instanceof Error ? lastError.message : 'network error'} after ${FEED_MAX_ATTEMPTS} attempts`
  throw new FeedRequestError(`Feed request failed: ${suffix}`, failureContext)
}

export const rssAtomAdapter: NewsSourceAdapter = {
  id: 'rss-atom',
  discover: source => discoverRssAtomFeed(source.feedUrl)
}

const decodeHtml = (value: string) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => {
    const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _
  })
  .replace(/&#39;/gi, "'")

const textFromHtml = (html: string) => decodeHtml(html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

function divContentsWithClass(html: string, className: string) {
  const opening = new RegExp(`<div\\b(?=[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'])[^>]*>`, 'i').exec(html)
  if (!opening || opening.index === undefined) return ''
  const tag = /<\/?div\b[^>]*>/gi; tag.lastIndex = opening.index + opening[0].length
  let depth = 1; let match: RegExpExecArray | null
  while ((match = tag.exec(html))) {
    if (/^<\//.test(match[0])) depth--
    else if (!/\/>$/.test(match[0])) depth++
    if (depth === 0) return html.slice(opening.index + opening[0].length, match.index)
  }
  return ''
}

/** SAYS renders article copy in a div rather than semantic article/main elements. */
export function extractSaysArticleBody(html: string) {
  return textFromHtml(divContentsWithClass(html, 'story-content'))
    // Presentation-only content is placed before the first reported paragraph.
    .replace(/^Cover image via .*?Follow us on .*?latest stories and breaking news\.\s*/i, '')
}

export async function enhanceArticleBody(article: FeedItem) {
  const isSays = new URL(article.url).hostname.replace(/^www\./, '') === 'says.com'
  // SAYS's feed is an intentionally short teaser, even when it is longer than the
  // generic threshold, so always prefer its article-page copy.
  if (!isSays && article.body.length >= 400) return { ...article, extractedFromArticle: false }
  const response = await fetch(article.url, { headers: { 'user-agent': 'PaperleafNewsBot/1.0', accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(30_000), redirect: 'follow' })
  if (!response.ok) throw new Error(`Article request failed: ${response.status} ${response.statusText}`)
  const html = await response.text()
  const section = isSays ? extractSaysArticleBody(html) : textFromHtml(/<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] || /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] || '')
  const body = section
  return { ...article, body: body || article.body, extractedFromArticle: Boolean(body) }
}

function articleImageUrl(html: string, pageUrl: string) {
  const meta = /<meta\b(?=[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'])[^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]
    || /<meta\b(?=[^>]*content=["']([^"']+)["'])[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i.exec(html)?.[1]
  if (!meta) return null
  try { const url = new URL(decodeHtml(meta), pageUrl); return /^https?:$/.test(url.protocol) ? url.toString() : null } catch { return null }
}

/** Downloads a publisher visual only after the source has explicit reuse permission configured. */
export async function fetchApprovedSourceImageReference(articleUrl: string) {
  const page = await fetch(articleUrl, { headers: { 'user-agent': 'PaperleafNewsBot/1.0', accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(30_000), redirect: 'follow' })
  if (!page.ok) throw new Error(`Source page request failed: ${page.status} ${page.statusText}`)
  const imageUrl = articleImageUrl(await page.text(), page.url)
  if (!imageUrl) return null
  const image = await fetch(imageUrl, { headers: { 'user-agent': 'PaperleafNewsBot/1.0', accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(30_000), redirect: 'follow' })
  if (!image.ok) throw new Error(`Source image request failed: ${image.status} ${image.statusText}`)
  const mimeType = image.headers.get('content-type')?.split(';')[0] || ''
  if (!mimeType.startsWith('image/')) throw new Error('Source image response was not an image')
  return { imageUrl: image.url, image: Buffer.from(await image.arrayBuffer()), mimeType }
}
