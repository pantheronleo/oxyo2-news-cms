import React from 'react'
import { useParams } from 'react-router-dom'
import { fetchPosts, type Category, type Post } from '../newsApi'
import { resolveMediaUrl } from '../utils'
import { ArticleCard, EmptyCopy, ErrorView, Loading, SectionTitle, Seo, absoluteUrl, useAsync } from '../viewShared'
import { categoryDescription, categoryLabel, useLocale } from '../locale'

export default function CategoryPage({ categories }: { categories: Category[] }) {
  const { locale, t } = useLocale()
  const { category = '' } = useParams()
  const match = categories.find(item => item.slug === category)
  const readable = match ? categoryLabel(match, locale) : category.replaceAll('-', ' ')
  const query = match?.slug ?? category
  const { data, loading, error } = useAsync(() => fetchPosts({ category: query, limit: 18, lang: locale }), [query, locale])
  return <Listing title={readable} eyebrow={t('category')} posts={data?.data} loading={loading} error={error} description={match ? categoryDescription(match, locale) || t('categoryDescription', { category: readable }) : t('categoryDescription', { category: readable })} />
}

export function Listing({ title, eyebrow, posts, loading, error, description, noIndex = false }: { title: string; eyebrow: string; posts?: Post[]; loading: boolean; error?: string; description?: string; noIndex?: boolean }) {
  const { t } = useLocale()
  if (loading) return <Loading />
  if (error) return <ErrorView message={error} />
  return <main><Seo title={`${title} — ThePaperLeaf`} description={description || t('storiesDescription', { category: title })} image={resolveMediaUrl(posts?.[0]?.coverMedia?.url)} canonical={absoluteUrl(location.pathname + location.search)} noIndex={noIndex} /><SectionTitle eyebrow={eyebrow} title={title} /><div className="latest-grid">{posts?.length ? posts.map(post => <ArticleCard key={post.id} post={post} />) : <EmptyCopy />}</div></main>
}
