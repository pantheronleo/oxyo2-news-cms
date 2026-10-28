import { describe, expect, it } from 'vitest'
import { pageJsonLd } from './prerender.js'

describe('pageJsonLd', () => {
  it('creates AboutPage structured data for server-rendered About pages', () => {
    const url = 'https://thepaperleaf.com/page/about-thepaperleaf'

    expect(pageJsonLd('AboutPage', 'About ThePaperLeaf', url, 'Publication overview.', 'en')).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About ThePaperLeaf',
      url,
      description: 'Publication overview.',
      inLanguage: 'en',
      publisher: { '@type': 'NewsMediaOrganization' },
    })
  })
})
