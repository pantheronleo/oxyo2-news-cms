import { fileTypeFromBuffer } from 'file-type'
import { config } from '../config.js'

export type VisualAsset = {
  image?: Buffer
  remoteUrl?: string
  mimeType: string
  extension: string
  width?: number
  height?: number
  provider: string
  providerAssetId?: string
  attributionName?: string
  attributionUrl?: string
  license?: string
  visualOrigin: 'PEXELS' | 'PIXABAY' | 'UNSPLASH' | 'SYSTEM_FALLBACK'
  caption: string
}
export type VisualResolution = { asset: VisualAsset | null; attempts: Array<{ stage: string; message: string }> }

const escapeXml = (value: string) => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]!))

/** Creates a local, non-AI fallback cover so an otherwise valid draft never reaches the site without a thumbnail. */
export function fallbackCoverVisual(input: { title: string; category: string }): VisualAsset {
  const category = escapeXml(input.category.trim() || 'News').slice(0, 48)
  const title = escapeXml(input.title.trim() || 'ThePaperLeaf news update').slice(0, 140)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${title}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#183d31"/><stop offset="1" stop-color="#2f6650"/></linearGradient><radialGradient id="orb" cx="84%" cy="18%" r="65%"><stop stop-color="#dcecbd" stop-opacity=".95"/><stop offset="1" stop-color="#dcecbd" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="675" fill="url(#bg)"/><rect width="1200" height="675" fill="url(#orb)"/><path d="M0 520C238 400 378 650 625 528S951 423 1200 537V675H0Z" fill="#ffffff" fill-opacity=".09"/><text x="78" y="98" fill="#dcecbd" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="5">THEPAPERLEAF</text><text x="78" y="174" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="3">${category.toUpperCase()}</text><foreignObject x="78" y="230" width="920" height="280"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#fff;font-size:54px;font-weight:700;line-height:1.12;letter-spacing:-1px">${title}</div></foreignObject><text x="78" y="608" fill="#ffffff" fill-opacity=".72" font-family="Arial, sans-serif" font-size="20">Editorial cover — stock image review required</text></svg>`
  return { image: Buffer.from(svg), mimeType: 'image/svg+xml', extension: '.svg', width: 1200, height: 675, provider: 'ThePaperLeaf', license: 'ThePaperLeaf system fallback', visualOrigin: 'SYSTEM_FALLBACK', caption: 'ThePaperLeaf editorial fallback cover. Replace with a reviewed stock image when available.' }
}

const extensionFor = (mimeType: string) => ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' } as Record<string, string>)[mimeType] || '.png'

async function parseResponse(response: Response, provider: string) {
  const body = await response.text()
  if (!body.trim()) throw new Error(`${provider} returned an empty response body`)
  try { return JSON.parse(body) } catch { throw new Error(`${provider} returned incomplete JSON`) }
}

async function pexelsVisual(query: string): Promise<VisualAsset | null> {
  if (!config.PEXELS_API_KEY) return null
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query.slice(0, 180))}&per_page=1&orientation=landscape`, { headers: { authorization: config.PEXELS_API_KEY }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Pexels returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const photo = (await parseResponse(response, 'Pexels')).photos?.[0]
  if (!photo?.src?.large2x) return null
  const imageResponse = await fetch(photo.src.large2x, { signal: AbortSignal.timeout(30_000) })
  if (!imageResponse.ok) throw new Error(`Pexels image returned ${imageResponse.status}`)
  const image = Buffer.from(await imageResponse.arrayBuffer()); const detected = await fileTypeFromBuffer(image)
  const mimeType = detected?.mime || imageResponse.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  if (!mimeType.startsWith('image/')) throw new Error('Pexels returned a non-image asset')
  return { image, mimeType, extension: extensionFor(mimeType), width: photo.width, height: photo.height, provider: 'Pexels', providerAssetId: String(photo.id), attributionName: photo.photographer || undefined, attributionUrl: photo.photographer_url || photo.url || undefined, license: 'Pexels License', visualOrigin: 'PEXELS', caption: photo.photographer ? `Photo by ${photo.photographer} via Pexels.` : 'Photo via Pexels.' }
}

async function pixabayVisual(query: string): Promise<VisualAsset | null> {
  if (!config.PIXABAY_API_KEY) return null
  const params = new URLSearchParams({ key: config.PIXABAY_API_KEY, q: query.slice(0, 180), image_type: 'photo', orientation: 'horizontal', safesearch: 'true', per_page: '3' })
  const response = await fetch(`https://pixabay.com/api/?${params}`, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Pixabay returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const photo = (await parseResponse(response, 'Pixabay')).hits?.[0]
  if (!photo?.largeImageURL) return null
  const imageResponse = await fetch(photo.largeImageURL, { signal: AbortSignal.timeout(30_000) })
  if (!imageResponse.ok) throw new Error(`Pixabay image returned ${imageResponse.status}`)
  const image = Buffer.from(await imageResponse.arrayBuffer()); const detected = await fileTypeFromBuffer(image)
  const mimeType = detected?.mime || imageResponse.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  if (!mimeType.startsWith('image/')) throw new Error('Pixabay returned a non-image asset')
  const attributionUrl = photo.pageURL || (photo.user && photo.user_id ? `https://pixabay.com/users/${photo.user}-${photo.user_id}/` : undefined)
  return { image, mimeType, extension: extensionFor(mimeType), width: photo.imageWidth, height: photo.imageHeight, provider: 'Pixabay', providerAssetId: String(photo.id), attributionName: photo.user || undefined, attributionUrl, license: 'Pixabay Content License', visualOrigin: 'PIXABAY', caption: photo.user ? `Photo by ${photo.user} via Pixabay.` : 'Photo via Pixabay.' }
}

function unsplashReferral(url: string) {
  const value = new URL(url)
  value.searchParams.set('utm_source', 'paperleaf_cms')
  value.searchParams.set('utm_medium', 'referral')
  return value.toString()
}

async function unsplashVisual(query: string): Promise<VisualAsset | null> {
  if (!config.UNSPLASH_ACCESS_KEY) return null
  const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query.slice(0, 180))}&per_page=1&orientation=landscape`, { headers: { authorization: `Client-ID ${config.UNSPLASH_ACCESS_KEY}` }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Unsplash returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const photo = (await parseResponse(response, 'Unsplash')).results?.[0]
  if (!photo?.urls?.regular) return null
  const attributionUrl = photo.user?.links?.html ? unsplashReferral(photo.user.links.html) : photo.links?.html ? unsplashReferral(photo.links.html) : undefined
  return { remoteUrl: photo.urls.regular, mimeType: 'image/jpeg', extension: '.jpg', width: photo.width, height: photo.height, provider: 'Unsplash', providerAssetId: String(photo.id), attributionName: photo.user?.name || undefined, attributionUrl, license: 'Unsplash License (hotlinked)', visualOrigin: 'UNSPLASH', caption: photo.user?.name ? `Photo by ${photo.user.name} on Unsplash.` : 'Photo via Unsplash.' }
}

export async function resolveVisual(input: { query: string; fallbackQueries?: string[]; purpose: 'cover' | 'inline' }): Promise<VisualResolution> {
  const attempts: VisualResolution['attempts'] = []
  const queries = [...new Set([input.query, ...(input.fallbackQueries ?? [])].map(query => query.trim()).filter(Boolean))].slice(0, 3)
  const providers = [
    { key: 'pexels', label: 'Pexels', configured: Boolean(config.PEXELS_API_KEY), search: pexelsVisual },
    { key: 'pixabay', label: 'Pixabay', configured: Boolean(config.PIXABAY_API_KEY), search: pixabayVisual },
    { key: 'unsplash', label: 'Unsplash', configured: Boolean(config.UNSPLASH_ACCESS_KEY), search: unsplashVisual }
  ]
  for (const provider of providers) {
    if (!provider.configured) {
      attempts.push({ stage: `${provider.key}-not-configured`, message: `${provider.label} is not configured; using the next stock-image provider.` })
      continue
    }
    for (const query of queries) {
      try {
        const asset = await provider.search(query)
        if (asset) return { asset, attempts }
      } catch (error) { attempts.push({ stage: `${provider.key}-failed`, message: `${error instanceof Error ? error.message : `${provider.label} request failed.`} Query: ${query}` }) }
    }
    attempts.push({ stage: `${provider.key}-no-match`, message: `${provider.label} found no matching stock image after ${queries.length} search ${queries.length === 1 ? 'query' : 'queries'}.` })
  }

  attempts.push({ stage: 'stock-image-unavailable', message: 'No matching stock image was found. AI image generation is disabled, so the draft will be created without this visual.' })
  return { asset: null, attempts }
}
