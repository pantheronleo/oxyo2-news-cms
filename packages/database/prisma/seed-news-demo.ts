import { PrismaClient, ContentType } from '@prisma/client'
import { createHash } from 'node:crypto'

const prisma = new PrismaClient()
const categories = [
  ['Business','business','Markets, companies, work, and money.','#BC9B56'],
  ['Technology','technology','Platforms, AI, products, and digital culture.','#2521E1'],
  ['Culture','culture','Creative industries, media, arts, and identity.','#AF585D'],
  ['World','world','International affairs and global shifts.','#4C4543'],
  ['Science','science','Research, discovery, health, and climate.','#2F6650'],
  ['Sport','sport','Competition, teams, athletes, and performance.','#E15D2A']
] as const

// Unsplash photos are used through remote image URLs so the demo can show realistic editorial thumbnails without a download step.
// License reference: https://unsplash.com/license
const stories = [
  {title:'Inside the Morning Briefing That Moves Global Markets',category:'Business',authorName:'Maya Chen',sourceLabel:'Globaly Markets',featured:true,accent:'#BC9B56',tags:['markets','economy','briefing'],excerpt:'A look at how editors, analysts, and data teams turn overnight signals into the first decisions of the business day.',image:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1100&q=80'},
  {title:'AI Search Startups Race to Become the New Front Door',category:'Technology',authorName:'Elias Rahman',sourceLabel:'Platform Desk',featured:true,accent:'#2521E1',tags:['ai','search','startups'],excerpt:'New discovery tools are changing how readers, shoppers, and researchers find answers on the open web.',image:'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1100&q=80'},
  {title:'Why Independent Magazines Are Finding New Audiences Again',category:'Culture',authorName:'Nora Patel',sourceLabel:'Culture Review',featured:true,accent:'#AF585D',tags:['media','magazines','design'],excerpt:'A design-led publishing wave is making print-inspired digital magazines feel modern, focused, and collectible.',image:'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=80'},
  {title:'Cities Prepare Heat Response Plans Before the Next Record Summer',category:'World',authorName:'Jon Bell',sourceLabel:'World Desk',featured:false,accent:'#4C4543',tags:['cities','climate','policy'],excerpt:'From cooling centers to reflective streets, local governments are testing practical tools for extreme heat.',image:'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1100&q=80'},
  {title:'New Battery Chemistry Promises Longer Life for Grid Storage',category:'Science',authorName:'Dr. Imani Cole',sourceLabel:'Science Lab',featured:false,accent:'#2F6650',tags:['energy','battery','research'],excerpt:'Researchers are testing lower-cost materials that could help renewable grids store power for longer periods.',image:'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1100&q=80'},
  {title:'The Data Team Behind Football’s Fastest Tactical Shifts',category:'Sport',authorName:'Theo Grant',sourceLabel:'Sport Lab',featured:false,accent:'#E15D2A',tags:['football','analytics','sport'],excerpt:'Clubs are using live models and scouting dashboards to compress weeks of tactical learning into match-day decisions.',image:'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1100&q=80'},
  {title:'Founders Rethink Growth as Capital Gets More Selective',category:'Business',authorName:'Leah Wong',sourceLabel:'Startup Ledger',featured:false,accent:'#BC9B56',tags:['startups','funding','business'],excerpt:'With investors asking for durability over speed, young companies are rewriting their operating playbooks.',image:'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1100&q=80'},
  {title:'Personal Devices Get Smaller While Screens Move Everywhere',category:'Technology',authorName:'Arun Silva',sourceLabel:'Hardware Note',featured:false,accent:'#2521E1',tags:['hardware','devices','ux'],excerpt:'The next interface shift may be less about one gadget and more about a mesh of ambient, contextual displays.',image:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1100&q=80'},
  {title:'Museum Curators Turn to Game Engines for Immersive Exhibits',category:'Culture',authorName:'Sofia Martin',sourceLabel:'Arts Desk',featured:false,accent:'#AF585D',tags:['museums','games','immersive'],excerpt:'Real-time rendering tools are helping cultural institutions design spaces that respond to visitors.',image:'https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1100&q=80'},
  {title:'Ocean Sensors Reveal Faster Changes Along Key Current Systems',category:'Science',authorName:'Mika Torres',sourceLabel:'Climate Watch',featured:false,accent:'#2F6650',tags:['ocean','climate','sensors'],excerpt:'A new generation of autonomous sensors is filling gaps in how scientists observe marine climate patterns.',image:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1280&q=80',inline:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1100&q=80'}
]

const aboutPage = {
  title: 'About Globaly',
  slug: 'about-globaly',
  excerpt: 'Globaly is an independent magazine-style publication for clear, visual, and context-rich reporting.',
  seoTitle: 'About Globaly — Independent magazine news',
  seoDescription: 'Learn about Globaly, an independent magazine-style publication for clear, visual, and context-rich reporting.',
  markdown: `## An independent magazine for curious readers\n\nGlobaly is a public news and magazine experience built for readers who want clarity without losing depth. We cover business, technology, culture, world affairs, science, and sport through concise reporting, visual storytelling, and practical context.\n\n## What this publication is for\n\nOur goal is to make fast-moving stories easier to understand. Each section is shaped around useful signals: what changed, why it matters, and what readers should watch next.\n\n## Editorial approach\n\n- We prioritize context over noise and explain the forces behind each headline.\n- We use strong visuals, clear categories, and readable summaries to help readers move quickly.\n- We treat archives as living context, so stories remain useful after the first news cycle.\n- We separate reporting, analysis, and source labels so readers can understand what they are reading.\n\n## What we cover\n\nGlobaly follows the stories that shape public life: markets and work, emerging technology, media and culture, global shifts, scientific discovery, climate, health, sport, and the people building new ways to understand change.\n\n## Our promise\n\nGlobaly is designed to feel calm, direct, and modern: a place for sharp daily reading, deeper weekend browsing, and discovery across topics that deserve more than a passing glance.`
}

const slugify=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
const wordCount=(value:string)=>(value.match(/[\p{L}\p{N}’'-]+/gu)||[]).length
const markdownFor=(story:(typeof stories)[number])=>`## The context\n\n${story.excerpt} The latest reporting follows people working inside ${story.category.toLowerCase()} systems as they adapt to faster information cycles, more demanding audiences, and a need for clearer decisions.\n\n## What changed\n\nEditors are watching how ${story.category.toLowerCase()} leaders respond to new pressure from audiences, regulators, and fast-moving technology. The most interesting shift is not one announcement but the way teams are changing their operating rhythm: shorter feedback loops, better dashboards, and visual explainers that make complicated signals easier to trust.\n\n![${story.title}](${story.inline})\n\n## The reporting so far\n\nInterviews with analysts, operators, and designers point to a shared pattern. Organizations that move well are investing in context, not just speed. They are pairing live data with human judgment, building checklists for moments of uncertainty, and publishing updates in a way that readers can revisit as the story develops.\n\n- Clearer signals are becoming more valuable than raw volume.\n- Visual storytelling helps readers move quickly without losing nuance.\n- Reliable publishing systems make corrections, follow-ups, and context easier to maintain.\n- Teams are treating archives as living products rather than static records.\n\n## Why it matters\n\nThe story is not only about a single headline. It shows how habits are shifting across institutions, teams, and everyday readers. For publishers, the opportunity is to make complex reporting feel approachable without flattening the stakes. For readers, the benefit is a calmer path through fast-moving information.\n\n## What to watch next\n\nExpect more reporting as new data arrives and the newsroom follows the second-order effects. The next useful signal will be whether these early experiments become daily habits, or whether teams return to older workflows once the immediate pressure fades.`
const htmlFor=(markdown:string)=>markdown.split('\n\n').map(block=>{
  if(block.startsWith('## '))return`<h2>${escape(block.slice(3))}</h2>`
  if(block.startsWith('![')){const match=block.match(/^!\[(.*)]\((.*)\)$/);return match?`<figure><img src="${escape(match[2])}" alt="${escape(match[1])}"/><figcaption>Editorial reference image from Unsplash.</figcaption></figure>`:''}
  if(block.startsWith('- '))return`<ul>${block.split('\n').map(line=>`<li>${escape(line.slice(2))}</li>`).join('')}</ul>`
  return`<p>${escape(block)}</p>`
}).join('')

async function upsertMedia(story:(typeof stories)[number],i:number){
  const slug=slugify(story.title), filename=`news-demo/${slug}.jpg`, path=`unsplash:${slug}`, checksum=createHash('sha256').update(story.image).digest('hex')
  return prisma.media.upsert({
    where:{path},
    update:{originalName:`${slug}.jpg`,url:story.image,mimeType:'image/jpeg',extension:'.jpg',size:BigInt(0),checksum,width:1280,height:800,altText:`Unsplash editorial photo for ${story.title}`,caption:`Unsplash demo thumbnail for ${story.category}.`},
    create:{filename,originalName:`${slug}.jpg`,path,url:story.image,mimeType:'image/jpeg',extension:'.jpg',size:BigInt(0),checksum,width:1280,height:800,altText:`Unsplash editorial photo for ${story.title}`,caption:`Unsplash demo thumbnail for ${story.category}.`}
  })
}

async function main(){
  const categoryMap = new Map<string,string>()
  for (const [i,[name,slug,description,color]] of categories.entries()) {
    const category = await prisma.category.upsert({where:{slug},update:{name,description,color,sortOrder:(i+1)*10,isActive:true},create:{name,slug,description,color,sortOrder:(i+1)*10,isActive:true}})
    categoryMap.set(name, category.id)
  }
  await prisma.media.deleteMany({where:{filename:{startsWith:'news-demo/'}}})
  const publishedBase=Date.now()-stories.length*3600000
  for (const [i,story] of stories.entries()) {
    const media=await upsertMedia(story,i), markdown=markdownFor(story), slug=slugify(story.title)
    await prisma.content.upsert({
      where:{type_slug:{type:ContentType.POST,slug}},
      update:{status:'PUBLISHED',title:story.title,excerpt:story.excerpt,category:story.category,categoryId:categoryMap.get(story.category),authorName:story.authorName,sourceLabel:story.sourceLabel,isFeatured:story.featured,markdown,html:htmlFor(markdown),wordCount:wordCount(markdown),tags:story.tags,coverMediaId:media.id,publishedAt:new Date(publishedBase+i*3600000),seoTitle:story.title,seoDescription:story.excerpt},
      create:{type:ContentType.POST,status:'PUBLISHED',title:story.title,slug,excerpt:story.excerpt,category:story.category,categoryId:categoryMap.get(story.category),authorName:story.authorName,sourceLabel:story.sourceLabel,isFeatured:story.featured,markdown,html:htmlFor(markdown),wordCount:wordCount(markdown),tags:story.tags,coverMediaId:media.id,publishedAt:new Date(publishedBase+i*3600000),seoTitle:story.title,seoDescription:story.excerpt}
    })
  }
  await prisma.content.updateMany({where:{type:ContentType.POST,slug:{in:['introducing-the-personal-cms','managing-media-without-slowing-down']}},data:{status:'ARCHIVED',isFeatured:false}})
  await prisma.content.upsert({
    where:{type_slug:{type:ContentType.PAGE,slug:aboutPage.slug}},
    update:{status:'PUBLISHED',title:aboutPage.title,excerpt:aboutPage.excerpt,category:'Page',authorName:'Editorial Desk',sourceLabel:'Globaly',markdown:aboutPage.markdown,html:htmlFor(aboutPage.markdown),wordCount:wordCount(aboutPage.markdown),tags:['about','globaly','news','editorial'],publishedAt:new Date(),seoTitle:aboutPage.seoTitle,seoDescription:aboutPage.seoDescription},
    create:{type:ContentType.PAGE,status:'PUBLISHED',title:aboutPage.title,slug:aboutPage.slug,excerpt:aboutPage.excerpt,category:'Page',authorName:'Editorial Desk',sourceLabel:'Globaly',markdown:aboutPage.markdown,html:htmlFor(aboutPage.markdown),wordCount:wordCount(aboutPage.markdown),tags:['about','globaly','news','editorial'],publishedAt:new Date(),seoTitle:aboutPage.seoTitle,seoDescription:aboutPage.seoDescription}
  })
  await prisma.content.updateMany({where:{type:ContentType.PAGE,slug:'about-this-cms'},data:{status:'ARCHIVED'}})
}

main().finally(()=>prisma.$disconnect())
