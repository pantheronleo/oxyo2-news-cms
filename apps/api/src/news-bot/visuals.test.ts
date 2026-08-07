import { afterEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ||= 'postgresql://cms:change-me@127.0.0.1:5432/cms'
process.env.SESSION_SECRET ||= 'test-session-secret-with-at-least-32-characters'
const { config } = await import('../config.js')
const { fallbackCoverVisual, resolveVisual } = await import('./visuals.js')

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5WAAAAABJRU5ErkJggg==', 'base64')
const originalKey = config.PEXELS_API_KEY
const originalPixabayKey = config.PIXABAY_API_KEY
const originalUnsplashKey = config.UNSPLASH_ACCESS_KEY

afterEach(() => { vi.restoreAllMocks(); ;(config as any).PEXELS_API_KEY = originalKey; ;(config as any).PIXABAY_API_KEY = originalPixabayKey; ;(config as any).UNSPLASH_ACCESS_KEY = originalUnsplashKey })

describe('news bot visual resolver', () => {
  it('uses a Pexels asset before trying publisher or AI fallbacks', async () => {
    ;(config as any).PEXELS_API_KEY = 'test-key'
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ photos: [{ id: 42, photographer: 'A Photographer', photographer_url: 'https://pexels.example/person', src: { large2x: 'https://images.example/photo.jpg' } }] })))
    fetchMock.mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } }))
    const result = await resolveVisual({ query: 'market', purpose: 'cover' })
    expect(result.asset).toMatchObject({ provider: 'Pexels', providerAssetId: '42', visualOrigin: 'PEXELS', attributionName: 'A Photographer' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('tries broader Pexels thumbnail queries before using another visual source', async () => {
    ;(config as any).PEXELS_API_KEY = 'test-key'
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ photos: [] })))
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ photos: [{ id: 99, photographer: 'Second Photographer', src: { large2x: 'https://images.example/second.jpg' } }] })))
    fetchMock.mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } }))
    const result = await resolveVisual({ query: 'too specific', fallbackQueries: ['broader market'], purpose: 'cover' })
    expect(result.asset).toMatchObject({ provider: 'Pexels', providerAssetId: '99' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it('uses Pixabay when Pexels has no configured key', async () => {
    ;(config as any).PEXELS_API_KEY = undefined
    ;(config as any).PIXABAY_API_KEY = 'pixabay-key'
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ hits: [{ id: 7, user: 'Stock Creator', pageURL: 'https://pixabay.example/photo', largeImageURL: 'https://images.example/pixabay.jpg' }] })))
    fetchMock.mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } }))
    const result = await resolveVisual({ query: 'market', purpose: 'cover' })
    expect(result.asset).toMatchObject({ provider: 'Pixabay', providerAssetId: '7', visualOrigin: 'PIXABAY', attributionName: 'Stock Creator' })
  })
  it('uses an attributed Unsplash hotlink after other stock providers have no configured key', async () => {
    ;(config as any).PEXELS_API_KEY = undefined
    ;(config as any).PIXABAY_API_KEY = undefined
    ;(config as any).UNSPLASH_ACCESS_KEY = 'unsplash-key'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'abc', width: 1200, height: 800, urls: { regular: 'https://images.unsplash.example/photo.jpg' }, links: { html: 'https://unsplash.example/photos/abc' }, user: { name: 'Photo Creator', links: { html: 'https://unsplash.example/@creator' } } }] })))
    const result = await resolveVisual({ query: 'market', purpose: 'cover' })
    expect(result.asset).toMatchObject({ provider: 'Unsplash', visualOrigin: 'UNSPLASH', remoteUrl: 'https://images.unsplash.example/photo.jpg', attributionName: 'Photo Creator' })
    expect(result.asset?.attributionUrl).toContain('utm_source=paperleaf_cms')
  })
  it('does not call an AI image model when stock providers cannot return a visual', async () => {
    ;(config as any).PEXELS_API_KEY = undefined
    ;(config as any).PIXABAY_API_KEY = undefined
    ;(config as any).UNSPLASH_ACCESS_KEY = undefined
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await resolveVisual({ query: 'market', purpose: 'cover' })
    expect(result.asset).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.attempts).toContainEqual(expect.objectContaining({ stage: 'stock-image-unavailable' }))
  })
  it('can supply a local non-AI cover when stock providers have no suitable image', () => {
    const fallback = fallbackCoverVisual({ title: 'A relevant news update', category: 'Business' })
    expect(fallback).toMatchObject({ provider: 'ThePaperLeaf', visualOrigin: 'SYSTEM_FALLBACK', mimeType: 'image/svg+xml', width: 1200, height: 675 })
    expect(fallback.image?.toString()).toContain('A relevant news update')
  })
})
