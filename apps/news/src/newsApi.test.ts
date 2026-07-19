import{afterEach,describe,expect,it,vi}from'vitest'
import{fetchCategories,fetchPosts,queryString}from'./newsApi'
import{categorySlug,readingTime,resolveMediaUrl,stripHtml}from'./utils'

describe('news helpers',()=>{
  afterEach(()=>vi.restoreAllMocks())
  it('builds CMS public post query strings',()=>{expect(queryString({category:'technology',categoryId:'cat_123',featured:true,search:'ai',limit:6})).toBe('limit=6&category=technology&categoryId=cat_123&featured=true&search=ai')})
  it('formats route and display helpers',()=>{expect(categorySlug('World News')).toBe('world-news');expect(readingTime(221)).toBe('2 min read');expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');expect(resolveMediaUrl('media/a.jpg')).toBe('/media/a.jpg')})
  it('exports category fetcher for navigation',()=>{expect(typeof fetchCategories).toBe('function')})
  it('calls the CMS public posts API with news filters',async()=>{const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({data:[],meta:{page:1,limit:18,total:0,pages:0}})} as Response);await fetchPosts({category:'science',search:'climate',limit:18});expect(fetchMock).toHaveBeenCalledWith('/api/v1/posts?limit=18&category=science&search=climate')})
})
