import React from 'react'
import { useParams } from 'react-router-dom'
import { fetchPageBySlug, type Post } from '../newsApi'
import { resolveMediaUrl, stripHtml } from '../utils'
import { AboutHighlights, ErrorView, JsonLd, Loading, Seo, absoluteUrl, isAboutPage, publisherJsonLd, useAsync } from '../viewShared'

const aboutFallback: Post = { id: 'about-fallback', type: 'PAGE', status: 'PUBLISHED', title: 'About ThePaperLeaf', slug: 'about-thepaperleaf', excerpt: 'ThePaperLeaf is an independent magazine-style publication for clear, visual, and context-rich reporting.', category: 'Page', authorName: 'Editorial Desk', sourceLabel: 'ThePaperLeaf', isFeatured: false, markdown: '', html: '<p>ThePaperLeaf is an independent magazine-style publication built for readers who want clarity without losing depth. We cover business, technology, culture, world affairs, science, and sport through concise reporting, visual storytelling, and practical context.</p><h2>What this publication is for</h2><p>Our goal is to make fast-moving stories easier to understand. Each section is shaped around useful signals: what changed, why it matters, and what readers should watch next.</p><h2>Editorial approach</h2><ul><li>We prioritize context over noise and explain the forces behind each headline.</li><li>We use strong visuals, clear categories, and readable summaries to help readers move quickly.</li><li>We treat archives as living context, so stories remain useful after the first news cycle.</li><li>We separate reporting, analysis, and source labels so readers can understand what they are reading.</li></ul><h2>Our promise</h2><p>ThePaperLeaf is designed to feel calm, direct, and modern: a place for sharp daily reading, deeper weekend browsing, and discovery across topics that shape public life.</p>', wordCount: 190, tags: ['about', 'thepaperleaf', 'news'], seoTitle: 'About ThePaperLeaf — Independent magazine news', seoDescription: 'Learn about ThePaperLeaf, an independent magazine-style publication for clear, visual, and context-rich reporting.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

export default function StaticPage() {
  const { slug = '' } = useParams()
  const { data, loading, error } = useAsync(async () => {
    if (slug === 'about-this-cms') return aboutFallback
    try { return await fetchPageBySlug(slug) } catch (err) { if (slug === 'about-thepaperleaf') return aboutFallback; throw err }
  }, [slug])
  if (loading) return <Loading />
  if (error || !data) return <ErrorView message={error ?? 'Page not found'} />
  const pageUrl = absoluteUrl(`/page/${data.slug}`)
  const description = data.seoDescription || data.excerpt || stripHtml(data.html).slice(0, 160)
  return <main className={`static-page ${isAboutPage(data.slug) ? 'about-page' : ''}`}><Seo title={`${data.seoTitle || data.title} — ThePaperLeaf`} description={description} image={resolveMediaUrl(data.coverMedia?.url)} canonical={pageUrl} type="article" /><JsonLd id={`page-${data.slug}`} data={{ '@context': 'https://schema.org', '@type': 'AboutPage', name: data.title, url: pageUrl, description, publisher: publisherJsonLd() }} /><section className="static-hero"><span className="kicker">Page</span><h1>{data.title}</h1>{data.excerpt && <p>{data.excerpt}</p>}</section>{isAboutPage(data.slug) && <AboutHighlights />}<div className="article-body" dangerouslySetInnerHTML={{ __html: data.html }} /></main>
}
