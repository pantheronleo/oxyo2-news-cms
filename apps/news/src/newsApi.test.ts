import{afterEach,describe,expect,it,vi}from'vitest'
import{fetchCategories,fetchPageBySlug,fetchPosts,queryString}from'./newsApi'
import{categorySlug,readingTime,resolveMediaUrl,stripHtml}from'./utils'
import{categoryDescription,categoryLabel,withLocale}from'./locale'

describe('news helpers',()=>{
  afterEach(()=>vi.restoreAllMocks())
  it('builds CMS public post query strings',()=>{expect(queryString({category:'technology',categoryId:'cat_123',featured:true,search:'ai',limit:6})).toBe('limit=6&category=technology&categoryId=cat_123&featured=true&search=ai')})
  it('formats route and display helpers in the Chinese-first default',()=>{expect(categorySlug('World News')).toBe('world-news');expect(readingTime(221)).toBe('2 分钟阅读');expect(readingTime(221,'en')).toBe('2 min read');expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');expect(resolveMediaUrl('media/a.jpg')).toBe('/media/a.jpg')})
  it('preserves language across internal links and falls back for untranslated categories',()=>{expect(withLocale('/search?q=ai','en')).toBe('/search?q=ai&lang=en');expect(withLocale('/search?q=ai&lang=en','zh-CN')).toBe('/search?q=ai');expect(categoryLabel({name:'Technology',nameZh:'科技'},'zh-CN')).toBe('科技');expect(categoryLabel({name:'Business',slug:'business'},'zh-CN')).toBe('商业');expect(categoryDescription({description:'Latest technology',descriptionZh:''},'zh-CN')).toBe('Latest technology')})
  it('exports category fetcher for navigation',()=>{expect(typeof fetchCategories).toBe('function')})
  it('calls the CMS public posts API with news filters',async()=>{const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({data:[],meta:{page:1,limit:18,total:0,pages:0}})} as Response);await fetchPosts({category:'science',search:'climate',limit:18});expect(fetchMock).toHaveBeenCalledWith('/api/v1/posts?limit=18&category=science&search=climate')})
  it('requests English static-page variants when selected',async()=>{const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({data:{}})} as Response);await fetchPageBySlug('about-thepaperleaf','en');expect(fetchMock).toHaveBeenCalledWith('/api/v1/pages/about-thepaperleaf?lang=en')})
})
