import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchPosts } from '../newsApi'
import { useAsync } from '../viewShared'
import { Listing } from './CategoryPage'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const { data, loading, error } = useAsync(() => fetchPosts({ search: q, limit: 18 }), [q])
  return <Listing title={q ? `Search: ${q}` : 'Search the newsroom'} eyebrow="Results" posts={data?.data} loading={loading} error={error} noIndex={!q} description={q ? `Search results for ${q} on ThePaperLeaf.` : 'Search the ThePaperLeaf newsroom.'} />
}
