import { describe, expect, it } from 'vitest'
import { transliterateSlugBase } from './slugify-cjk.js'

describe('transliterateSlugBase', () => {
  it('prefers the English title when it slugifies to a usable base', () => {
    expect(transliterateSlugBase('马来西亚推出新的公共交通计划', 'Malaysia launches new public transport plan')).toBe('malaysia-launches-new-public-transport-plan')
  })
  it('falls back to pinyin transliteration when no English title is given', () => {
    const slug = transliterateSlugBase('马来西亚推出新的公共交通计划', null)
    expect(slug).not.toBe('')
    expect(slug).not.toBe('news-story')
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })
  it('returns an empty string for a fully symbolic title, leaving the news-story fallback to the caller', () => {
    expect(transliterateSlugBase('###', null)).toBe('')
  })
})
