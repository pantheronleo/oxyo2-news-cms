import argon2 from 'argon2'
import { prisma } from '../src/index.js'

const email = process.env.ADMIN_EMAIL?.toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !password || password.length < 12) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) are required')
await prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: await argon2.hash(password) } })
console.log(`Admin ready: ${email}`)
await prisma.$disconnect()
