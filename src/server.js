import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

const app = Fastify()
const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)
const corsOriginEnv = process.env.CORS_ORIGIN
const corsOrigin = corsOriginEnv
  ? (corsOriginEnv.includes('*') ? true : corsOriginEnv.split(',').map(s => s.trim()))
  : ['http://localhost:5173', 'http://localhost:5174']
await app.register(cors, { origin: corsOrigin, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] })

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'odontokaren@odonto.com'
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'odonto123karen'
const ACCESS_CODE = process.env.ACCESS_CODE || 'ODONTO-ACCESS-2025'
const WAZEND_BASE_URL = process.env.WAZEND_BASE_URL || 'https://api1.wazend.net'
const WAZEND_API_BASE = process.env.WAZEND_API_BASE || ''
const WAZEND_SEND_TEXT_PATH = process.env.WAZEND_SEND_TEXT_PATH || '/message/sendText'
const WAZEND_INSTANCE_ID = process.env.WAZEND_INSTANCE_ID || ''
const WAZEND_ACCESS_TOKEN = process.env.WAZEND_ACCESS_TOKEN || ''
const WAZEND_DRY_RUN = String(process.env.WAZEND_DRY_RUN || '').toLowerCase() === 'true'
const WAZEND_CUSTOM_URL = process.env.WAZEND_CUSTOM_URL || ''
const WAZEND_AUTH_BEARER = process.env.WAZEND_AUTH_BEARER || ''
const WAZEND_USE_CHATID = String(process.env.WAZEND_USE_CHATID || '').toLowerCase() === 'true'
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || ''
const FREQ_MONTHS = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 }

function ensureE164(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '')
  if (!digits) return ''
  if (digits.startsWith('51')) return `+${digits}`
  if (digits.length === 9) return `+51${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+51${digits.slice(1)}`
  if (digits.startsWith('+')) return digits
  return `+${digits}`
}

async function sendWhatsappText(to, text) {
  if (WAZEND_DRY_RUN) {
    console.log('wazend_dry_run', to)
    return { id: `dry_${Date.now()}` }
  }
  const e164 = ensureE164(to)
  const digits = String(e164 || '').replace(/^\+/, '')
  const chatId = digits ? `${digits}@c.us` : ''
  const senderE164 = ensureE164(WHATSAPP_NUMBER)
  const senderDigits = String(senderE164 || '').replace(/^\+/, '')
  const senderChatId = senderDigits ? `${senderDigits}@c.us` : ''
  const bodyVariants = [
    WAZEND_USE_CHATID ? { chatId, text } : null,
    { instanceId: WAZEND_INSTANCE_ID, accessToken: WAZEND_ACCESS_TOKEN, to: e164, text },
    { to: e164, text },
    { phone: digits, message: text },
    { chatId, text },
    { session: WAZEND_INSTANCE_ID, chatId, text },
    { session: WAZEND_INSTANCE_ID, number: digits, text },
    { number: digits, text },
    { instanceKey: WAZEND_INSTANCE_ID, number: digits, text },
    senderE164 ? { to: e164, text, from: senderE164 } : null,
    senderDigits ? { phone: digits, message: text, sender: senderDigits } : null,
    senderChatId ? { chatId, text, sender: senderChatId } : null,
  ].filter(Boolean)
  const inst = String(WAZEND_INSTANCE_ID || '').trim()
  const token = String(WAZEND_ACCESS_TOKEN || '').trim()
  const paths = [
    WAZEND_SEND_TEXT_PATH,
    '/api/message/sendText',
    '/message/send-text',
    '/v1/message/sendText',
    '/api/v1/message/sendText',
    '/api/sendText',
    '/sendText',
    '/api/send-text',
    '/send-text',
    '/message/send',
    '/api/message/send',
    '/send-message',
    '/api/send-message',
    inst ? `/message/sendText/${inst}` : null,
    inst ? `/api/message/sendText/${inst}` : null,
    inst ? `/message/send/${inst}` : null,
    inst ? `/api/message/send/${inst}` : null,
    (inst && token) ? `/waInstance${inst}/sendText/${token}` : null,
    (inst && token) ? `/api/waInstance${inst}/sendText/${token}` : null,
    (inst && token) ? `/waInstance${inst}/sendMessage/${token}` : null,
    (inst && token) ? `/api/waInstance${inst}/sendMessage/${token}` : null
  ].filter(Boolean)
  const bases = []
  if (WAZEND_CUSTOM_URL) bases.unshift(WAZEND_CUSTOM_URL)
  if (WAZEND_API_BASE) bases.push(WAZEND_API_BASE)
  if (WAZEND_BASE_URL) bases.push(WAZEND_BASE_URL)
  if (!bases.includes('https://api2.wazend.net')) bases.push('https://api2.wazend.net')
  if (!bases.includes('https://api1.wazend.net')) bases.push('https://api1.wazend.net')
  const headersVariants = [
    { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${WAZEND_ACCESS_TOKEN}` },
    WAZEND_AUTH_BEARER ? { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${WAZEND_AUTH_BEARER}` } : null,
    { 'Content-Type': 'application/json', 'Accept': 'application/json', 'apikey': WAZEND_ACCESS_TOKEN },
    { 'Content-Type': 'application/json', 'Accept': 'application/json', 'x-api-key': WAZEND_ACCESS_TOKEN },
    { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Api-Key': WAZEND_ACCESS_TOKEN },
    { 'Content-Type': 'application/json', 'Accept': 'application/json', 'apiKey': WAZEND_ACCESS_TOKEN },
  ].filter(Boolean)
  let lastErr = null, lastData = null, lastUrl = null
  if (WAZEND_CUSTOM_URL && WAZEND_CUSTOM_URL.startsWith('http')) {
    const url = WAZEND_CUSTOM_URL
    for (const headers of headersVariants) {
      for (const body of bodyVariants) {
        lastUrl = url
        console.log('wazend_send_try', url, to)
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
        let data = null
        try { data = await res.json() } catch { data = null }
        if (res.ok) return data
        lastErr = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`
        lastData = data
      }
    }
  } else {
    for (const base of bases) {
      for (const p of paths) {
        for (const headers of headersVariants) {
          for (const body of bodyVariants) {
            const url = `${base}${p}`
            lastUrl = url
            console.log('wazend_send_try', url, to)
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
            let data = null
            try { data = await res.json() } catch { data = null }
            if (res.ok) return data
            lastErr = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`
            lastData = data
          }
        }
      }
    }
  }
  throw new Error((lastErr || 'wazend_failed') + (lastUrl ? ` at ${lastUrl}` : ''))
}

function renderTemplateText(tpl, patient, service, dueAt) {
  const map = {
    nombre: `${patient?.nombres || ''}`.trim(),
    apellidos: `${patient?.apellidos || ''}`.trim(),
    servicio: `${service?.name || ''}`.trim(),
    fecha: dueAt ? new Date(dueAt).toLocaleDateString('es-PE') : '',
    telefono: `${patient?.telefono || ''}`
  }
  return String(tpl || '').replace(/\{([^}]+)\}/g, (_, k) => map[k] ?? '')
}

async function findMatchingRule(ownerId, service, description) {
  const rules = await prisma.reminderRule.findMany({ where: { ownerId, enabled: true } })
  if (service) {
    const direct = rules.find(r => r.serviceId === service.id)
    if (direct) return direct
  }
  const text = String(description || '').toLowerCase()
  for (const r of rules) {
    const kw = Array.isArray(r.matchKeywords) ? r.matchKeywords : []
    if (kw.some(k => text.includes(String(k || '').toLowerCase()))) return r
  }
  return null
}

async function createReminderFromService(ownerId, patient, service, performedAt, appointmentId) {
  const rule = await findMatchingRule(ownerId, service, service?.name)
  if (!rule) return null
  const due = new Date(performedAt)
  due.setDate(due.getDate() + Number(rule.delayDays || 0))
  const text = renderTemplateText(rule.templateText, patient, service, due)
  const reminder = await prisma.reminder.create({ data: { ownerId, patientId: patient.id, appointmentId: appointmentId || null, serviceId: service?.id || null, performedAt, dueAt: due, status: 'pending', channel: 'whatsapp', messageText: text } })
  return reminder
}

async function createReminderFromTreatment(ownerId, patient, treatment) {
  const svcName = String(treatment?.description || '')
  const svc = await prisma.service.findFirst({ where: { ownerId, name: svcName } })
  const rule = await findMatchingRule(ownerId, svc, treatment?.description)
  if (!rule) return null
  const performedAt = new Date(`${treatment?.date || new Date().toISOString().slice(0,10)}T00:00:00`)
  const due = new Date(performedAt)
  due.setDate(due.getDate() + Number(rule.delayDays || 0))
  const text = renderTemplateText(rule.templateText, patient, svc || { name: svcName }, due)
  const reminder = await prisma.reminder.create({ data: { ownerId, patientId: patient.id, serviceId: svc?.id || null, performedAt, dueAt: due, status: 'pending', channel: 'whatsapp', messageText: text } })
  return reminder
}

function withinWindow(rule, now) {
  const h = now.getHours()
  const start = Number(rule.hourStart || 0)
  const end = Number(rule.hourEnd || 24)
  if (h < start || h >= end) return false
  const dow = now.getDay()
  const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : null
  if (days && days.length) return days.includes(dow)
  return true
}

async function processDueReminders() {
  const now = new Date()
  const due = await prisma.reminder.findMany({ where: { status: 'pending', dueAt: { lte: now } }, orderBy: { dueAt: 'asc' } })
  for (const r of due) {
    const rows = await prisma.$queryRaw`SELECT * FROM "Patient" WHERE "id" = ${r.patientId}`
    const patient = Array.isArray(rows) && rows[0] ? rows[0] : null
    if (!patient) continue
    if (patient.whatsappOptOutAt) continue
    if (!patient.whatsappConsent) continue
    const phone = ensureE164(patient.telefono)
    if (!phone) continue
    const svc = await prisma.service.findUnique({ where: { id: r.serviceId || '' } }).catch(() => null)
    const rule = r.serviceId ? await prisma.reminderRule.findFirst({ where: { ownerId: r.ownerId, serviceId: r.serviceId, enabled: true } }) : await findMatchingRule(r.ownerId, null, r.messageText)
    if (rule && !withinWindow(rule, now)) continue
    try {
      const payloadText = renderTemplateText(r.messageText || (rule ? rule.templateText : ''), patient, svc, r.dueAt)
      const sendRes = await sendWhatsappText(phone, payloadText)
      await prisma.messageLog.create({ data: { ownerId: r.ownerId, reminderId: r.id, toPhone: phone, content: payloadText, providerMessageId: String(sendRes?.id || sendRes?.messageId || ''), status: 'sent', sentAt: new Date() } })
      await prisma.reminder.update({ where: { id: r.id }, data: { status: 'sent', attempts: r.attempts + 1, lastAttemptAt: new Date() } })
    } catch (e) {
      await prisma.messageLog.create({ data: { ownerId: r.ownerId, reminderId: r.id, toPhone: phone, content: r.messageText || '', status: 'failed', error: String(e?.message || e) } })
      await prisma.reminder.update({ where: { id: r.id }, data: { status: 'failed', attempts: r.attempts + 1, lastAttemptAt: new Date() } })
    }
  }
}

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
    const list = await prisma.$queryRaw`SELECT * FROM "Patient" WHERE "ownerId" = ${userId} ORDER BY "createdAt" DESC`
    return list
  } catch (e) {
    console.error('list_failed', e)
    reply.code(500).send({ error: 'list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/patients', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { registroCodigo, whatsappConsent, whatsappOptOutAt, ...data } = req.body || {}
    const created = await prisma.patient.create({ data: { ownerId: userId, ...data } })
    if (typeof whatsappConsent === 'boolean' || whatsappOptOutAt) {
      await prisma.$executeRaw`UPDATE "Patient" SET "whatsappConsent" = ${!!whatsappConsent}, "whatsappOptOutAt" = ${whatsappOptOutAt ? new Date(whatsappOptOutAt) : null} WHERE "id" = ${created.id}`
    }
    const fullRow = await prisma.$queryRaw`SELECT * FROM "Patient" WHERE "id" = ${created.id}`
    return Array.isArray(fullRow) && fullRow[0] ? fullRow[0] : created
  } catch (e) {
    console.error('create_failed', e)
    reply.code(500).send({ error: 'create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.put('/api/patients/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const { registroCodigo, whatsappConsent, whatsappOptOutAt, ...data } = req.body || {}
    const prev = await prisma.patient.findUnique({ where: { id } })
    const updated = await prisma.patient.update({ where: { id }, data })
    if (typeof whatsappConsent === 'boolean' || whatsappOptOutAt !== undefined) {
      await prisma.$executeRaw`UPDATE "Patient" SET "whatsappConsent" = ${whatsappConsent !== undefined ? !!whatsappConsent : null}, "whatsappOptOutAt" = ${whatsappOptOutAt !== undefined ? (whatsappOptOutAt ? new Date(whatsappOptOutAt) : null) : null} WHERE "id" = ${id}`
    }
    try {
      const prevTreat = Array.isArray(prev?.treatments) ? prev.treatments : []
      const nextTreat = Array.isArray(updated?.treatments) ? updated.treatments : []
      const prevIds = new Set(prevTreat.map(t => t.id))
      const newOnes = nextTreat.filter(t => !prevIds.has(t.id) && t.type === 'visit')
      for (const t of newOnes) { await createReminderFromTreatment(userId, updated, t) }
    } catch {}
    const fullRow = await prisma.$queryRaw`SELECT * FROM "Patient" WHERE "id" = ${id}`
    return Array.isArray(fullRow) && fullRow[0] ? fullRow[0] : updated
  } catch (e) {
    console.error('update_failed', e)
    reply.code(500).send({ error: 'update_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/patients/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const patient = await prisma.patient.findUnique({ where: { id } })
    if (!patient || patient.ownerId !== userId) return reply.code(404).send({ error: 'patient_not_found' })
    const reminders = await prisma.reminder.findMany({ where: { patientId: id }, select: { id: true } })
    const reminderIds = reminders.map(r => r.id)
    if (reminderIds.length) {
      await prisma.messageLog.deleteMany({ where: { reminderId: { in: reminderIds } } })
    }
    await prisma.reminder.deleteMany({ where: { patientId: id } })
    await prisma.appointment.deleteMany({ where: { patientId: id } })
    await prisma.controlSchedule.deleteMany({ where: { patientId: id } })
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
    const from = process.env.RESEND_FROM || 'soporte@odontokaren.site'
    const r = await resend.emails.send({ from, to, subject: subject || 'OdontoKaren', html: html || '', attachments })
    return { ok: true, id: r?.id || null }
  } catch (e) {
    console.error('send_email_failed', e)
    reply.code(500).send({ error: 'send_email_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/appointments', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const rows = await prisma.appointment.findMany({ where: { ownerId: userId }, orderBy: { startAt: 'desc' } })
    return rows
  } catch (e) {
    console.error('appointments_list_failed', e)
    reply.code(500).send({ error: 'appointments_list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/appointments', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { patientId, serviceId, title, startAt, endAt, notes } = req.body || {}
    if (!patientId || !title || !startAt) return reply.code(400).send({ error: 'invalid_payload' })
    const patient = await prisma.patient.findFirst({ where: { id: patientId, ownerId: userId } })
    if (!patient) return reply.code(400).send({ error: 'patient_not_found' })
    let svcId = null
    if (serviceId && String(serviceId).trim().length > 0) {
      const svc = await prisma.service.findFirst({ where: { id: String(serviceId).trim(), ownerId: userId } })
      if (!svc) return reply.code(400).send({ error: 'service_not_found' })
      svcId = svc.id
    }
    const created = await prisma.appointment.create({ data: { ownerId: userId, patientId, serviceId: svcId, title, startAt: new Date(startAt), endAt: endAt ? new Date(endAt) : null, status: 'scheduled', notes: notes || null } })
    return created
  } catch (e) {
    console.error('appointments_create_failed', e)
    reply.code(500).send({ error: 'appointments_create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/control-schedules', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const rows = await prisma.controlSchedule.findMany({ where: { ownerId: userId }, orderBy: { nextAt: 'asc' } })
    return rows
  } catch (e) {
    console.error('controls_list_failed', e)
    reply.code(500).send({ error: 'controls_list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/control-schedules', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { patientId, serviceId, frequency, hour, firstAt, notes } = req.body || {}
    const patient = await prisma.patient.findFirst({ where: { id: String(patientId || ''), ownerId: userId } })
    if (!patient) return reply.code(400).send({ error: 'patient_not_found' })
    let svc = null
    if (serviceId) {
      svc = await prisma.service.findFirst({ where: { id: String(serviceId), ownerId: userId } })
      if (!svc) return reply.code(400).send({ error: 'service_not_found' })
    }
    const freq = String(frequency || 'monthly')
    if (!FREQ_MONTHS[freq]) return reply.code(400).send({ error: 'invalid_frequency' })
    const h = Number(hour ?? 10)
    const nextAt = firstAt ? new Date(firstAt) : new Date()
    nextAt.setHours(h, 0, 0, 0)
    const created = await prisma.controlSchedule.create({ data: { ownerId: userId, patientId: patient.id, serviceId: svc?.id || null, frequency: freq, hour: h, nextAt, status: 'active', notes: notes || null } })
    const title = `Control ${svc?.name ? `• ${svc.name}` : ''}`.trim()
    await prisma.appointment.create({ data: { ownerId: userId, patientId: patient.id, serviceId: svc?.id || null, title: title || 'Control', startAt: nextAt, endAt: null, status: 'scheduled', notes: notes || null } })
    // actualizar siguiente
    const next = new Date(nextAt)
    next.setMonth(next.getMonth() + FREQ_MONTHS[freq])
    await prisma.controlSchedule.update({ where: { id: created.id }, data: { nextAt: next } })
    return created
  } catch (e) {
    console.error('controls_create_failed', e)
    reply.code(500).send({ error: 'controls_create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/control-schedules/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    await prisma.controlSchedule.delete({ where: { id } })
    return { ok: true }
  } catch (e) {
    console.error('controls_delete_failed', e)
    reply.code(500).send({ error: 'controls_delete_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.put('/api/appointments/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const { title, startAt, endAt, status, notes, serviceId } = req.body || {}
    const prev = await prisma.appointment.findUnique({ where: { id } })
    let nextServiceId = serviceId ?? prev.serviceId
    if (nextServiceId && String(nextServiceId).trim().length > 0) {
      const svc = await prisma.service.findFirst({ where: { id: String(nextServiceId).trim(), ownerId: prev.ownerId } })
      if (!svc) return reply.code(400).send({ error: 'service_not_found' })
      nextServiceId = svc.id
    } else {
      nextServiceId = null
    }
    const updated = await prisma.appointment.update({ where: { id }, data: { title, startAt: startAt ? new Date(startAt) : prev.startAt, endAt: endAt ? new Date(endAt) : prev.endAt, status: status || prev.status, notes: notes ?? prev.notes, serviceId: nextServiceId } })
    if (prev.status !== 'completed' && updated.status === 'completed') {
      const patient = await prisma.patient.findUnique({ where: { id: updated.patientId } })
      const service = updated.serviceId ? await prisma.service.findUnique({ where: { id: updated.serviceId } }) : null
      await createReminderFromService(userId, patient, service, updated.endAt || updated.startAt, updated.id)
    }
    return updated
  } catch (e) {
    console.error('appointments_update_failed', e)
    reply.code(500).send({ error: 'appointments_update_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/appointments/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    await prisma.appointment.delete({ where: { id } })
    return { ok: true }
  } catch (e) {
    console.error('appointments_delete_failed', e)
    reply.code(500).send({ error: 'appointments_delete_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/reminder-rules', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const rows = await prisma.reminderRule.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } })
    return rows
  } catch (e) {
    console.error('rules_list_failed', e)
    reply.code(500).send({ error: 'rules_list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/reminder-rules', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { serviceId, matchKeywords, delayDays, templateText, enabled, hourStart, hourEnd, daysOfWeek } = req.body || {}
    let svcId = null
    if (serviceId && String(serviceId).trim().length > 0) {
      const svc = await prisma.service.findFirst({ where: { id: String(serviceId).trim(), ownerId: userId } })
      if (!svc) return reply.code(400).send({ error: 'service_not_found' })
      svcId = svc.id
      const exists = await prisma.reminderRule.findFirst({ where: { ownerId: userId, serviceId: svcId } })
      if (exists) return reply.code(409).send({ error: 'rule_already_exists' })
    }
    const created = await prisma.reminderRule.create({ data: { ownerId: userId, serviceId: svcId, matchKeywords: matchKeywords || [], delayDays: Number(delayDays || 0), templateText: String(templateText || ''), enabled: enabled !== false, hourStart: Number(hourStart ?? 9), hourEnd: Number(hourEnd ?? 19), daysOfWeek: daysOfWeek || [] } })
    return created
  } catch (e) {
    console.error('rules_create_failed', e)
    reply.code(500).send({ error: 'rules_create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.put('/api/reminder-rules/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const { serviceId, matchKeywords, delayDays, templateText, enabled, hourStart, hourEnd, daysOfWeek } = req.body || {}
    let nextServiceId = serviceId
    if (nextServiceId !== undefined) {
      if (nextServiceId && String(nextServiceId).trim().length > 0) {
        const svc = await prisma.service.findFirst({ where: { id: String(nextServiceId).trim(), ownerId: userId } })
        if (!svc) return reply.code(400).send({ error: 'service_not_found' })
        nextServiceId = svc.id
        const other = await prisma.reminderRule.findFirst({ where: { ownerId: userId, serviceId: nextServiceId } })
        if (other && other.id !== id) return reply.code(409).send({ error: 'rule_already_exists' })
      } else {
        nextServiceId = null
      }
    }
    const updated = await prisma.reminderRule.update({ where: { id }, data: { serviceId: nextServiceId ?? undefined, matchKeywords: matchKeywords ?? undefined, delayDays: delayDays !== undefined ? Number(delayDays) : undefined, templateText: templateText !== undefined ? String(templateText) : undefined, enabled: enabled !== undefined ? !!enabled : undefined, hourStart: hourStart !== undefined ? Number(hourStart) : undefined, hourEnd: hourEnd !== undefined ? Number(hourEnd) : undefined, daysOfWeek: daysOfWeek ?? undefined } })
    return updated
  } catch (e) {
    console.error('rules_update_failed', e)
    reply.code(500).send({ error: 'rules_update_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/reminder-rules/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    await prisma.reminderRule.delete({ where: { id } })
    return { ok: true }
  } catch (e) {
    console.error('rules_delete_failed', e)
    reply.code(500).send({ error: 'rules_delete_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/reminders', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const rows = await prisma.reminder.findMany({ where: { ownerId: userId }, orderBy: { dueAt: 'asc' } })
    return rows
  } catch (e) {
    console.error('reminders_list_failed', e)
    reply.code(500).send({ error: 'reminders_list_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/reminders', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { patientId, appointmentId, serviceId, dueAt, messageText, channel } = req.body || {}
    if (!patientId) return reply.code(400).send({ error: 'patient_required' })
    if (!dueAt) return reply.code(400).send({ error: 'dueAt_required' })
    const patient = await prisma.patient.findFirst({ where: { id: String(patientId), ownerId: userId } })
    if (!patient) return reply.code(404).send({ error: 'patient_not_found' })
    let svcId = null
    if (serviceId) {
      const svc = await prisma.service.findFirst({ where: { id: String(serviceId), ownerId: userId } })
      if (!svc) return reply.code(400).send({ error: 'service_not_found' })
      svcId = svc.id
    }
    let apptId = null
    if (appointmentId) {
      const appt = await prisma.appointment.findFirst({ where: { id: String(appointmentId), ownerId: userId } })
      if (!appt) return reply.code(400).send({ error: 'appointment_not_found' })
      apptId = appt.id
    }
    const created = await prisma.reminder.create({ data: { ownerId: userId, patientId: patient.id, appointmentId: apptId, serviceId: svcId, dueAt: new Date(dueAt), status: 'pending', attempts: 0, channel: channel || 'whatsapp', messageText: messageText || null } })
    return created
  } catch (e) {
    console.error('reminders_create_failed', e)
    reply.code(500).send({ error: 'reminders_create_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.delete('/api/reminders/:id', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const r = await prisma.reminder.findUnique({ where: { id } })
    if (!r || r.ownerId !== userId) return reply.code(404).send({ error: 'reminder_not_found' })
    await prisma.messageLog.deleteMany({ where: { reminderId: id } })
    await prisma.reminder.delete({ where: { id } })
    return { ok: true }
  } catch (e) {
    console.error('reminder_delete_failed', e)
    reply.code(500).send({ error: 'reminder_delete_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/reminders/:id/send-now', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { id } = req.params
    const r = await prisma.reminder.findUnique({ where: { id } })
    if (!r || r.ownerId !== userId) return reply.code(404).send({ error: 'reminder_not_found' })
    const rows = await prisma.$queryRaw`SELECT * FROM "Patient" WHERE "id" = ${r.patientId}`
    const patient = Array.isArray(rows) && rows[0] ? rows[0] : null
    if (!patient) return reply.code(404).send({ error: 'patient_not_found' })
    if (patient.whatsappOptOutAt) return reply.code(400).send({ error: 'opted_out' })
    if (!patient.whatsappConsent) return reply.code(400).send({ error: 'no_consent' })
    const phone = ensureE164(patient.telefono)
    if (!phone) return reply.code(400).send({ error: 'invalid_phone' })
    const svc = await prisma.service.findUnique({ where: { id: r.serviceId || '' } }).catch(() => null)
    const rule = r.serviceId ? await prisma.reminderRule.findFirst({ where: { ownerId: r.ownerId, serviceId: r.serviceId, enabled: true } }) : null
    const payloadText = renderTemplateText(r.messageText || (rule ? rule.templateText : ''), patient, svc, r.dueAt)
    const sendRes = await sendWhatsappText(phone, payloadText)
    await prisma.messageLog.create({ data: { ownerId: r.ownerId, reminderId: r.id, toPhone: phone, content: payloadText, providerMessageId: String(sendRes?.id || sendRes?.messageId || ''), status: 'sent', sentAt: new Date() } })
    const updated = await prisma.reminder.update({ where: { id }, data: { status: 'sent', attempts: r.attempts + 1, lastAttemptAt: new Date() } })
    return updated
  } catch (e) {
    console.error('reminders_send_now_failed', e)
    reply.code(500).send({ error: 'reminders_send_now_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.post('/api/reminders/process-due', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    await processDueReminders()
    return { ok: true }
  } catch (e) {
    console.error('reminders_process_failed', e)
    reply.code(500).send({ error: 'reminders_process_failed', code: e?.code || 'UNKNOWN' })
  }
})

app.get('/api/message-logs', async (req, reply) => {
  const userId = authenticate(req, reply); if (!userId) return
  try {
    const { reminderId } = req.query || {}
    const where = { ownerId: userId }
    if (reminderId) where.reminderId = String(reminderId)
    const rows = await prisma.messageLog.findMany({ where, orderBy: { createdAt: 'desc' } })
    return rows
  } catch (e) {
    console.error('message_logs_failed', e)
    reply.code(500).send({ error: 'message_logs_failed', code: e?.code || 'UNKNOWN' })
  }
})

// Webhook de WAZEND para estados de mensajes y eventos entrantes
app.post('/api/wazend/webhook', async (req, reply) => {
  try {
    const body = req.body || {}
    const pid = String(body.messageId || body.id || (body.message && body.message.id) || '')
    const statusRaw = String(body.status || body.event || body.type || '').toLowerCase()
    const status = ['queued','sent','delivered','read','failed'].includes(statusRaw) ? statusRaw : undefined
    const toPhone = String(body.to || body.phone || body.toPhone || '')
    const content = typeof body.text === 'string' ? body.text : (typeof body.content === 'string' ? body.content : JSON.stringify(body))
    if (!pid) { reply.send({ ok: true }); return }
    const log = await prisma.messageLog.findFirst({ where: { providerMessageId: pid } })
    if (!log) { reply.send({ ok: true }); return }
    const updated = await prisma.messageLog.update({ where: { id: log.id }, data: { status: status ?? log.status, toPhone: toPhone || log.toPhone, error: body.error ? String(body.error) : log.error, sentAt: (status === 'sent' || status === 'delivered') ? new Date() : log.sentAt, content } })
    if (updated.reminderId) {
      if (status === 'failed') { await prisma.reminder.update({ where: { id: updated.reminderId }, data: { status: 'failed' } }) }
      if (status === 'sent' || status === 'delivered') { await prisma.reminder.update({ where: { id: updated.reminderId }, data: { status: 'sent' } }) }
    }
    reply.send({ ok: true })
  } catch (e) {
    console.error('wazend_webhook_failed', e)
    reply.code(500).send({ error: 'wazend_webhook_failed' })
  }
})

setInterval(() => { processDueReminders().catch(() => {}) }, 60000)
setInterval(async () => {
  try {
    const now = new Date()
    const due = await prisma.controlSchedule.findMany({ where: { status: 'active', nextAt: { lte: now } } })
    for (const c of due) {
      const patient = await prisma.patient.findUnique({ where: { id: c.patientId } })
      const svc = c.serviceId ? await prisma.service.findUnique({ where: { id: c.serviceId } }) : null
      const title = `Control ${svc?.name ? `• ${svc.name}` : ''}`.trim()
      await prisma.appointment.create({ data: { ownerId: c.ownerId, patientId: c.patientId, serviceId: c.serviceId || null, title: title || 'Control', startAt: c.nextAt, endAt: null, status: 'scheduled' } })
      const next = new Date(c.nextAt)
      next.setMonth(next.getMonth() + FREQ_MONTHS[c.frequency] || 1)
      await prisma.controlSchedule.update({ where: { id: c.id }, data: { nextAt: next } })
    }
  } catch (e) { }
}, 60000)
const addr = await app.listen({ port: process.env.PORT ? Number(process.env.PORT) : 4000, host: '0.0.0.0' })
console.log('listening', addr)
