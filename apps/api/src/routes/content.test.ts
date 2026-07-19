import{describe,expect,it}from'vitest'
import{ContentType}from'@cms/database'
import{contentSearchFilters,publicContentWhere}from'./content.js'

describe('content route filters',()=>{
  it('builds category, featured, and search filters',()=>{
    expect(contentSearchFilters({category:'Technology',categoryId:'cat_123',featured:'true',search:'AI'})).toEqual({
      categoryId:'cat_123',
      isFeatured:true,
      AND:[
        {OR:[{category:{equals:'Technology',mode:'insensitive'}},{categoryRef:{is:{slug:'Technology'}}},{categoryRef:{is:{name:{equals:'Technology',mode:'insensitive'}}}}]},
        {OR:[{title:{contains:'AI',mode:'insensitive'}},{slug:{contains:'AI',mode:'insensitive'}},{excerpt:{contains:'AI',mode:'insensitive'}},{category:{contains:'AI',mode:'insensitive'}}]}
      ]
    })
  })
  it('keeps public queries published-only',()=>{
    const now=new Date('2026-07-07T00:00:00.000Z')
    expect(publicContentWhere(ContentType.POST,{tag:'launch',featured:'false'},now)).toEqual({
      type:ContentType.POST,
      status:'PUBLISHED',
      publishedAt:{lte:now},
      tags:{has:'launch'},
      isFeatured:false
    })
  })
})
