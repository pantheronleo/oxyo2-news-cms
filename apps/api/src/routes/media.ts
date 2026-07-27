import type { FastifyInstance } from 'fastify'
import { prisma } from '@cms/database'
import { requireAdmin } from '../auth.js'
import { config } from '../config.js'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, open, unlink } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileTypeFromFile } from 'file-type'
import { imageSize } from 'image-size'
import { uploadRoot } from '../lib/uploads.js'

const allowed = new Map([['image/jpeg',['.jpg','.jpeg']],['image/png',['.png']],['image/gif',['.gif']],['image/webp',['.webp']],['video/mp4',['.mp4']],['video/webm',['.webm']],['video/quicktime',['.mov']]])
export async function mediaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin)
  app.get('/', async req => { const q=req.query as Record<string,string>; const page=Math.max(1,Number(q.page)||1),limit=Math.min(100,Math.max(1,Number(q.limit)||24)); const where=q.search?{OR:[{originalName:{contains:q.search,mode:'insensitive' as const}},{altText:{contains:q.search,mode:'insensitive' as const}}]}:{}; const [items,total]=await prisma.$transaction([prisma.media.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:limit}),prisma.media.count({where})]); return {data:items.map(serialise),meta:{page,limit,total,pages:Math.ceil(total/limit)}} })
  app.post('/', async (req, reply) => {
    const part=await req.file({limits:{fileSize:config.MAX_UPLOAD_BYTES,files:1}}); if(!part) return reply.code(400).send({error:{code:'NO_FILE',message:'Choose a file'}})
    const extension=extname(part.filename).toLowerCase(); if(!allowed.get(part.mimetype)?.includes(extension)) return reply.code(415).send({error:{code:'UNSUPPORTED_MEDIA',message:'Unsupported file type or extension'}})
    const date=new Date(), relative=join(String(date.getUTCFullYear()),String(date.getUTCMonth()+1).padStart(2,'0'),`${randomUUID()}${extension}`), full=resolve(uploadRoot(config.UPLOAD_DIR),relative); await mkdir(dirname(full),{recursive:true})
    const hash=createHash('sha256'); let size=0; const meter=new Transform({transform(chunk,_enc,cb){size+=chunk.length;hash.update(chunk);cb(null,chunk)}})
    try { await pipeline(part.file,meter,createWriteStream(full,{flags:'wx'})); if(part.file.truncated) throw new Error('File exceeds upload limit') } catch(error) { await unlink(full).catch(()=>{}); return reply.code(413).send({error:{code:'UPLOAD_FAILED',message:error instanceof Error?error.message:'Upload failed'}}) }
    const detected=await fileTypeFromFile(full); if(!detected||detected.mime!==part.mimetype){await unlink(full).catch(()=>{});return reply.code(415).send({error:{code:'INVALID_FILE_SIGNATURE',message:'File contents do not match the declared media type'}})}
    let width:number|undefined,height:number|undefined; if(part.mimetype.startsWith('image/')){const handle=await open(full,'r');try{const buffer=Buffer.alloc(Math.min(size,1024*1024));await handle.read(buffer,0,buffer.length,0);const dimensions=imageSize(buffer);width=dimensions.width;height=dimensions.height}catch{await unlink(full).catch(()=>{});return reply.code(415).send({error:{code:'INVALID_IMAGE',message:'Image metadata could not be read'}})}finally{await handle.close()}}
    const filename=relative.replaceAll('\\','/'); const media=await prisma.media.create({data:{filename,originalName:part.filename,path:full,url:`/media/${filename}`,mimeType:part.mimetype,extension,size:BigInt(size),checksum:hash.digest('hex'),width,height}}); return reply.code(201).send({data:serialise(media)})
  })
  app.patch('/:id', async req => { const body=req.body as any; return {data:serialise(await prisma.media.update({where:{id:(req.params as any).id},data:{altText:String(body.altText??''),caption:String(body.caption??'')}}))} })
  app.delete('/:id', async (req,reply) => { const id=(req.params as any).id; const item=await prisma.media.findUnique({where:{id},include:{_count:{select:{covers:true}}}}); if(!item)return reply.code(404).send({error:{code:'NOT_FOUND',message:'Media not found'}}); if(item._count.covers)return reply.code(409).send({error:{code:'MEDIA_IN_USE',message:'Remove this media from content before deleting it'}}); await prisma.media.delete({where:{id}}); if(!item.path.startsWith('remote:')) await unlink(item.path).catch(err=>app.log.warn(err)); return reply.code(204).send() })
}
const serialise=(item:any)=>({...item,size:String(item.size)})

export async function serveMedia(app:FastifyInstance){app.get('/media/*',async(req,reply)=>{const relative=String((req.params as any)['*']??'').replace(/^\/+/,''); const root=uploadRoot(config.UPLOAD_DIR),full=resolve(root,relative); if(!full.startsWith(`${root}/`))return reply.code(400).send(); const item=await prisma.media.findFirst({where:{OR:[{path:full},{filename:relative}]}}); if(!item)return reply.code(404).send(); const filePath=existsSync(item.path)?item.path:full; reply.header('Content-Type',item.mimeType).header('Cache-Control','public, max-age=31536000, immutable').header('X-Content-Type-Options','nosniff'); return reply.send(createReadStream(filePath))})}
