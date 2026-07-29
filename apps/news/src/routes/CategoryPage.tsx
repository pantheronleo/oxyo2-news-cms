import React from 'react'
import { useParams } from 'react-router-dom'
import { fetchPosts, type Category, type Post } from '../newsApi'
import { resolveMediaUrl } from '../utils'
import { ArticleCard, EmptyCopy, ErrorView, Loading, SectionTitle, Seo, absoluteUrl, useAsync } from '../viewShared'

export default function CategoryPage({ categories }: { categories: Category[] }) {
  const { category = '' } = useParams()
  const match = categories.find(item => item.slug === category)
  const readable = match?.name ?? category.replaceAll('-', ' ')
  const query = match?.slug ?? category
  const { data, loading, error } = useAsync(() => fetchPosts({ category: query, limit: 18 }), [query])
  return <Listing title={readable} eyebrow="Category" posts={data?.data} loading={loading} error={error} description={match?.description || `Latest ${readable.toLowerCase()} coverage from ThePaperLeaf.`} />
}

export function Listing({ title, eyebrow, posts, loading, error, description, noIndex = false }: { title: string; eyebrow: string; posts?: Post[]; loading: boolean; error?: string; description?: string; noIndex?: boolean }) {
  if (loading) return <Loading />
  if (error) return <ErrorView message={error} />
  return <main><Seo title={`${title} — ThePaperLeaf`} description={description || `Latest ${title.toLowerCase()} stories from ThePaperLeaf.`} image={resolveMediaUrl(posts?.[0]?.coverMedia?.url)} canonical={absoluteUrl(location.pathname + location.search)} noIndex={noIndex} /><SectionTitle eyebrow={eyebrow} title={title} /><div className="latest-grid">{posts?.length ? posts.map(post => <ArticleCard key={post.id} post={post} />) : <EmptyCopy />}</div></main>
}
