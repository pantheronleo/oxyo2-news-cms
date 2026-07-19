import type { FastifyInstance } from 'fastify'
import { ContentType, prisma } from '@cms/database'
import { config } from '../config.js'

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]!))
const siteUrl = (path = '/') => new URL(path, config.PUBLIC_BASE_URL).toString()
const articleUrl = (slug: string) => siteUrl(`/article/${slug}`)
const pageUrl = (slug: string) => siteUrl(`/page/${slug}`)
const categoryUrl = (slug: string) => siteUrl(`/category/${slug}`)

export async function feedRoutes(app: FastifyInstance) {
  app.get('/robots.txt', async (_req, reply) => {
    reply.type('text/plain; charset=utf-8').header('Cache-Control', 'public, max-age=300')
    return `User-agent: *\nAllow: /\nSitemap: ${siteUrl('/sitemap.xml')}\n`
  })

  app.get('/sitemap.xml', async (_req, reply) => {
    const [posts, pages, categories] = await Promise.all([
      prisma.content.findMany({ where: { type: ContentType.POST, status: 'PUBLISHED', publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true, publishedAt: true }, orderBy: { publishedAt: 'desc' }, take: 1000 }),
      prisma.content.findMany({ where: { type: ContentType.PAGE, status: 'PUBLISHED', publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true, publishedAt: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    ])
    const urls = [
      { loc: siteUrl('/'), lastmod: new Date() },
      ...categories.map(category => ({ loc: categoryUrl(category.slug), lastmod: category.updatedAt })),
      ...pages.map(page => ({ loc: pageUrl(page.slug), lastmod: page.updatedAt || page.publishedAt })),
      ...posts.map(post => ({ loc: articleUrl(post.slug), lastmod: post.updatedAt || post.publishedAt }))
    ]
    reply.type('application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeXml(url.loc)}</loc><lastmod>${url.lastmod.toISOString()}</lastmod></url>`).join('\n')}\n</urlset>\n`
  })

  app.get('/rss.xml', async (_req, reply) => {
    const posts = await prisma.content.findMany({
      where: { type: ContentType.POST, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      select: { title: true, slug: true, excerpt: true, html: true, publishedAt: true, updatedAt: true, authorName: true, category: true, categoryRef: { select: { name: true } }, coverMedia: { select: { url: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 50
    })
    reply.type('application/rss+xml; charset=utf-8').header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n  <channel>\n    <title>Globaly Magazine News</title>\n    <link>${escapeXml(siteUrl('/'))}</link>\n    <description>Independent magazine-style news, analysis, and editorial explainers.</description>\n    <language>en</language>\n    <atom:link href="${escapeXml(siteUrl('/rss.xml'))}" rel="self" type="application/rss+xml" />\n${posts.map(post => {
      const image = post.coverMedia?.url ? new URL(post.coverMedia.url, config.PUBLIC_BASE_URL).toString() : ''
      return `    <item>\n      <title>${escapeXml(post.title)}</title>\n      <link>${escapeXml(articleUrl(post.slug))}</link>\n      <guid isPermaLink="true">${escapeXml(articleUrl(post.slug))}</guid>\n      <description>${escapeXml(post.excerpt || post.html.replace(/<[^>]+>/g, ' ').slice(0, 220))}</description>\n      <pubDate>${(post.publishedAt || post.updatedAt).toUTCString()}</pubDate>\n      <author>${escapeXml(post.authorName || 'Editorial Desk')}</author>\n      <category>${escapeXml(post.categoryRef?.name || post.category || 'General')}</category>${image ? `\n      <media:content url="${escapeXml(image)}" medium="image" />` : ''}\n    </item>`
    }).join('\n')}\n  </channel>\n</rss>\n`
  })
}
