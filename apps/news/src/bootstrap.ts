import type { Category, Envelope, Post } from './newsApi'

export type ReaderBootstrap = {
  path: string
  locale: 'zh-CN' | 'en'
  categories?: Category[]
  home?: { featured: Post[]; latest: Post[] }
  article?: { article: Post; related: Post[] }
  listing?: Envelope<Post[]>
  page?: Post
}

let cached: ReaderBootstrap | null | undefined

export function bootstrapForCurrentLocale() {
  if (cached === undefined) {
    const node = document.getElementById('reader-bootstrap')
    try { cached = node?.textContent ? JSON.parse(node.textContent) as ReaderBootstrap : null }
    catch { cached = null }
  }
  const locale = new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'zh-CN'
  return cached?.locale === locale && cached.path === `${window.location.pathname}${window.location.search}` ? cached : null
}
