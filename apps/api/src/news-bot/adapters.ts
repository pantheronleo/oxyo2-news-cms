import { parseFeed, type FeedItem } from './verification.js'

export type ConfiguredSource = { feedUrl: string }
export interface NewsSourceAdapter {
  id: string
  discover(source: ConfiguredSource): Promise<FeedItem[]>
}

export const rssAtomAdapter: NewsSourceAdapter = {
  id: 'rss-atom',
  async discover(source) {
    const response = await fetch(source.feedUrl, { headers: { 'user-agent': 'PaperleafNewsBot/1.0', accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.1' }, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Feed request failed: ${response.status} ${response.statusText}`)
    return parseFeed(await response.text(), response.url)
  }
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
