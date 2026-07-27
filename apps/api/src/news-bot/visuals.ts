import { fileTypeFromBuffer } from 'file-type'
import { config } from '../config.js'
import { fetchApprovedSourceImageReference } from './adapters.js'
import { describeApprovedSourceImage, generateNewsImage } from './openai.js'

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
  visualOrigin: 'PEXELS' | 'PIXABAY' | 'UNSPLASH' | 'SOURCE_REFERENCE_AI' | 'AI_GENERATED'
  caption: string
}
export type VisualResolution = { asset: VisualAsset | null; attempts: Array<{ stage: string; message: string }> }

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

export async function resolveVisual(input: { query: string; fallbackQueries?: string[]; prompt: string; purpose: 'cover' | 'inline'; allowSourceReference: boolean; articleUrl: string }): Promise<VisualResolution> {
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

  if (input.allowSourceReference) {
    try {
      const reference = await fetchApprovedSourceImageReference(input.articleUrl)
      if (reference) {
        const description = await describeApprovedSourceImage(reference.image)
        if (description) {
          const image = await generateNewsImage(`Create a visibly distinct, stylised editorial interpretation of this licensed reference scene: ${description}`, input.purpose)
          if (image) return { asset: { image, mimeType: 'image/png', extension: '.png', provider: 'Publisher reference', attributionUrl: reference.imageUrl, license: 'Approved publisher reference', visualOrigin: 'SOURCE_REFERENCE_AI', caption: 'Original AI illustration based on an approved publisher image reference.' }, attempts }
        } else attempts.push({ stage: 'source-reference-skipped', message: 'OLLAMA_VISION_MODEL is not configured, so the approved source image could not be described.' })
      } else attempts.push({ stage: 'source-reference-no-image', message: 'No publisher image was discovered on the article page.' })
    } catch (error) { attempts.push({ stage: 'source-reference-failed', message: error instanceof Error ? error.message : 'Approved source image processing failed.' }) }
  }

  try {
    const image = await generateNewsImage(input.prompt, input.purpose)
    if (image) return { asset: { image, mimeType: 'image/png', extension: '.png', provider: 'AI', license: 'Original AI-generated image', visualOrigin: 'AI_GENERATED', caption: input.purpose === 'cover' ? 'Original cover image generated for this article.' : 'Original supporting illustration generated for this article.' }, attempts }
    attempts.push({ stage: 'ai-image-empty', message: 'AI image generation returned no image data.' })
  } catch (error) { attempts.push({ stage: 'ai-image-failed', message: error instanceof Error ? error.message : 'AI image generation failed.' }) }
  return { asset: null, attempts }
}
