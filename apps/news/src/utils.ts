export const categorySlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const formatDate = (value: string, locale: 'zh-CN' | 'en' = 'zh-CN') => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
export const readingTime = (words: number, locale: 'zh-CN' | 'en' = 'zh-CN') => locale === 'zh-CN' ? `${Math.max(1, Math.ceil((words || 0) / 220))} 分钟阅读` : `${Math.max(1, Math.ceil((words || 0) / 220))} min read`
export const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

export function resolveMediaUrl(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return url.startsWith('/') ? url : `/${url}`
}

export function absoluteMediaUrl(url?: string | null) {
  const resolved = resolveMediaUrl(url)
  if (!resolved || typeof window === 'undefined' || resolved.startsWith('http')) return resolved
  return new URL(resolved, window.location.origin).toString()
}

export function upsertMeta(name: string, content: string, property = false) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${property ? 'property' : 'name'}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(property ? 'property' : 'name', name)
    document.head.appendChild(el)
  }
  el.content = content
}

export function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export function removeMeta(name: string, property = false) {
  document.head.querySelector<HTMLMetaElement>(`meta[${property ? 'property' : 'name'}="${name}"]`)?.remove()
}

export function setSeo({ title, description, image, canonical, type = 'website', noIndex = false, siteName = 'ThePaperLeaf', locale = 'zh-CN' }: { title: string; description: string; image?: string; canonical?: string; type?: 'website' | 'article'; noIndex?: boolean; siteName?: string; locale?: 'zh-CN' | 'en' }) {
  const cleanDescription = description.slice(0, 220)
  const url = canonical || (typeof window !== 'undefined' ? window.location.href : '')
  const absoluteImage = absoluteMediaUrl(image)

  document.title = title
  upsertMeta('description', cleanDescription)
  upsertMeta('robots', noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large')
  upsertMeta('theme-color', '#050505')
  upsertMeta('application-name', siteName)

  upsertMeta('og:site_name', siteName, true)
  upsertMeta('og:title', title, true)
  upsertMeta('og:description', cleanDescription, true)
  upsertMeta('og:type', type, true)
  upsertMeta('og:locale', locale === 'zh-CN' ? 'zh_CN' : 'en_US', true)
  if (url) upsertMeta('og:url', url, true)

  upsertMeta('twitter:card', absoluteImage ? 'summary_large_image' : 'summary')
  upsertMeta('twitter:title', title)
  upsertMeta('twitter:description', cleanDescription)

  if (canonical) upsertLink('canonical', canonical)
  if (absoluteImage) {
    upsertMeta('og:image', absoluteImage, true)
    upsertMeta('twitter:image', absoluteImage)
  } else {
    removeMeta('og:image', true)
    removeMeta('twitter:image')
  }
}

export function setJsonLd(id: string, data: unknown) {
  const elementId = `jsonld-${id}`
  let el = document.getElementById(elementId) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = elementId
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data, (_key, value) => value === undefined ? undefined : value)
}
