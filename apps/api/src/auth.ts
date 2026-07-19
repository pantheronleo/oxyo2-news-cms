import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import argon2 from 'argon2'
import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { prisma } from '@cms/database'
import { config } from './config.js'

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session.userId) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } })
}
export async function authRoutes(app: FastifyInstance) {
  app.post('/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { email, password } = req.body as { email?: string; password?: string }
    const user = email ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } }) : null
    if (!user || !password || !(await argon2.verify(user.passwordHash, password))) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    await req.session.regenerate(); req.session.userId = user.id
    const csrfToken = reply.generateCsrf()
    await req.session.save()
    return { data: { id: user.id, email: user.email, name: user.name }, csrfToken }
  })
  app.get('/me', async (req, reply) => {
    if (!req.session.userId) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } })
    const csrfToken = reply.generateCsrf()
    await req.session.save()
    return { data: await prisma.user.findUnique({ where: { id: req.session.userId }, select: { id: true, email: true, name: true } }), csrfToken }
  })
  app.post('/logout', { preHandler: requireAdmin }, async req => { await req.session.destroy(); return { data: { success: true } } })
  app.post('/change-password', { preHandler: requireAdmin }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body as Record<string,string>
    if (!newPassword || newPassword.length < 12) return reply.code(400).send({ error: { code: 'WEAK_PASSWORD', message: 'Use at least 12 characters' } })
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId! } })
    if (!currentPassword || !(await argon2.verify(user.passwordHash, currentPassword))) return reply.code(400).send({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } })
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(newPassword) } }); return { data: { success: true } }
  })
  app.post('/forgot-password', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async req => {
    const { email } = req.body as { email?: string }; const user = email ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } }) : null
    if (user) {
      const token = crypto.randomBytes(32).toString('hex'); const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 3600000) } })
      if (config.SMTP_HOST) {
        const transport = nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465, auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined })
        await transport.sendMail({ from: config.SMTP_FROM, to: user.email, subject: 'Reset your CMS password', text: `${config.ADMIN_ORIGIN}/reset-password?token=${token}` })
      } else app.log.warn({ resetUrl: `${config.ADMIN_ORIGIN}/reset-password?token=${token}` }, 'SMTP unavailable; reset URL logged')
    }
    return { data: { message: 'If the account exists, reset instructions have been sent.' } }
  })
  app.post('/reset-password', async (req, reply) => {
    const { token, password } = req.body as Record<string,string>; if (!token || !password || password.length < 12) return reply.code(400).send({ error: { code: 'INVALID_RESET', message: 'Invalid token or password' } })
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    if (!reset || reset.status !== 'ACTIVE' || reset.expiresAt <= new Date()) return reply.code(400).send({ error: { code: 'EXPIRED_RESET', message: 'Reset link is invalid or expired' } })
    await prisma.$transaction([prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await argon2.hash(password) } }), prisma.passwordResetToken.update({ where: { id: reset.id }, data: { status: 'USED' } })]); return { data: { success: true } }
  })
}
