import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchPosts } from '../newsApi'
import { useAsync } from '../viewShared'
import { Listing } from './CategoryPage'
import { useLocale } from '../locale'

export default function SearchPage() {
  const [params] = useSearchParams()
  const { locale, t } = useLocale()
  const q = params.get('q') ?? ''
  const { data, loading, error } = useAsync(() => fetchPosts({ search: q, limit: 18, lang: locale }), [q, locale])
  return <Listing title={q ? t('searchTitle', { query: q }) : t('searchPrompt')} eyebrow={t('results')} posts={data?.data} loading={loading} error={error} noIndex={!q} description={q ? t('searchDescription', { query: q }) : t('searchPrompt')} />
}
