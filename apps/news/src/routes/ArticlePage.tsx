import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPostBySlug, fetchPosts } from '../newsApi'
import { resolveMediaUrl, stripHtml } from '../utils'
import { ArticleImage, ArticleMeta, ErrorView, ImageCredits, JsonLd, Loading, MiniCard, Seo, absoluteUrl, articleJsonLd, displayCategory, rewriteExternalImageSources, useAsync } from '../viewShared'
import { useLocale } from '../locale'

export default function ArticlePage() {
  const { slug = '' } = useParams()
  const { locale, link, t } = useLocale()
  const { data, loading, error } = useAsync(async () => {
    const article = await fetchPostBySlug(slug, locale)
    const related = await fetchPosts({ category: article.categoryRef?.slug || article.category, limit: 4, lang: locale })
    return { article, related: related.data.filter(post => post.slug !== slug) }
  }, [slug, locale])
  if (loading) return <Loading />
  if (error || !data) return <ErrorView message={error ?? 'Article not found'} />
  const articleUrl = absoluteUrl(link(`/article/${data.article.slug}`))
  const image = resolveMediaUrl(data.article.coverMedia?.url)
  return <main className="article-page"><Seo title={`${data.article.seoTitle || data.article.title} — ThePaperLeaf`} description={data.article.seoDescription || data.article.excerpt || stripHtml(data.article.html).slice(0, 160)} image={image} canonical={articleUrl} type="article" /><JsonLd id={`article-${data.article.slug}`} data={articleJsonLd(data.article, articleUrl, image, locale)} /><article><div className="article-nav"><Link className="backlink" to={link('/')}>{t('back')}</Link><span className="kicker">{displayCategory(data.article, locale)}</span></div>{locale === 'en' && data.article.language !== 'en' && <p className="translation-notice">{t('originalChinese')}</p>}<h1>{data.article.title}</h1><p className="dek">{data.article.excerpt}</p><ArticleMeta post={data.article} /><ArticleImage post={data.article} big showCredit priority sizes="(max-width: 760px) calc(100vw - 24px), 820px" /><div className="article-body" dangerouslySetInnerHTML={{ __html: rewriteExternalImageSources(data.article.html) }} /><ImageCredits credits={data.article.imageCredits} /></article><aside className="related"><h3>{t('relatedStories')}</h3>{data.related.map(post => <MiniCard key={post.id} post={post} />)}</aside></main>
}
