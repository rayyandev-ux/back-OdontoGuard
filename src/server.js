import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

const app = Fastify()
const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)
const corsOrigin = process.env.CORS_ORIGIN
  ? (process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN.split(',').map(s => s.trim()))
  : ['http://localhost:5173', 'http://localhost:5174']
await app.register(cors, { origin: corsOrigin })

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'odontokaren@odonto.com'
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'odonto123karen'
const ACCESS_CODE = process.env.ACCESS_CODE || 'ODONTO-ACCESS-2025'

function authenticate(req, reply) {
  const h = req.headers['authorization'] || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) { reply.code(401).send({ error: 'unauthorized' }); return null }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return payload.userId
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
    return null
  }
}

app.post('/api/auth/login', async (req, reply) => {
  try {
    const { email, password, accessCode } = req.body || {}
    const ok = email === LOGIN_EMAIL && password === LOGIN_PASSWORD && accessCode === ACCESS_CODE
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' })
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) user = await prisma.user.create({ data: { email, password } })
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
    return { token, user: { id: user.id, email: user.email } }
  } catch (e) {
    console.error('login_failed', e)
    reply.code(500).send({ error: 'login_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/patients', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const list = await prisma.patient.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } })
    return list
  } catch (e) {
    console.error('list_failed', e)
    reply.code(500).send({ error: 'list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/patients', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { registroCodigo, ...data } = req.body || {}
    const created = await prisma.patient.create({ data: { ownerId: userId, ...data } })
    return created
  } catch (e) {
    console.error('create_failed', e)
    reply.code(500).send({ error: 'create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.put('/api/patients/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const { registroCodigo, ...data } = req.body || {}
    const updated = await prisma.patient.update({ where: { id }, data })
    return updated
  } catch (e) {
    console.error('update_failed', e)
    reply.code(500).send({ error: 'update_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/patients/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    await prisma.patient.delete({ where: { id } })
    return { ok: true }
  } catch (e) {
    console.error('delete_failed', e)
    reply.code(500).send({ error: 'delete_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/services', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const list = await prisma.service.findMany({ where: { ownerId: userId }, orderBy: { name: 'asc' } })
    return list
  } catch (e) {
    console.error('services_list_failed', e)
    reply.code(500).send({ error: 'services_list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/services', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { name, price } = req.body || {}
    if (!name) return reply.code(400).send({ error: 'name_required' })
    const created = await prisma.service.create({ data: { ownerId: userId, name, price: Number(price || 0) } })
    return created
  } catch (e) {
    console.error('services_create_failed', e)
    reply.code(500).send({ error: 'services_create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.put('/api/services/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const { name, price } = req.body || {}
    const updated = await prisma.service.update({ where: { id }, data: { name, price: Number(price || 0) } })
    return updated
  } catch (e) {
    console.error('services_update_failed', e)
    reply.code(500).send({ error: 'services_update_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/services/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    await prisma.service.delete({ where: { id } })
    return { ok: true }
  } catch (e) {
    console.error('services_delete_failed', e)
    reply.code(500).send({ error: 'services_delete_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/send-email', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { to, subject, html, attachments } = req.body || {}
    if (!to) return reply.code(400).send({ error: 'to_required' })
    const from = process.env.RESEND_FROM || 'onboarding@resend.dev'
    const r = await resend.emails.send({ from, to, subject: subject || 'OdontoKaren', html: html || '', attachments })
    return { ok: true, id: r?.id || null }
  } catch (e) {
    console.error('send_email_failed', e)
    reply.code(500).send({ error: 'send_email_failed', code: e?.code || 'UNKNOWN' })
  }
})

const addr = await app.listen({ port: process.env.PORT ? Number(process.env.PORT) : 4000, host: '0.0.0.0' })
console.log('listening', addr)
