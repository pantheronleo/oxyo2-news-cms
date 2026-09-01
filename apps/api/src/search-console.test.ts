import { describe, expect, it } from 'vitest'
import { inspectionBaseUrl, reportRange, searchConsoleConstants, sitemapMetric } from './search-console.js'

describe('Search Console report ranges', () => {
  it('accepts a valid requested date range', () => {
    expect(reportRange({ startDate: '2026-07-01', endDate: '2026-07-31' })).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' })
  })
  it('rejects malformed and inverted ranges before contacting Google', () => {
    expect(() => reportRange({ startDate: 'July', endDate: '2026-07-31' })).toThrow('YYYY-MM-DD')
    expect(() => reportRange({ startDate: '2026-07-31', endDate: '2026-07-01' })).toThrow('valid date range')
  })
  it('keeps exported query and page rows within the agreed limits', () => {
    expect(searchConsoleConstants.MAX_QUERY_ROWS).toBe(5_000)
    expect(searchConsoleConstants.MAX_PAGE_ROWS).toBe(5_000)
  })
  it('normalizes Google sitemap warning and error values to non-negative numbers', () => {
    expect(sitemapMetric('2')).toBe(2)
    expect(sitemapMetric(0)).toBe(0)
    expect(sitemapMetric('invalid')).toBeUndefined()
  })
  it('derives inspection URLs from the selected GSC property, never localhost configuration', () => {
    expect(inspectionBaseUrl('sc-domain:thepaperleaf.com')).toBe('https://thepaperleaf.com')
    expect(inspectionBaseUrl('https://www.thepaperleaf.com/')).toBe('https://www.thepaperleaf.com')
  })
})
