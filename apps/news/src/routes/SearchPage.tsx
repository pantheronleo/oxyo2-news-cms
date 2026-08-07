import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchPosts } from '../newsApi'
import { useAsync } from '../viewShared'
import { Listing } from './CategoryPage'
import { useLocale } from '../locale'

export default function SearchPage() {
  const [params] = useSearchParams()
  const { locale, link, t } = useLocale()
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error } = useAsync(() => fetchPosts({ search: q, limit: 18, page, lang: locale }), [q, locale, page])
  return <Listing title={q ? t('searchTitle', { query: q }) : t('searchPrompt')} eyebrow={t('results')} posts={data?.data} loading={loading} error={error} noIndex={!q} description={q ? t('searchDescription', { query: q }) : t('searchPrompt')} meta={q ? data?.meta : undefined} pageHref={target => link(target > 1 ? `/search?q=${encodeURIComponent(q)}&page=${target}` : `/search?q=${encodeURIComponent(q)}`)} />
}
