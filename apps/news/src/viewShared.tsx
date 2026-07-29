import React from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, Send, Sparkles } from 'lucide-react'
import type { Post } from './newsApi'
import { formatDate, readingTime, resolveMediaUrl, setJsonLd, setSeo, stripHtml } from './utils'

export const siteName = 'ThePaperLeaf'
export const siteDescription = 'Independent magazine-style news, analysis, and editorial explainers for curious readers.'
const unsplashHosts = new Set(['images.unsplash.com', 'plus.unsplash.com'])

export function useAsync<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  React.useEffect(() => {
    let alive = true
    setState({ loading: true })
    load()
      .then(data => alive && setState({ data, loading: false }))
      .catch(error => alive && setState({ error: error instanceof Error ? error.message : 'Unable to load content', loading: false }))
    return () => { alive = false }
  }, deps)
  return state
}

export function ArticleCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const sizes = featured
    ? '(max-width: 600px) calc(100vw - 56px), (max-width: 1080px) calc((100vw - 76px) / 2), 380px'
    : '(max-width: 600px) calc(100vw - 42px), (max-width: 1080px) calc((100vw - 76px) / 2), 280px'
  return (
    <Link className={`card ${featured ? 'featured-card' : ''}`} to={`/article/${post.slug}`} aria-label={`Read ${post.title}`}>
      <ArticleImage post={post} sizes={sizes} />
      <span className="kicker">{displayCategory(post)}</span>
      <h3>{post.title}</h3>
      <p>{post.excerpt || stripHtml(post.html).slice(0, 120)}</p>
      <ArticleMeta post={post} compact />
    </Link>
  )
}

export function MiniCard({ post, active = false, onPreview }: { post: Post; active?: boolean; onPreview?: () => void }) {
  return (
    <Link className={`mini-card ${active ? 'active' : ''}`} to={`/article/${post.slug}`} onMouseEnter={onPreview} onFocus={onPreview} aria-current={active ? 'true' : undefined}>
      <ArticleImage post={post} sizes="(max-width: 600px) 72px, 92px" />
      <span><small>{displayCategory(post)}</small><b>{post.title}</b></span>
    </Link>
  )
}

export function ArticleImage({ post, big = false, showCredit = false, priority = false, sizes }: { post?: Post; big?: boolean; showCredit?: boolean; priority?: boolean; sizes?: string }) {
  const url = resolveMediaUrl(post?.coverMedia?.url)
  const width = post?.coverMedia?.width || (big ? 1280 : 700)
  const height = post?.coverMedia?.height || (big ? 820 : 460)
  const displayUrl = url ? imageVariant(url, big ? 1280 : 700) : ''
  return (
    <div className={`article-image ${big ? 'big' : ''}`} style={{ '--image-ratio': `${width} / ${height}` } as React.CSSProperties}>
      {displayUrl ? <><img src={displayUrl} srcSet={imageSrcSet(url)} sizes={sizes || (big ? '(max-width: 760px) calc(100vw - 24px), 820px' : '(max-width: 600px) calc(100vw - 42px), 300px')} width={width} height={height} alt={post?.coverMedia?.altText || post?.title || ''} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding={priority ? 'sync' : 'async'} />{showCredit && <ImageCredit media={post?.coverMedia} linked />}</> : <div className="placeholder" aria-label={post ? displayCategory(post) : 'ThePaperLeaf'}><Sparkles /></div>}
    </div>
  )
}

function isUnsplash(url: string) {
  try { return unsplashHosts.has(new URL(url).hostname) } catch { return false }
}

function imageVariant(url: string, width: number) {
  if (!isUnsplash(url)) return url
  const next = new URL(url)
  next.searchParams.set('auto', 'format')
  next.searchParams.set('fit', 'crop')
  next.searchParams.set('w', String(width))
  next.searchParams.set('q', width <= 480 ? '72' : '78')
  return next.toString()
}

function imageSrcSet(url: string) {
  if (!isUnsplash(url)) return undefined
  return [320, 480, 700, 960, 1280].map(width => `${imageVariant(url, width)} ${width}w`).join(', ')
}

function stockCreditLabel(media?: Post['coverMedia']) {
  if (!media) return null
  const provider = media.provider || (media.url.includes('images.unsplash.com') ? 'Unsplash' : null)
  if (!provider || !['pexels', 'pixabay', 'unsplash'].includes(provider.toLowerCase())) return null
  return media.attributionName ? `Photo by ${media.attributionName} via ${provider}` : `Photo via ${provider}`
}

function ImageCredit({ media, linked = false }: { media?: Post['coverMedia']; linked?: boolean }) {
  const label = stockCreditLabel(media)
  if (!label) return null
  return <small className="image-credit">{linked && media?.attributionUrl ? <a href={media.attributionUrl} target="_blank" rel="noreferrer noopener">{label}</a> : label}</small>
}

export function ImageCredits({ credits }: { credits?: NonNullable<Post['imageCredits']> }) {
  const stockCredits = credits?.filter(media => stockCreditLabel(media)) ?? []
  if (!stockCredits.length) return null
  return <section className="image-credits" aria-label="Image credits"><h2>Image credits</h2><ul>{stockCredits.map(media => <li key={media.id}>{media.attributionUrl ? <a href={media.attributionUrl} target="_blank" rel="noreferrer noopener">{stockCreditLabel(media)}</a> : stockCreditLabel(media)}{media.license ? ` · ${media.license}` : ''}</li>)}</ul></section>
}

export function HeroImageStack({ posts }: { posts: Post[] }) {
  const key = posts.map(post => post.slug).join('|')
  return <div className="hero-image-stack" key={key}>{posts.map((post, index) => <ArticleImage key={post.id} post={post} big priority={index === 0} sizes="(max-width: 600px) calc(100vw - 56px), (max-width: 760px) calc(100vw - 72px), 430px" />)}</div>
}

export function ArticleMeta({ post, compact = false }: { post: Post; compact?: boolean }) {
  if (compact) return <div className="card-footer"><span className="footer-author">{post.authorName || 'Editorial Desk'}</span><span className="footer-date"><CalendarDays />{formatDate(post.publishedAt ?? post.createdAt)}</span><span className="footer-read"><Clock />{readingTime(post.wordCount)}</span>{post.sourceLabel && (post.sourceUrl ? <a className="footer-source" href={post.sourceUrl} target="_blank" rel="noreferrer noopener">Source: {post.sourceLabel}</a> : <span className="footer-source">{post.sourceLabel}</span>)}</div>
  return <p className="meta"><span>{post.authorName || 'Editorial Desk'}</span><span><CalendarDays />{formatDate(post.publishedAt ?? post.createdAt)}</span><span><Clock />{readingTime(post.wordCount)}</span>{post.sourceLabel && (post.sourceUrl ? <a href={post.sourceUrl} target="_blank" rel="noreferrer noopener">Source: {post.sourceLabel}</a> : <span>{post.sourceLabel}</span>)}</p>
}

export function AboutHighlights() {
  return <section className="about-highlights" aria-label="ThePaperLeaf editorial highlights">{[['Clear context', 'Every story is shaped around what changed, why it matters, and what to watch next.'], ['Visual reading', 'Strong imagery, topic sections, and concise summaries make the edition easy to scan.'], ['Editorial range', 'Coverage spans business, technology, culture, world affairs, science, and sport.'], ['Reader first', 'The experience is designed to stay fast, accessible, and calm across desktop and mobile.']].map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}</section>
}

export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="section-title"><span className="kicker">{eyebrow}</span><h2>{title}</h2></div> }

export function Newsletter() { return <section className="newsletter"><div><span className="kicker">Subscribe</span><h2>Insight Digest for the curious reader</h2><p>Get weekly analysis, media picks, and editorial highlights. This v1 form is visual only.</p></div><form onSubmit={event => event.preventDefault()}><input aria-label="Email address" placeholder="you@example.com" /><button><Send />Subscribe</button></form></section> }

export function Loading() { return <main className="state">Loading the newsroom…</main> }
export function ErrorView({ message }: { message: string }) { return <main className="state error">{message}</main> }
export function EmptyCopy() { return <div className="empty-copy">No published stories yet. The next edition is being prepared.</div> }

export function Seo({ title, description, image, canonical, type = 'website', noIndex = false }: { title: string; description: string; image?: string; canonical?: string; type?: 'website' | 'article'; noIndex?: boolean }) {
  React.useEffect(() => setSeo({ title, description, image, canonical, type, noIndex, siteName }), [title, description, image, canonical, type, noIndex])
  return null
}

export function JsonLd({ id, data }: { id: string; data: unknown }) { React.useEffect(() => setJsonLd(id, data), [id, data]); return null }

export function absoluteUrl(path: string) { return typeof window === 'undefined' ? path : new URL(path, window.location.origin).toString() }
export function publisherJsonLd() { return { '@type': 'Organization', name: siteName, url: absoluteUrl('/'), logo: { '@type': 'ImageObject', url: absoluteUrl('/favicon.svg') } } }
export function articleJsonLd(article: Post, url: string, image?: string) { return { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: article.title, description: article.seoDescription || article.excerpt, image: image ? [image] : undefined, datePublished: article.publishedAt || article.createdAt, dateModified: article.updatedAt, author: { '@type': 'Person', name: article.authorName || 'Editorial Desk' }, publisher: publisherJsonLd(), mainEntityOfPage: { '@type': 'WebPage', '@id': url }, articleSection: displayCategory(article), keywords: article.tags?.join(', ') } }
export function displayCategory(post: Post) { return post.categoryRef?.name || post.category || 'General' }
export function isAboutPage(slug: string) { return slug === 'about-thepaperleaf' || slug === 'about-this-cms' }

export function topicImage(slug: string, width = 480) {
  const image = ({ business: 'photo-1507679799987-c73779587ccf', technology: 'photo-1518770660439-4636190af475', culture: 'photo-1495020689067-958852a7765e', world: 'photo-1488646953014-85cb44e25828', science: 'photo-1532187863486-abf9dbad1b69', sport: 'photo-1461896836934-ffe607ba8211' } as Record<string, string>)[slug] ?? 'photo-1495020689067-958852a7765e'
  return `https://images.unsplash.com/${image}?auto=format&fit=crop&w=${width}&q=${width <= 320 ? 68 : 74}`
}
