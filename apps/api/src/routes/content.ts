import type { FastifyInstance } from 'fastify'
import { prisma, ContentLanguage, ContentStatus, ContentType } from '@cms/database'
import { requireAdmin } from '../auth.js'
import { normalizeStatus, renderMarkdown, slugify, wordCount } from '../lib/content.js'

const types = { posts: ContentType.POST, pages: ContentType.PAGE }
const translationSelect = { id: true, language: true, title: true, excerpt: true, markdown: true, html: true, wordCount: true, seoTitle: true, seoDescription: true, createdAt: true, updatedAt: true }
const select = { id: true, type: true, status: true, title: true, slug: true, excerpt: true, category: true, categoryId: true, categoryRef: { select: { id: true, name: true, slug: true, color: true } }, authorName: true, sourceLabel: true, sourceUrl: true, isFeatured: true, markdown: true, html: true, wordCount: true, coverMediaId: true, tags: true, seoTitle: true, seoDescription: true, publishedAt: true, scheduledAt: true, createdAt: true, updatedAt: true, visualNeedsReview: true, translations: { select: translationSelect }, coverMedia: { select: { id: true, url: true, altText: true, width: true, height: true } } }

export function contentSearchFilters(q: Record<string,string>) {
  const and:any[]=[]
  if(q.category)and.push({OR:[{category:{equals:q.category,mode:'insensitive'}},{categoryRef:{is:{slug:q.category}}},{categoryRef:{is:{name:{equals:q.category,mode:'insensitive'}}}}]})
  if(q.search)and.push({OR:[{title:{contains:q.search,mode:'insensitive'}},{slug:{contains:q.search,mode:'insensitive'}},{excerpt:{contains:q.search,mode:'insensitive'}},{category:{contains:q.search,mode:'insensitive'}}]})
  return { ...(q.categoryId ? { categoryId: q.categoryId } : {}), ...(q.featured ? { isFeatured: q.featured === 'true' } : {}), ...(and.length ? { AND: and } : {}) }
}

export function publicContentWhere(type: ContentType, q: Record<string,string>, now: Date) {
  return { type, status: 'PUBLISHED', publishedAt: { lte: now }, ...(q.tag ? { tags: { has: q.tag } } : {}), ...contentSearchFilters(q) }
}

function dataFrom(body: any) {
  const markdown = String(body.markdown ?? '')
  const status = normalizeStatus(String(body.status ?? 'DRAFT'), body.scheduledAt) as ContentStatus
  const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : null
  if (sourceUrl) new URL(sourceUrl)
  return { type: body.type as ContentType, status, title: String(body.title ?? '').trim(), slug: slugify(body.slug || body.title || ''), excerpt: String(body.excerpt ?? ''), category: String(body.category ?? 'General').trim() || 'General', categoryId: body.categoryId || null, authorName: String(body.authorName ?? 'Editorial Desk').trim() || 'Editorial Desk', sourceLabel: body.sourceLabel ? String(body.sourceLabel).trim() : null, sourceUrl, isFeatured: Boolean(body.isFeatured), markdown, html: renderMarkdown(markdown), wordCount: wordCount(markdown), tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean).slice(0, 20) : [], seoTitle: body.seoTitle || null, seoDescription: body.seoDescription || null, coverMediaId: body.coverMediaId || null, scheduledAt: status === 'SCHEDULED' ? new Date(body.scheduledAt) : null, publishedAt: status === 'PUBLISHED' ? (body.publishedAt ? new Date(body.publishedAt) : new Date()) : null }
}

export function localizeContent(item: any, language: string | undefined) {
  const english = item.translations?.find((translation: any) => translation.language === 'EN')
  const isEnglish = language === 'en' && english
  const { translations, ...base } = item
  return { ...base, ...(isEnglish ? english : {}), language: isEnglish ? 'en' : 'zh-CN', availableLanguages: ['zh-CN', ...(english ? ['en'] : [])] }
}

function translationData(body: any) {
  const markdown = String(body.markdown ?? '')
  return { title: String(body.title ?? '').trim(), excerpt: String(body.excerpt ?? ''), markdown, html: renderMarkdown(markdown), wordCount: wordCount(markdown), seoTitle: body.seoTitle ? String(body.seoTitle) : null, seoDescription: body.seoDescription ? String(body.seoDescription) : null }
}

export async function contentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin)
  app.get('/', async req => {
    const q = req.query as Record<string,string>; const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Math.max(1, Number(q.limit) || 20))
    const where: any = { ...(q.type ? { type: q.type } : {}), ...(q.status ? { status: q.status } : {}), ...contentSearchFilters(q) }
    const [items,total] = await prisma.$transaction([prisma.content.findMany({ where, select, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.content.count({ where })])
    return { data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } }
  })
  app.get('/:id', async (req, reply) => { const item = await prisma.content.findUnique({ where: { id: (req.params as any).id }, select }); return item ? { data: item } : reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } }) })
  app.get('/:id/translations/:language', async (req, reply) => {
    const language = String((req.params as any).language).toLowerCase() === 'en' ? ContentLanguage.EN : null
    if (!language) return reply.code(400).send({ error: { code: 'INVALID_LANGUAGE', message: 'Supported language: en' } })
    const translation = await prisma.contentTranslation.findUnique({ where: { contentId_language: { contentId: (req.params as any).id, language } }, select: translationSelect })
    return translation ? { data: translation } : reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Translation not found' } })
  })
  app.put('/:id/translations/:language', async (req, reply) => { try {
    const language = String((req.params as any).language).toLowerCase() === 'en' ? ContentLanguage.EN : null
    if (!language) throw new Error('Supported language: en')
    const data = translationData(req.body); if (!data.title) throw new Error('Translation title is required')
    return { data: await prisma.contentTranslation.upsert({ where: { contentId_language: { contentId: (req.params as any).id, language } }, update: data, create: { contentId: (req.params as any).id, language, ...data }, select: translationSelect }) }
  } catch (error) { return reply.code(400).send({ error: { code: 'INVALID_TRANSLATION', message: error instanceof Error ? error.message : 'Invalid translation' } }) } })
  app.post('/', async (req, reply) => { try { const data = dataFrom(req.body); if (!data.title || !data.slug || !Object.values(ContentType).includes(data.type)) throw new Error('Title, slug, and valid type are required'); return reply.code(201).send({ data: await prisma.content.create({ data, select }) }) } catch (error) { return reply.code(400).send({ error: { code: 'INVALID_CONTENT', message: error instanceof Error ? error.message : 'Invalid content' } }) } })
  app.put('/:id', async (req, reply) => { try { return { data: await prisma.content.update({ where: { id: (req.params as any).id }, data: dataFrom(req.body), select }) } } catch (error) { return reply.code(400).send({ error: { code: 'INVALID_CONTENT', message: error instanceof Error ? error.message : 'Invalid content' } }) } })
  app.delete('/:id', async (req, reply) => { await prisma.content.delete({ where: { id: (req.params as any).id } }); return reply.code(204).send() })
}

export async function publicRoutes(app: FastifyInstance) {
  for (const [path,type] of Object.entries(types)) {
    app.get(`/${path}`, async (req, reply) => {
      reply.header('Cache-Control','public, max-age=60, stale-while-revalidate=300'); const q = req.query as Record<string,string>; const page = Math.max(1,Number(q.page)||1); const limit = Math.min(50,Math.max(1,Number(q.limit)||10)); const now = new Date()
      await prisma.content.updateMany({ where: { type, status: 'SCHEDULED', scheduledAt: { lte: now } }, data: { status: 'PUBLISHED', publishedAt: now } })
      const where: any = publicContentWhere(type, q, now); const [items,total] = await prisma.$transaction([prisma.content.findMany({ where, select, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }] as any, skip:(page-1)*limit,take:limit }),prisma.content.count({where})]); return { data:items.map(item => localizeContent(item, q.lang)),meta:{page,limit,total,pages:Math.ceil(total/limit)} }
    })
    app.get(`/${path}/:slug`, async (req, reply) => { reply.header('Cache-Control','public, max-age=60, stale-while-revalidate=300'); const item = await prisma.content.findUnique({ where: { type_slug: { type, slug: (req.params as any).slug } }, select }); return item?.status === 'PUBLISHED' && item.publishedAt && item.publishedAt <= new Date() ? { data: localizeContent(item, (req.query as any).lang) } : reply.code(404).send({error:{code:'NOT_FOUND',message:'Content not found'}}) })
  }
}
