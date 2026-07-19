import type { FastifyInstance } from 'fastify'
import { prisma } from '@cms/database'
import { requireAdmin } from '../auth.js'
import { slugify } from '../lib/content.js'

const select={id:true,name:true,slug:true,description:true,color:true,sortOrder:true,isActive:true,createdAt:true,updatedAt:true,_count:{select:{contents:true}}}
function dataFrom(body:any){const name=String(body.name??'').trim();return{name,slug:slugify(body.slug||name),description:String(body.description??''),color:String(body.color??'#2521E1'),sortOrder:Number(body.sortOrder)||0,isActive:body.isActive!==false}}

export async function categoryRoutes(app:FastifyInstance){
  app.addHook('preHandler',requireAdmin)
  app.get('/',async()=>({data:await prisma.category.findMany({select,orderBy:[{sortOrder:'asc'},{name:'asc'}]})}))
  app.post('/',async(req,reply)=>{try{const data=dataFrom(req.body);if(!data.name||!data.slug)throw new Error('Name is required');return reply.code(201).send({data:await prisma.category.create({data,select})})}catch(error){return reply.code(400).send({error:{code:'INVALID_CATEGORY',message:error instanceof Error?error.message:'Invalid category'}})}})
  app.put('/:id',async(req,reply)=>{try{const id=(req.params as any).id,data=dataFrom(req.body);const category=await prisma.$transaction(async tx=>{const updated=await tx.category.update({where:{id},data,select});await tx.content.updateMany({where:{categoryId:id},data:{category:updated.name}});return updated});return{data:category}}catch(error){return reply.code(400).send({error:{code:'INVALID_CATEGORY',message:error instanceof Error?error.message:'Invalid category'}})}})
  app.post('/reorder',async(req,reply)=>{try{const items=Array.isArray((req.body as any)?.items)?(req.body as any).items:[];await prisma.$transaction(items.map((item:any,index:number)=>prisma.category.update({where:{id:String(item.id)},data:{sortOrder:Number.isFinite(Number(item.sortOrder))?Number(item.sortOrder):(index+1)*10}})));return{data:await prisma.category.findMany({select,orderBy:[{sortOrder:'asc'},{name:'asc'}]})}}catch(error){return reply.code(400).send({error:{code:'INVALID_CATEGORY_ORDER',message:error instanceof Error?error.message:'Could not reorder categories'}})}})
  app.delete('/:id',async(req,reply)=>{try{const id=(req.params as any).id,count=await prisma.content.count({where:{categoryId:id}});if(count>0)return reply.code(409).send({error:{code:'CATEGORY_IN_USE',message:'This category is used by posts. Disable it instead, or move posts to another category before deleting.'}});await prisma.category.delete({where:{id}});return reply.code(204).send()}catch(error){return reply.code(400).send({error:{code:'INVALID_CATEGORY',message:error instanceof Error?error.message:'Could not delete category'}})}})
}

export async function publicCategoryRoutes(app:FastifyInstance){
  app.get('/categories',async(_req,reply)=>{reply.header('Cache-Control','public, max-age=300, stale-while-revalidate=600');return{data:await prisma.category.findMany({where:{isActive:true},select,orderBy:[{sortOrder:'asc'},{name:'asc'}]})}})
}
