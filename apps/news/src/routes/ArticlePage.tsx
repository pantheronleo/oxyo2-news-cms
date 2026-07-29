import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchPostBySlug, fetchPosts } from '../newsApi'
import { resolveMediaUrl, stripHtml } from '../utils'
import { ArticleImage, ArticleMeta, ErrorView, ImageCredits, JsonLd, Loading, MiniCard, Seo, absoluteUrl, articleJsonLd, displayCategory, rewriteExternalImageSources, useAsync } from '../viewShared'

export default function ArticlePage() {
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
  return <main className="article-page"><Seo title={`${data.article.seoTitle || data.article.title} — ThePaperLeaf`} description={data.article.seoDescription || data.article.excerpt || stripHtml(data.article.html).slice(0, 160)} image={image} canonical={articleUrl} type="article" /><JsonLd id={`article-${data.article.slug}`} data={articleJsonLd(data.article, articleUrl, image)} /><article><div className="article-nav"><Link className="backlink" to="/">← Back to front page</Link><span className="kicker">{displayCategory(data.article)}</span>{data.article.availableLanguages?.includes('en') && <div className="language-switch" aria-label="Article language"><button className={language === 'zh-CN' ? 'active' : ''} onClick={() => setParams({})}>中文</button><button className={language === 'en' ? 'active' : ''} onClick={() => setParams({ lang: 'en' })}>English</button></div>}</div><h1>{data.article.title}</h1><p className="dek">{data.article.excerpt}</p><ArticleMeta post={data.article} /><ArticleImage post={data.article} big showCredit priority sizes="(max-width: 760px) calc(100vw - 24px), 820px" /><div className="article-body" dangerouslySetInnerHTML={{ __html: rewriteExternalImageSources(data.article.html) }} /><ImageCredits credits={data.article.imageCredits} /></article><aside className="related"><h3>Related stories</h3>{data.related.map(post => <MiniCard key={post.id} post={post} />)}</aside></main>
}
