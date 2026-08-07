import type { FastifyInstance, FastifyReply } from 'fastify'
import { readFileSync } from 'node:fs'
import { ContentType, prisma } from '@cms/database'
import { config } from '../config.js'
import { localizeContent, publicContentWhere } from './content.js'

type Locale = 'zh-CN' | 'en'
const siteName = 'ThePaperLeaf'
const listTranslationSelect = { language: true, title: true, excerpt: true, seoTitle: true, seoDescription: true }
const listSelect = { id: true, title: true, slug: true, excerpt: true, category: true, categoryRef: { select: { id: true, name: true, nameZh: true, slug: true } }, authorName: true, sourceLabel: true, sourceUrl: true, wordCount: true, seoTitle: true, seoDescription: true, publishedAt: true, createdAt: true, updatedAt: true, tags: true, coverMedia: { select: { url: true, altText: true, width: true, height: true } }, translations: { select: listTranslationSelect } }
const articleSelect = { ...listSelect, status: true, html: true, translations: { select: { ...listTranslationSelect, html: true, wordCount: true } } }
const categorySelect = { id: true, name: true, nameZh: true, slug: true, description: true, descriptionZh: true }
const defaultChineseCategories: Record<string, string> = { business: '商业', technology: '科技', culture: '文化', world: '国际', science: '科学', sport: '体育', sports: '体育', general: '综合', lifestyle: '生活', entertainment: '娱乐', food: '美食', travel: '旅游', finance: '财经', politics: '政治', health: '健康' }
const imageProxyHosts: Record<string, string> = { 'images.unsplash.com': 'unsplash', 'plus.unsplash.com': 'unsplash', 'images.pexels.com': 'pexels', 'cdn.pixabay.com': 'pixabay' }

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
const absolute = (path: string) => new URL(path, config.PUBLIC_BASE_URL).toString()
const withLang = (path: string, locale: Locale) => locale === 'en' ? `${path}${path.includes('?') ? '&' : '?'}lang=en` : path
const categoryLabel = (category: { name: string; nameZh?: string | null; slug?: string }, locale: Locale) => locale !== 'zh-CN' ? category.name : category.nameZh?.trim() || defaultChineseCategories[(category.slug || category.name).trim().toLowerCase().replace(/\s+/g, '-')] || category.name
const formatDate = (value: Date | string, locale: Locale) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: config.NEWS_BOT_TIMEZONE }).format(new Date(value))

export function proxyExternalImageUrl(url: string) {
  try {
    const source = new URL(url)
    const provider = imageProxyHosts[source.hostname]
    return provider ? `/images/${provider}/${source.pathname.replace(/^\//, '')}${source.search}` : url
  } catch { return url }
}
export const rewriteExternalImageSources = (html: string) => html.replace(/(src\s*=\s*["'])(https?:\/\/(?:images|plus)\.unsplash\.com|https?:\/\/images\.pexels\.com|https?:\/\/cdn\.pixabay\.com)([^"']*)/gi, (_match, prefix, origin, path) => `${prefix}${proxyExternalImageUrl(`${origin}${path}`)}`)
const mediaUrl = (url?: string | null) => !url ? '' : url.startsWith('http') ? proxyExternalImageUrl(url) : url.startsWith('/') ? url : `/${url}`

const fallbackTemplate = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width,initial-scale=1.0" />\n</head>\n<body><div id="root"></div></body>\n</html>'
let cachedTemplate: { head: string; tail: string } | null = null
function template() {
  if (cachedTemplate) return cachedTemplate
  let html = fallbackTemplate
  try { html = readFileSync(new URL('../../../news/dist/index.html', import.meta.url), 'utf8') } catch { /* built news app missing; fall back to a minimal shell */ }
  html = html.replace(/[ \t]*<title>[\s\S]*?<\/title>\n?/, '').replace(/[ \t]*<meta (?:name="(?:description|robots|twitter:[^"]*)"|property="og:[^"]*")[^>]*\/?>\n?/g, '')
  const marker = '<div id="root"></div>'
  const split = html.indexOf(marker)
  cachedTemplate = split === -1
    ? { head: `${html}<div id="root">`, tail: '</div>' }
    : { head: `${html.slice(0, split)}<div id="root">`, tail: `</div>${html.slice(split + marker.length)}` }
  return cachedTemplate
}

type HeadInput = { title: string; description: string; canonical: string; image?: string; type?: 'website' | 'article'; locale: Locale; noIndex?: boolean; alternatePath?: string; hasEnglish?: boolean; jsonLd?: unknown[]; article?: { publishedAt: Date | string; modifiedAt: Date | string; section?: string } }
function headBlock(input: HeadInput) {
  const description = escapeHtml(input.description.slice(0, 220))
  const image = input.image ? absolute(input.image) : ''
  const lines = [
    `<title>${escapeHtml(input.title)}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${input.noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}" />`,
    `<link rel="canonical" href="${escapeHtml(input.canonical)}" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    `<meta property="og:title" content="${escapeHtml(input.title)}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${input.type || 'website'}" />`,
    `<meta property="og:locale" content="${input.locale === 'zh-CN' ? 'zh_CN' : 'en_US'}" />`,
    `<meta property="og:url" content="${escapeHtml(input.canonical)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(input.title)}" />`,
    `<meta name="twitter:description" content="${description}" />`
  ]
  if (image) lines.push(`<meta property="og:image" content="${escapeHtml(image)}" />`, `<meta name="twitter:image" content="${escapeHtml(image)}" />`)
  if (input.article) {
    lines.push(`<meta property="article:published_time" content="${new Date(input.article.publishedAt).toISOString()}" />`, `<meta property="article:modified_time" content="${new Date(input.article.modifiedAt).toISOString()}" />`)
    if (input.article.section) lines.push(`<meta property="article:section" content="${escapeHtml(input.article.section)}" />`)
  }
  if (input.alternatePath && input.hasEnglish !== false) lines.push(
    `<link rel="alternate" hreflang="zh-CN" href="${escapeHtml(absolute(input.alternatePath))}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(absolute(withLang(input.alternatePath, 'en')))}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(absolute(input.alternatePath))}" />`
  )
  for (const data of input.jsonLd || []) lines.push(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`)
  return lines.join('\n    ')
}

const publisherJsonLd = () => ({ '@type': 'NewsMediaOrganization', name: siteName, url: absolute('/'), logo: { '@type': 'ImageObject', url: absolute('/favicon.svg'), width: 48, height: 48 } })

function siteHeader(categories: Array<{ name: string; nameZh?: string | null; slug: string }>, locale: Locale) {
  const nav = categories.map(category => `<a href="${escapeHtml(withLang(`/category/${category.slug}`, locale))}">${escapeHtml(categoryLabel(category, locale))}</a>`).join('')
  return `<header class="site-header"><a class="logo" href="${withLang('/', locale)}">${siteName}<span>.</span></a><nav aria-label="Primary navigation">${nav}<a href="${escapeHtml(withLang('/page/about-thepaperleaf', locale))}">${locale === 'zh-CN' ? '关于我们' : 'About'}</a></nav></header>`
}
const siteFooter = (locale: Locale) => `<footer><b>${siteName}<span>.</span></b><p>${locale === 'zh-CN' ? '为好奇读者而设的独立杂志式新闻。' : 'Independent magazine-style news for curious readers.'}</p></footer>`

function postMeta(post: any, locale: Locale) {
  const date = post.publishedAt || post.createdAt
  const source = post.sourceLabel ? (post.sourceUrl ? `<a href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="noreferrer noopener">${locale === 'zh-CN' ? '来源：' : 'Source: '}${escapeHtml(post.sourceLabel)}</a>` : `<span>${escapeHtml(post.sourceLabel)}</span>`) : ''
  return `<p class="meta"><span>${escapeHtml(post.authorName || (locale === 'zh-CN' ? '编辑部' : 'Editorial Desk'))}</span><time datetime="${new Date(date).toISOString()}">${formatDate(date, locale)}</time>${source}</p>`
}

function postListItem(post: any, locale: Locale) {
  const image = mediaUrl(post.coverMedia?.url)
  return `<article class="card"><a href="${escapeHtml(withLang(`/article/${post.slug}`, locale))}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(post.coverMedia?.altText || post.title)}" loading="lazy" width="${post.coverMedia?.width || 700}" height="${post.coverMedia?.height || 460}" />` : ''}<span class="kicker">${escapeHtml(post.categoryRef ? categoryLabel(post.categoryRef, locale) : post.category || 'General')}</span><h3>${escapeHtml(post.title)}</h3></a><p>${escapeHtml(post.excerpt || '')}</p>${postMeta(post, locale)}</article>`
}

function articleJsonLd(post: any, url: string, locale: Locale) {
  const image = post.coverMedia?.url ? { '@type': 'ImageObject', url: absolute(mediaUrl(post.coverMedia.url)), width: post.coverMedia.width || undefined, height: post.coverMedia.height || undefined } : undefined
  return { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: String(post.title).slice(0, 110), description: post.seoDescription || post.excerpt, image: image ? [image] : undefined, datePublished: post.publishedAt || post.createdAt, dateModified: post.updatedAt, inLanguage: locale, wordCount: post.wordCount || undefined, author: { '@type': 'Person', name: post.authorName || (locale === 'zh-CN' ? '编辑部' : 'Editorial Desk') }, publisher: publisherJsonLd(), mainEntityOfPage: { '@type': 'WebPage', '@id': url }, articleSection: post.categoryRef ? categoryLabel(post.categoryRef, locale) : post.category, keywords: post.tags?.length ? post.tags.join(', ') : undefined }
}

function sendPage(reply: FastifyReply, locale: Locale, head: string, body: string, status = 200) {
  const shell = template()
  const html = `${shell.head.replace(/(<html[^>]*\blang=")[^"]*(")/, `$1${locale}$2`).replace('</head>', `    ${head}\n  </head>`)}${body}${shell.tail}`
  return reply.code(status).type('text/html; charset=utf-8').header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').send(html)
}

async function activeCategories() {
  return prisma.category.findMany({ where: { isActive: true }, select: categorySelect, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
}
const localeFrom = (query: Record<string, string>): Locale => query.lang === 'en' ? 'en' : 'zh-CN'

async function publishedPosts(q: Record<string, string>, locale: Locale, limit: number, select: object = listSelect) {
  const items = await prisma.content.findMany({ where: publicContentWhere(ContentType.POST, q, new Date()) as any, select: select as any, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }] as any, take: limit })
  return items.map(item => localizeContent(item, locale === 'en' ? 'en' : undefined))
}

export async function prerenderRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const locale = localeFrom(req.query as Record<string, string>)
    const [categories, posts] = await Promise.all([activeCategories(), publishedPosts({}, locale, 13)])
    const hero = posts[0]
    const rest = posts.slice(1)
    const canonical = absolute(withLang('/', locale))
    const description = hero?.excerpt || (locale === 'zh-CN' ? '为好奇读者而设的独立杂志式新闻、分析与深度解读。' : 'Independent magazine-style news, analysis, and editorial explainers for curious readers.')
    const head = headBlock({ title: `${siteName} — ${locale === 'zh-CN' ? '新闻杂志' : 'Magazine News'}`, description, canonical, image: hero ? mediaUrl(hero.coverMedia?.url) : undefined, locale, alternatePath: '/', jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: absolute('/'), description, inLanguage: locale, publisher: publisherJsonLd(), potentialAction: { '@type': 'SearchAction', target: `${absolute('/search')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }] })
    const heroHtml = hero ? `<section class="hero-shell"><div class="hero-copy"><span class="kicker">${locale === 'zh-CN' ? '今日精选' : 'Today’s pick'}</span><h1><a href="${escapeHtml(withLang(`/article/${hero.slug}`, locale))}">${escapeHtml(hero.title)}</a></h1><p>${escapeHtml(hero.excerpt || '')}</p>${postMeta(hero, locale)}</div></section>` : `<section class="hero-shell"><h1>${siteName}</h1></section>`
    const body = `${siteHeader(categories, locale)}<main>${heroHtml}<section><h2>${locale === 'zh-CN' ? '最新发布' : 'Latest news'}</h2><div class="latest-grid">${rest.map(post => postListItem(post, locale)).join('')}</div></section></main>${siteFooter(locale)}`
    return sendPage(reply, locale, head, body)
  })

  app.get('/article/:slug', async (req, reply) => {
    const locale = localeFrom(req.query as Record<string, string>)
    const slug = String((req.params as any).slug || '')
    const [categories, item] = await Promise.all([activeCategories(), prisma.content.findUnique({ where: { type_slug: { type: ContentType.POST, slug } }, select: articleSelect as any })])
    if (!item || (item as any).status !== 'PUBLISHED' || !(item as any).publishedAt || (item as any).publishedAt > new Date()) return notFound(reply, categories, locale)
    const post = localizeContent(item, locale === 'en' ? 'en' : undefined)
    const path = `/article/${post.slug}`
    const canonical = absolute(withLang(path, locale))
    const image = mediaUrl(post.coverMedia?.url)
    const head = headBlock({ title: `${post.seoTitle || post.title} — ${siteName}`, description: post.seoDescription || post.excerpt || '', canonical, image: image || undefined, type: 'article', locale, alternatePath: path, hasEnglish: post.availableLanguages?.includes('en'), jsonLd: [articleJsonLd(post, canonical, locale)], article: { publishedAt: post.publishedAt || post.createdAt, modifiedAt: post.updatedAt, section: post.categoryRef ? categoryLabel(post.categoryRef, locale) : post.category } })
    const cover = image ? `<figure class="article-image big"><img src="${escapeHtml(image)}" alt="${escapeHtml(post.coverMedia?.altText || post.title)}" width="${post.coverMedia?.width || 1280}" height="${post.coverMedia?.height || 820}" fetchpriority="high" /></figure>` : ''
    const notice = locale === 'en' && post.language !== 'en' ? `<p class="translation-notice">This article is currently available in its original Chinese version.</p>` : ''
    const body = `${siteHeader(categories, locale)}<main class="article-page"><article><div class="article-nav"><a class="backlink" href="${withLang('/', locale)}">${locale === 'zh-CN' ? '← 返回首页' : '← Back to front page'}</a><span class="kicker">${escapeHtml(post.categoryRef ? categoryLabel(post.categoryRef, locale) : post.category || 'General')}</span></div>${notice}<h1>${escapeHtml(post.title)}</h1><p class="dek">${escapeHtml(post.excerpt || '')}</p>${postMeta(post, locale)}${cover}<div class="article-body">${rewriteExternalImageSources(post.html || '')}</div></article></main>${siteFooter(locale)}`
    return sendPage(reply, locale, head, body)
  })

  app.get('/category/:category', async (req, reply) => {
    const locale = localeFrom(req.query as Record<string, string>)
    const slug = String((req.params as any).category || '')
    const categories = await activeCategories()
    const category = categories.find(entry => entry.slug === slug || entry.name.toLowerCase() === slug.toLowerCase())
    if (!category) return notFound(reply, categories, locale)
    const posts = await publishedPosts({ category: category.slug }, locale, 24)
    const label = categoryLabel(category, locale)
    const path = `/category/${category.slug}`
    const description = (locale === 'zh-CN' && category.descriptionZh?.trim() ? category.descriptionZh : category.description) || (locale === 'zh-CN' ? `ThePaperLeaf 最新${label}报道。` : `Latest ${label} coverage from ${siteName}.`)
    const head = headBlock({ title: `${label} — ${siteName}`, description, canonical: absolute(withLang(path, locale)), locale, alternatePath: path, jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: label, url: absolute(path), description, inLanguage: locale, publisher: publisherJsonLd() }] })
    const body = `${siteHeader(categories, locale)}<main><section><h1>${escapeHtml(label)}</h1><p>${escapeHtml(description)}</p><div class="latest-grid">${posts.map(post => postListItem(post, locale)).join('')}</div></section></main>${siteFooter(locale)}`
    return sendPage(reply, locale, head, body)
  })

  app.get('/page/:slug', async (req, reply) => {
    const locale = localeFrom(req.query as Record<string, string>)
    const slug = String((req.params as any).slug || '')
    const [categories, item] = await Promise.all([activeCategories(), prisma.content.findUnique({ where: { type_slug: { type: ContentType.PAGE, slug } }, select: articleSelect as any })])
    if (!item && (slug === 'about-thepaperleaf' || slug === 'about-this-cms')) {
      // The news app renders the About page from built-in copy when no CMS page exists.
      const about = locale === 'zh-CN'
        ? { title: '关于 ThePaperLeaf', excerpt: 'ThePaperLeaf 是一份独立的杂志式新闻刊物，提供清晰、视觉化且富有背景脉络的报道。', html: '<p>ThePaperLeaf 是一份独立的杂志式新闻刊物，为希望兼顾清晰与深度的读者而设。我们以简洁报道、视觉叙事与实用脉络，关注商业、科技、文化、国际事务、科学与体育。</p><h2>我们为何而做</h2><p>我们的目标是让快速变化的新闻更容易理解。每个版面都会梳理重要变化、影响所在，以及读者下一步值得留意的重点。</p><h2>编辑方式</h2><ul><li>我们重视脉络而非噪音，解释每个标题背后的推动力量。</li><li>我们运用清晰分类、强烈视觉与易读摘要，让读者快速掌握内容。</li><li>我们将报道、分析与来源标示清楚区分，帮助读者判断所读资讯。</li></ul><h2>我们的承诺</h2><p>ThePaperLeaf 希望成为一个沉静、直接且现代的阅读空间：适合每日快速浏览，也适合周末深入探索影响公共生活的议题。</p>' }
        : { title: 'About ThePaperLeaf', excerpt: 'ThePaperLeaf is an independent magazine-style publication for clear, visual, and context-rich reporting.', html: '<p>ThePaperLeaf is an independent magazine-style publication built for readers who want clarity without losing depth. We cover business, technology, culture, world affairs, science, and sport through concise reporting, visual storytelling, and practical context.</p><h2>What this publication is for</h2><p>Our goal is to make fast-moving stories easier to understand. Each section is shaped around useful signals: what changed, why it matters, and what readers should watch next.</p><h2>Editorial approach</h2><ul><li>We prioritize context over noise and explain the forces behind each headline.</li><li>We use strong visuals, clear categories, and readable summaries to help readers move quickly.</li><li>We separate reporting, analysis, and source labels so readers can understand what they are reading.</li></ul><h2>Our promise</h2><p>ThePaperLeaf is designed to feel calm, direct, and modern: a place for sharp daily reading, deeper weekend browsing, and discovery across topics that shape public life.</p>' }
      const path = `/page/${slug}`
      const head = headBlock({ title: `${about.title} — ${siteName}`, description: about.excerpt, canonical: absolute(withLang(path, locale)), locale, alternatePath: path })
      return sendPage(reply, locale, head, `${siteHeader(categories, locale)}<main class="article-page"><article><h1>${escapeHtml(about.title)}</h1><div class="article-body">${about.html}</div></article></main>${siteFooter(locale)}`)
    }
    if (!item || (item as any).status !== 'PUBLISHED' || !(item as any).publishedAt || (item as any).publishedAt > new Date()) return notFound(reply, categories, locale)
    const page = localizeContent(item, locale === 'en' ? 'en' : undefined)
    const path = `/page/${page.slug}`
    const head = headBlock({ title: `${page.seoTitle || page.title} — ${siteName}`, description: page.seoDescription || page.excerpt || '', canonical: absolute(withLang(path, locale)), locale, alternatePath: path, hasEnglish: page.availableLanguages?.includes('en') })
    const body = `${siteHeader(categories, locale)}<main class="article-page"><article><h1>${escapeHtml(page.title)}</h1><div class="article-body">${rewriteExternalImageSources(page.html || '')}</div></article></main>${siteFooter(locale)}`
    return sendPage(reply, locale, head, body)
  })

  app.get('/search', async (req, reply) => {
    const locale = localeFrom(req.query as Record<string, string>)
    const query = String((req.query as any).q || '').trim().slice(0, 120)
    const categories = await activeCategories()
    const posts = query ? await publishedPosts({ search: query }, locale, 20) : []
    const title = query ? (locale === 'zh-CN' ? `搜索：${query} — ${siteName}` : `Search: ${query} — ${siteName}`) : (locale === 'zh-CN' ? `搜索 — ${siteName}` : `Search — ${siteName}`)
    const head = headBlock({ title, description: locale === 'zh-CN' ? `ThePaperLeaf 上“${query}”的搜索结果。` : `Search results for ${query} on ${siteName}.`, canonical: absolute(withLang('/search', locale)), locale, noIndex: true })
    const body = `${siteHeader(categories, locale)}<main><section><h1>${escapeHtml(title)}</h1><div class="latest-grid">${posts.map(post => postListItem(post, locale)).join('')}</div></section></main>${siteFooter(locale)}`
    return sendPage(reply, locale, head, body)
  })
}

function notFound(reply: FastifyReply, categories: Array<{ name: string; nameZh?: string | null; slug: string }>, locale: Locale) {
  const head = headBlock({ title: locale === 'zh-CN' ? `找不到页面 — ${siteName}` : `Page not found — ${siteName}`, description: locale === 'zh-CN' ? '找不到您请求的 ThePaperLeaf 页面。' : `The requested ${siteName} page could not be found.`, canonical: absolute('/'), locale, noIndex: true })
  return sendPage(reply, locale, head, `${siteHeader(categories, locale)}<main class="state error">${locale === 'zh-CN' ? '该页面不在本期内容中。' : 'This page is not in the edition.'}</main>${siteFooter(locale)}`, 404)
}
