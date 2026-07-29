import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock, Search, Send, Sparkles } from 'lucide-react'
import { fetchCategories, fetchPageBySlug, fetchPostBySlug, fetchPosts, type Category, type Post } from './newsApi'
import { categorySlug, formatDate, readingTime, resolveMediaUrl, setJsonLd, setSeo, stripHtml } from './utils'
import './styles.css'

const siteName = 'ThePaperLeaf'
const siteDescription = 'Independent magazine-style news, analysis, and editorial explainers for curious readers.'
const unsplashHosts = new Set(['images.unsplash.com', 'plus.unsplash.com'])
const fallbackCategories: Category[] = ['Business', 'Technology', 'Culture', 'World', 'Science', 'Sport'].map((name, i) => ({
  id: name,
  name,
  slug: categorySlug(name),
  description: '',
  color: '#2521E1',
  sortOrder: i
}))

const aboutFallback: Post = {
  id: 'about-fallback',
  type: 'PAGE',
  status: 'PUBLISHED',
  title: 'About ThePaperLeaf',
  slug: 'about-thepaperleaf',
  excerpt: 'ThePaperLeaf is an independent magazine-style publication for clear, visual, and context-rich reporting.',
  category: 'Page',
  authorName: 'Editorial Desk',
  sourceLabel: 'ThePaperLeaf',
  isFeatured: false,
  markdown: '',
  html: `
    <p>ThePaperLeaf is an independent magazine-style publication built for readers who want clarity without losing depth. We cover business, technology, culture, world affairs, science, and sport through concise reporting, visual storytelling, and practical context.</p>
    <h2>What this publication is for</h2>
    <p>Our goal is to make fast-moving stories easier to understand. Each section is shaped around useful signals: what changed, why it matters, and what readers should watch next.</p>
    <h2>Editorial approach</h2>
    <ul><li>We prioritize context over noise and explain the forces behind each headline.</li><li>We use strong visuals, clear categories, and readable summaries to help readers move quickly.</li><li>We treat archives as living context, so stories remain useful after the first news cycle.</li><li>We separate reporting, analysis, and source labels so readers can understand what they are reading.</li></ul>
    <h2>Our promise</h2>
    <p>ThePaperLeaf is designed to feel calm, direct, and modern: a place for sharp daily reading, deeper weekend browsing, and discovery across topics that shape public life.</p>
  `,
  wordCount: 190,
  tags: ['about', 'thepaperleaf', 'news'],
  seoTitle: 'About ThePaperLeaf — Independent magazine news',
  seoDescription: 'Learn about ThePaperLeaf, an independent magazine-style publication for clear, visual, and context-rich reporting.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

function useAsync<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  React.useEffect(() => {
    let alive = true
    setState({ loading: true })
    load()
      .then(data => alive && setState({ data, loading: false }))
      .catch(error => alive && setState({ error: error instanceof Error ? error.message : 'Unable to load content', loading: false }))
    return () => {
      alive = false
    }
  }, deps)
  return state
}

function Layout() {
  const { data } = useAsync(fetchCategories, [])
  const categories = data?.data?.length ? data.data : fallbackCategories
  return (
    <>
      <header className="site-header">
        <Link to="/" className="logo" aria-label="ThePaperLeaf home">ThePaperLeaf<span>.</span></Link>
        <nav aria-label="Primary navigation">
          {categories.map(category => <Link key={category.id} to={`/category/${category.slug}`}>{category.name}</Link>)}
          <Link to="/page/about-thepaperleaf">About</Link>
        </nav>
        <form className="top-search" action="/search" role="search">
          <Search />
          <input name="q" aria-label="Search news" placeholder="Search" />
          <button>Go</button>
        </form>
      </header>
      <Routes>
        <Route path="/" element={<Home categories={categories} />} />
        <Route path="/article/:slug" element={<Article />} />
        <Route path="/category/:category" element={<CategoryPage categories={categories} />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/page/:slug" element={<StaticPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  )
}

function Home({ categories }: { categories: Category[] }) {
  const { data, loading, error } = useAsync(async () => {
    const [featured, latest] = await Promise.all([fetchPosts({ featured: true, limit: 6 }), fetchPosts({ limit: 12 })])
    return { featured: featured.data, latest: latest.data }
  }, [])
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const [carouselPaused, setCarouselPaused] = React.useState(false)
  const posts = data?.latest ?? []
  const featured = data?.featured.length ? data.featured : posts
  const hero = featured[0] ?? posts[0]
  const side = posts.filter(post => post.id !== hero?.id).slice(0, 4)
  const previewRail = side.length ? side : hero ? [hero] : []
  const railKey = previewRail.map(post => post.slug).join('|')

  React.useEffect(() => setPreviewIndex(0), [railKey])
  React.useEffect(() => {
    if (carouselPaused || previewRail.length < 2) return
    const id = window.setInterval(() => setPreviewIndex(i => (i + 1) % previewRail.length), 4200)
    return () => window.clearInterval(id)
  }, [carouselPaused, previewRail.length, railKey])

  if (loading) return <Loading />
  if (error) return <ErrorView message={error} />

  const preview = previewRail[previewIndex] ?? hero
  const stackPosts = (previewRail.length
    ? Array.from({ length: Math.min(3, previewRail.length) }, (_, i) => previewRail[(previewIndex + i) % previewRail.length])
    : hero ? [hero] : []
  ).filter((post): post is Post => Boolean(post))
  const grid = posts.filter(post => post.id !== hero?.id).slice(4, 10)
  const homeUrl = absoluteUrl('/')

  return (
    <main>
      <Seo
        title="ThePaperLeaf — Magazine News"
        description={preview?.excerpt || siteDescription}
        image={resolveMediaUrl(preview?.coverMedia?.url)}
        canonical={homeUrl}
        type="website"
      />
      <JsonLd id="thepaperleaf-website" data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: homeUrl, description: siteDescription, potentialAction: { '@type': 'SearchAction', target: `${homeUrl}search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }} />
      <section className="hero-shell">
        <div className="hero-copy">
          <span className="kicker">Today’s pick</span>
          <h1>{preview ? preview.title : 'Publish your first headline'}</h1>
          <p>{preview?.excerpt || 'Fresh stories from the newsroom will appear here as soon as they are published.'}</p>
          {preview && <ArticleMeta post={preview} />}
          {preview && <Link className="read-more" to={`/article/${preview.slug}`}>Read story <ArrowRight /></Link>}
        </div>
        <HeroImageStack posts={stackPosts} />
        <aside className="must-read" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onFocus={() => setCarouselPaused(true)} onBlur={() => setCarouselPaused(false)}>
          <span className="kicker">Must read</span>
          {side.map((post, i) => <MiniCard key={post.id} post={post} active={preview?.slug === post.slug} onPreview={() => setPreviewIndex(i)} />)}
          {side.length > 1 && (
            <div className="carousel-dots" aria-label="Must read carousel">
              {side.map((post, i) => <button key={post.id} type="button" className={i === previewIndex ? 'active' : ''} onClick={() => setPreviewIndex(i)} aria-label={`Preview ${post.title}`} />)}
            </div>
          )}
        </aside>
      </section>
      <SectionTitle eyebrow="Featured stories" title="Fresh perspective, curated daily" />
      <div className="feature-grid">{featured.slice(1, 4).map(post => <ArticleCard key={post.id} post={post} featured />)}{!featured.slice(1, 4).length && <EmptyCopy />}</div>
      <section className="topics">
        <div>
          <span className="kicker">Explore</span>
          <h2>See related topics</h2>
          <p>Follow your favorite beats through category pages curated by the ThePaperLeaf desk.</p>
        </div>
        {categories.slice(0, 6).map((category, i) => (
          <Link className={`topic t${i}`} style={{ '--topic': category.color, '--topic-image': `url(${topicImage(category.slug)})` } as React.CSSProperties} key={category.id} to={`/category/${category.slug}`}>{category.name}<ArrowRight /></Link>
        ))}
      </section>
      <SectionTitle eyebrow="Latest news" title="Stories just published" />
      <div className="latest-grid">{grid.length ? grid.map(post => <ArticleCard key={post.id} post={post} />) : posts.slice(0, 6).map(post => <ArticleCard key={post.id} post={post} />)}</div>
      <Newsletter />
    </main>
  )
}

function Article() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const language = params.get('lang') === 'en' ? 'en' : 'zh-CN'
  const { data, loading, error } = useAsync(async () => {
    const article = await fetchPostBySlug(slug, language)
    const related = await fetchPosts({ category: article.categoryRef?.slug || article.category, limit: 4 })
    return { article, related: related.data.filter(post => post.slug !== slug) }
  }, [slug, language])

  if (loading) return <Loading />
  if (error || !data) return <ErrorView message={error ?? 'Article not found'} />

  const articleUrl = absoluteUrl(`/article/${data.article.slug}${language === 'en' ? '?lang=en' : ''}`)
  const image = resolveMediaUrl(data.article.coverMedia?.url)

  return (
    <main className="article-page">
      <Seo
        title={`${data.article.seoTitle || data.article.title} — ThePaperLeaf`}
        description={data.article.seoDescription || data.article.excerpt || stripHtml(data.article.html).slice(0, 160)}
        image={image}
        canonical={articleUrl}
        type="article"
      />
      <JsonLd id={`article-${data.article.slug}`} data={articleJsonLd(data.article, articleUrl, image)} />
      <article>
        <div className="article-nav">
          <Link className="backlink" to="/">← Back to front page</Link>
          <span className="kicker">{displayCategory(data.article)}</span>
          {data.article.availableLanguages?.includes('en') && <div className="language-switch" aria-label="Article language"><button className={language === 'zh-CN' ? 'active' : ''} onClick={() => setParams({})}>中文</button><button className={language === 'en' ? 'active' : ''} onClick={() => setParams({ lang: 'en' })}>English</button></div>}
        </div>
        <h1>{data.article.title}</h1>
        <p className="dek">{data.article.excerpt}</p>
        <ArticleMeta post={data.article} />
        <ArticleImage post={data.article} big showCredit priority sizes="(max-width: 760px) 100vw, 820px" />
        <div className="article-body" dangerouslySetInnerHTML={{ __html: data.article.html }} />
        <ImageCredits credits={data.article.imageCredits} />
      </article>
      <aside className="related">
        <h3>Related stories</h3>
        {data.related.map(post => <MiniCard key={post.id} post={post} />)}
      </aside>
    </main>
  )
}

function CategoryPage({ categories }: { categories: Category[] }) {
  const { category = '' } = useParams()
  const match = categories.find(item => item.slug === category)
  const readable = match?.name ?? category.replaceAll('-', ' ')
  const query = match?.slug ?? category
  const { data, loading, error } = useAsync(() => fetchPosts({ category: query, limit: 18 }), [query])
  return <Listing title={readable} eyebrow="Category" posts={data?.data} loading={loading} error={error} description={match?.description || `Latest ${readable.toLowerCase()} coverage from ThePaperLeaf.`} />
}

function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const { data, loading, error } = useAsync(() => fetchPosts({ search: q, limit: 18 }), [q])
  return <Listing title={q ? `Search: ${q}` : 'Search the newsroom'} eyebrow="Results" posts={data?.data} loading={loading} error={error} noIndex={!q} description={q ? `Search results for ${q} on ThePaperLeaf.` : 'Search the ThePaperLeaf newsroom.'} />
}

function StaticPage() {
  const { slug = '' } = useParams()
  const { data, loading, error } = useAsync(async () => {
    if (slug === 'about-this-cms') return aboutFallback
    try {
      return await fetchPageBySlug(slug)
    } catch (err) {
      if (slug === 'about-thepaperleaf') return aboutFallback
      throw err
    }
  }, [slug])

  if (loading) return <Loading />
  if (error || !data) return <ErrorView message={error ?? 'Page not found'} />

  const pageUrl = absoluteUrl(`/page/${data.slug}`)
  const description = data.seoDescription || data.excerpt || stripHtml(data.html).slice(0, 160)

  return (
    <main className={`static-page ${isAboutPage(data.slug) ? 'about-page' : ''}`}>
      <Seo title={`${data.seoTitle || data.title} — ThePaperLeaf`} description={description} image={resolveMediaUrl(data.coverMedia?.url)} canonical={pageUrl} type="article" />
      <JsonLd id={`page-${data.slug}`} data={{ '@context': 'https://schema.org', '@type': 'AboutPage', name: data.title, url: pageUrl, description, publisher: publisherJsonLd() }} />
      <section className="static-hero">
        <span className="kicker">Page</span>
        <h1>{data.title}</h1>
        {data.excerpt && <p>{data.excerpt}</p>}
      </section>
      {isAboutPage(data.slug) && <AboutHighlights />}
      <div className="article-body" dangerouslySetInnerHTML={{ __html: data.html }} />
    </main>
  )
}

function Listing({ title, eyebrow, posts, loading, error, description, noIndex = false }: { title: string; eyebrow: string; posts?: Post[]; loading: boolean; error?: string; description?: string; noIndex?: boolean }) {
  if (loading) return <Loading />
  if (error) return <ErrorView message={error} />
  return (
    <main>
      <Seo title={`${title} — ThePaperLeaf`} description={description || `Latest ${title.toLowerCase()} stories from ThePaperLeaf.`} image={resolveMediaUrl(posts?.[0]?.coverMedia?.url)} canonical={absoluteUrl(location.pathname + location.search)} noIndex={noIndex} />
      <SectionTitle eyebrow={eyebrow} title={title} />
      <div className="latest-grid">{posts?.length ? posts.map(post => <ArticleCard key={post.id} post={post} />) : <EmptyCopy />}</div>
    </main>
  )
}

function ArticleCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  return (
    <Link className={`card ${featured ? 'featured-card' : ''}`} to={`/article/${post.slug}`} aria-label={`Read ${post.title}`}>
      <ArticleImage post={post} sizes={featured ? '(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw' : '(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 25vw'} />
      <span className="kicker">{displayCategory(post)}</span>
      <h3>{post.title}</h3>
      <p>{post.excerpt || stripHtml(post.html).slice(0, 120)}</p>
      <ArticleMeta post={post} compact />
    </Link>
  )
}

function MiniCard({ post, active = false, onPreview }: { post: Post; active?: boolean; onPreview?: () => void }) {
  return (
    <Link className={`mini-card ${active ? 'active' : ''}`} to={`/article/${post.slug}`} onMouseEnter={onPreview} onFocus={onPreview} aria-current={active ? 'true' : undefined}>
      <ArticleImage post={post} sizes="92px" />
      <span><small>{displayCategory(post)}</small><b>{post.title}</b></span>
    </Link>
  )
}

function ArticleImage({ post, big = false, showCredit = false, priority = false, sizes }: { post?: Post; big?: boolean; showCredit?: boolean; priority?: boolean; sizes?: string }) {
  const url = resolveMediaUrl(post?.coverMedia?.url)
  const width = post?.coverMedia?.width || (big ? 1280 : 700)
  const height = post?.coverMedia?.height || (big ? 820 : 460)
  const displayUrl = url ? imageVariant(url, big ? 1280 : 700) : ''
  return (
    <div className={`article-image ${big ? 'big' : ''}`} style={{ '--image-ratio': `${width} / ${height}` } as React.CSSProperties}>
      {displayUrl ? (
        <>
          <img
            src={displayUrl}
            srcSet={imageSrcSet(url)}
            sizes={sizes || (big ? '(max-width: 760px) 100vw, 430px' : '(max-width: 760px) 100vw, 300px')}
            width={width}
            height={height}
            alt={post?.coverMedia?.altText || post?.title || ''}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding={priority ? 'sync' : 'async'}
          />
          {showCredit && <ImageCredit media={post?.coverMedia} linked />}
        </>
      ) : <div className="placeholder" aria-label={post ? displayCategory(post) : 'ThePaperLeaf'}><Sparkles /></div>}
    </div>
  )
}

function isUnsplash(url: string) {
  try {
    return unsplashHosts.has(new URL(url).hostname)
  } catch {
    return false
  }
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

function ImageCredits({ credits }: { credits?: NonNullable<Post['imageCredits']> }) {
  const stockCredits = credits?.filter(media => stockCreditLabel(media)) ?? []
  if (!stockCredits.length) return null
  return <section className="image-credits" aria-label="Image credits"><h2>Image credits</h2><ul>{stockCredits.map(media => <li key={media.id}>{media.attributionUrl ? <a href={media.attributionUrl} target="_blank" rel="noreferrer noopener">{stockCreditLabel(media)}</a> : stockCreditLabel(media)}{media.license ? ` · ${media.license}` : ''}</li>)}</ul></section>
}

function HeroImageStack({ posts }: { posts: Post[] }) {
  const key = posts.map(post => post.slug).join('|')
  return <div className="hero-image-stack" key={key}>{posts.map((post, index) => <ArticleImage key={post.id} post={post} big priority={index === 0} sizes="(max-width: 760px) 90vw, 430px" />)}</div>
}

function ArticleMeta({ post, compact = false }: { post: Post; compact?: boolean }) {
  if (compact) {
    return (
      <div className="card-footer">
        <span className="footer-author">{post.authorName || 'Editorial Desk'}</span>
        <span className="footer-date"><CalendarDays />{formatDate(post.publishedAt ?? post.createdAt)}</span>
        <span className="footer-read"><Clock />{readingTime(post.wordCount)}</span>
        {post.sourceLabel && (post.sourceUrl ? <a className="footer-source" href={post.sourceUrl} target="_blank" rel="noreferrer noopener">Source: {post.sourceLabel}</a> : <span className="footer-source">{post.sourceLabel}</span>)}
      </div>
    )
  }
  return (
    <p className="meta">
      <span>{post.authorName || 'Editorial Desk'}</span>
      <span><CalendarDays />{formatDate(post.publishedAt ?? post.createdAt)}</span>
      <span><Clock />{readingTime(post.wordCount)}</span>
      {post.sourceLabel && (post.sourceUrl ? <a href={post.sourceUrl} target="_blank" rel="noreferrer noopener">Source: {post.sourceLabel}</a> : <span>{post.sourceLabel}</span>)}
    </p>
  )
}

function AboutHighlights() {
  return (
    <section className="about-highlights" aria-label="ThePaperLeaf editorial highlights">
      {[
        ['Clear context', 'Every story is shaped around what changed, why it matters, and what to watch next.'],
        ['Visual reading', 'Strong imagery, topic sections, and concise summaries make the edition easy to scan.'],
        ['Editorial range', 'Coverage spans business, technology, culture, world affairs, science, and sport.'],
        ['Reader first', 'The experience is designed to stay fast, accessible, and calm across desktop and mobile.']
      ].map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}
    </section>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-title"><span className="kicker">{eyebrow}</span><h2>{title}</h2></div>
}

function Newsletter() {
  return (
    <section className="newsletter">
      <div>
        <span className="kicker">Subscribe</span>
        <h2>Insight Digest for the curious reader</h2>
        <p>Get weekly analysis, media picks, and editorial highlights. This v1 form is visual only.</p>
      </div>
      <form onSubmit={event => event.preventDefault()}>
        <input aria-label="Email address" placeholder="you@example.com" />
        <button><Send />Subscribe</button>
      </form>
    </section>
  )
}

function Loading() {
  return <main className="state">Loading the newsroom…</main>
}

function ErrorView({ message }: { message: string }) {
  return <main className="state error">{message}</main>
}

function EmptyCopy() {
  return <div className="empty-copy">No published stories yet. The next edition is being prepared.</div>
}

function NotFound() {
  return (
    <main className="state error">
      <Seo title="Page not found — ThePaperLeaf" description="The requested ThePaperLeaf page could not be found." noIndex />
      This page is not in the edition.
    </main>
  )
}

function Footer() {
  return <footer><b>ThePaperLeaf<span>.</span></b><p>Independent magazine-style news for curious readers.</p></footer>
}

function Seo({ title, description, image, canonical, type = 'website', noIndex = false }: { title: string; description: string; image?: string; canonical?: string; type?: 'website' | 'article'; noIndex?: boolean }) {
  React.useEffect(() => setSeo({ title, description, image, canonical, type, noIndex, siteName }), [title, description, image, canonical, type, noIndex])
  return null
}

function JsonLd({ id, data }: { id: string; data: unknown }) {
  React.useEffect(() => setJsonLd(id, data), [id, data])
  return null
}

function absoluteUrl(path: string) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function publisherJsonLd() {
  return { '@type': 'Organization', name: siteName, url: absoluteUrl('/'), logo: { '@type': 'ImageObject', url: absoluteUrl('/favicon.svg') } }
}

function articleJsonLd(article: Post, url: string, image?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    image: image ? [image] : undefined,
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: article.authorName || 'Editorial Desk' },
    publisher: publisherJsonLd(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: displayCategory(article),
    keywords: article.tags?.join(', ')
  }
}

function topicImage(slug: string) {
  return ({
    business: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=480&q=74',
    technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=480&q=74',
    culture: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=480&q=74',
    world: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=480&q=74',
    science: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=480&q=74',
    sport: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=480&q=74'
  } as Record<string, string>)[slug] ?? 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=480&q=74'
}

function displayCategory(post: Post) {
  return post.categoryRef?.name || post.category || 'General'
}

function isAboutPage(slug: string) {
  return slug === 'about-thepaperleaf' || slug === 'about-this-cms'
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Layout /></BrowserRouter></React.StrictMode>)
