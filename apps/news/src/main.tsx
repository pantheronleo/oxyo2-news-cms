import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { fetchCategories, fetchPosts, type Category, type Post } from './newsApi'
import { categorySlug, resolveMediaUrl } from './utils'
import { ArticleCard, ArticleMeta, EmptyCopy, ErrorView, HeroImageStack, JsonLd, MiniCard, Newsletter, SectionTitle, Seo, absoluteUrl, siteDescription, siteName, topicImage, useAsync } from './viewShared'
import './styles.css'

const ArticlePage = React.lazy(() => import('./routes/ArticlePage'))
const CategoryPage = React.lazy(() => import('./routes/CategoryPage'))
const SearchPage = React.lazy(() => import('./routes/SearchPage'))
const StaticPage = React.lazy(() => import('./routes/StaticPage'))
const HomeSections = React.lazy(() => import('./HomeSections'))

const fallbackCategories: Category[] = ['Business', 'Technology', 'Culture', 'World', 'Science', 'Sport'].map((name, i) => ({
  id: name,
  name,
  slug: categorySlug(name),
  description: '',
  color: '#2521E1',
  sortOrder: i
}))

function Layout() {
  const { data } = useAsync(fetchCategories, [])
  const categories = data?.data?.length ? data.data : fallbackCategories
  return <><header className="site-header"><Link to="/" className="logo" aria-label="ThePaperLeaf home">ThePaperLeaf<span>.</span></Link><nav aria-label="Primary navigation">{categories.map(category => <Link key={category.id} to={`/category/${category.slug}`}>{category.name}</Link>)}<Link to="/page/about-thepaperleaf">About</Link></nav><form className="top-search" action="/search" role="search"><Search /><input name="q" aria-label="Search news" placeholder="Search" /><button>Go</button></form></header><Suspense fallback={<RouteSkeleton />}><Routes><Route path="/" element={<Home categories={categories} />} /><Route path="/article/:slug" element={<ArticlePage />} /><Route path="/category/:category" element={<CategoryPage categories={categories} />} /><Route path="/search" element={<SearchPage />} /><Route path="/page/:slug" element={<StaticPage />} /><Route path="*" element={<NotFound />} /></Routes></Suspense><Footer /></>
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

  if (loading) return <HomeSkeleton />
  if (error) return <ErrorView message={error} />

  const preview = previewRail[previewIndex] ?? hero
  const stackPosts = (previewRail.length ? Array.from({ length: Math.min(3, previewRail.length) }, (_, i) => previewRail[(previewIndex + i) % previewRail.length]) : hero ? [hero] : []).filter((post): post is Post => Boolean(post))
  const grid = posts.filter(post => post.id !== hero?.id).slice(4, 10)
  const homeUrl = absoluteUrl('/')
  return <main><Seo title="ThePaperLeaf — Magazine News" description={preview?.excerpt || siteDescription} image={resolveMediaUrl(preview?.coverMedia?.url)} canonical={homeUrl} type="website" /><JsonLd id="thepaperleaf-website" data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: homeUrl, description: siteDescription, potentialAction: { '@type': 'SearchAction', target: `${homeUrl}search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }} /><section className="hero-shell"><div className="hero-copy"><span className="kicker">Today’s pick</span><h1>{preview ? preview.title : 'Publish your first headline'}</h1><p>{preview?.excerpt || 'Fresh stories from the newsroom will appear here as soon as they are published.'}</p>{preview && <ArticleMeta post={preview} />}{preview && <Link className="read-more" to={`/article/${preview.slug}`}>Read story <ArrowRight /></Link>}</div><HeroImageStack posts={stackPosts} /><aside className="must-read" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onFocus={() => setCarouselPaused(true)} onBlur={() => setCarouselPaused(false)}><span className="kicker">Must read</span>{side.map((post, i) => <MiniCard key={post.id} post={post} active={preview?.slug === post.slug} onPreview={() => setPreviewIndex(i)} />)}{side.length > 1 && <div className="carousel-dots" aria-label="Must read carousel">{side.map((post, i) => <button key={post.id} type="button" className={i === previewIndex ? 'active' : ''} onClick={() => setPreviewIndex(i)} aria-label={`Preview ${post.title}`} />)}</div>}</aside></section><Suspense fallback={<HomeSectionsSkeleton />}><HomeSections categories={categories} featured={featured} grid={grid.length ? grid : posts.slice(0, 6)} /></Suspense></main>
}

function HomeSkeleton() {
  return <main aria-busy="true" aria-label="Loading latest ThePaperLeaf stories"><section className="hero-shell skeleton-home"><div className="hero-copy"><span className="skeleton-line short" /><span className="skeleton-line" /><span className="skeleton-line mid" /><span className="skeleton-pill" /></div><div className="hero-image-stack">{[0, 1, 2].map(index => <div key={index} className="article-image big skeleton-block" />)}</div><aside className="must-read"><span className="kicker">Must read</span>{[0, 1, 2, 3].map(index => <div key={index} className="mini-card skeleton-mini"><div className="article-image skeleton-block" /><span><i /><b /></span></div>)}</aside></section><HomeSectionsSkeleton /></main>
}

function HomeSectionsSkeleton() {
  return <section className="home-sections-skeleton" aria-hidden="true"><div className="section-title skeleton-title"><h2>Fresh perspective, curated daily</h2></div><div className="feature-grid skeleton-grid">{[0, 1, 2].map(index => <div key={index} className="card featured-card skeleton-card" />)}</div><div className="topics skeleton-topics"><div><span className="skeleton-line short" /><span className="skeleton-line" /><span className="skeleton-line mid" /></div>{[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="topic skeleton-card" />)}</div><div className="section-title skeleton-title"><h2>Stories just published</h2></div><div className="latest-grid skeleton-grid">{[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="card skeleton-card" />)}</div><div className="newsletter skeleton-card" /></section>
}

function RouteSkeleton() { return <main className="state" aria-busy="true">Loading the edition…</main> }
function NotFound() { return <main className="state error"><Seo title="Page not found — ThePaperLeaf" description="The requested ThePaperLeaf page could not be found." noIndex />This page is not in the edition.</main> }
function Footer() { return <footer><b>ThePaperLeaf<span>.</span></b><p>Independent magazine-style news for curious readers.</p></footer> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Layout /></BrowserRouter></React.StrictMode>)
