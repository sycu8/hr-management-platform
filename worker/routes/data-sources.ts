import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { badRequest, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireActorSuperAdmin } from '../middleware/rbac.ts'

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.string().min(1).max(80),
  description: z.string().max(2000).optional().default(''),
  enabled: z.boolean().optional().default(false),
  config: z.record(z.string(), z.unknown()).optional().default({}),
})

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  kind: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

const dataSources = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

dataSources.use('*', requireAuth)
dataSources.use('*', requireActorSuperAdmin())

dataSources.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, kind, description, enabled, config_json, updated_at
     FROM data_sources
     WHERE organization_id = ?
     ORDER BY kind, name`,
  )
    .bind(user.organizationId)
    .all()

  const items = (results ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as string,
    description: row.description as string,
    enabled: (row.enabled as number) === 1,
    config: safeJson(row.config_json as string),
    updatedAt: row.updated_at as string,
  }))

  return json(c, { items })
})

dataSources.post('/', async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof upsertSchema>
  try {
    body = upsertSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid data source payload')
  }

  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO data_sources (
       id, organization_id, name, kind, description, enabled, config_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.name,
      body.kind,
      body.description,
      body.enabled ? 1 : 0,
      JSON.stringify(body.config ?? {}),
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'data_source.create',
    entityType: 'data_source',
    entityId: id,
    detail: `Tạo nguồn dữ liệu ${body.name}`,
  })

  return json(c, { id }, 201)
})

dataSources.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid patch payload')
  }

  const existing = await c.env.DB.prepare(
    `SELECT id, name, kind, description, enabled, config_json
     FROM data_sources WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{
      id: string
      name: string
      kind: string
      description: string
      enabled: number
      config_json: string
    }>()

  if (!existing) return notFound(c, 'Data source not found')

  const name = body.name ?? existing.name
  const kind = body.kind ?? existing.kind
  const description = body.description ?? existing.description
  const enabled =
    body.enabled === undefined ? existing.enabled : body.enabled ? 1 : 0
  const configJson =
    body.config === undefined
      ? existing.config_json
      : JSON.stringify(body.config)

  await c.env.DB.prepare(
    `UPDATE data_sources
     SET name = ?, kind = ?, description = ?, enabled = ?, config_json = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(name, kind, description, enabled, configJson, id, user.organizationId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'data_source.update',
    entityType: 'data_source',
    entityId: id,
    detail: `Cập nhật nguồn dữ liệu ${name} (enabled=${enabled === 1})`,
  })

  return json(c, { ok: true })
})

dataSources.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    `SELECT id, name FROM data_sources WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; name: string }>()

  if (!existing) return notFound(c, 'Data source not found')

  await c.env.DB.prepare(
    `DELETE FROM data_sources WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, user.organizationId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'data_source.delete',
    entityType: 'data_source',
    entityId: id,
    detail: `Xóa nguồn dữ liệu ${existing.name}`,
  })

  return json(c, { ok: true })
})

function safeJson(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export default dataSources
