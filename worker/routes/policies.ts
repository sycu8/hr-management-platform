import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import {
  extractMarkdownFromR2Object,
  extractPolicyFieldsFromText,
  markdownToSections,
} from '../lib/policy-ocr.ts'
import {
  policyAttachmentKey,
  putDocumentBytes,
  r2ObjectResponse,
} from '../lib/r2.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const CATEGORIES = ['Quy định', 'Quy trình', 'Pháp lý'] as const
const STATUSES = ['draft', 'active', 'expired', 'archived'] as const

const sectionSchema = z.object({
  h: z.string().min(1).max(200),
  b: z.string().max(20_000),
})

const bodyJsonSchema = z.object({
  sections: z.array(sectionSchema).max(80).default([]),
  ocr_source_attachment_id: z.string().optional(),
  ocr_at: z.string().optional(),
})

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

const policyFieldsSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  code: z.string().min(1).max(64).optional(),
  title: z.string().min(1).max(300).optional(),
  version: z.string().max(40).nullable().optional(),
  policy_type: z.string().max(80).nullable().optional(),
  effective_from: dateStr,
  effective_to: dateStr,
  status: z.enum(STATUSES).optional(),
  applicable_departments: z.string().max(500).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  content_text: z.string().max(100_000).nullable().optional(),
  owner_name: z.string().max(200).nullable().optional(),
  owner_user_id: z.string().max(64).nullable().optional(),
  last_reviewed_at: dateStr,
  body_json: bodyJsonSchema.optional(),
})

const createPolicySchema = policyFieldsSchema.extend({
  category: z.enum(CATEGORIES),
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
})

type PolicyRow = {
  id: string
  category: string
  code: string
  title: string
  version: string | null
  policy_type: string | null
  effective_from: string | null
  effective_to: string | null
  status: string
  applicable_departments: string | null
  summary: string | null
  content_text: string | null
  body_json: string
  file_name: string | null
  content_type: string | null
  size_bytes: number
  r2_key: string | null
  owner_name: string | null
  owner_user_id: string | null
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

type AttachmentRow = {
  id: string
  policy_id: string
  file_name: string
  content_type: string | null
  size_bytes: number
  r2_key: string
  uploaded_by: string | null
  ocr_status: string
  ocr_error: string | null
  created_at: string
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const policies = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

policies.use('*', requireAuth)

function isHrAdmin(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

function parseBodyJson(raw: string): z.infer<typeof bodyJsonSchema> {
  try {
    const result = bodyJsonSchema.safeParse(JSON.parse(raw) as unknown)
    if (result.success) return result.data
  } catch {
    /* ignore */
  }
  return { sections: [] }
}

const POLICY_COLS = `id, category, code, title, version, policy_type, effective_from,
  effective_to, status, applicable_departments, summary, content_text, body_json,
  file_name, content_type, size_bytes, r2_key, owner_name, owner_user_id,
  last_reviewed_at, created_at, updated_at`

async function loadPolicy(
  db: D1Database,
  organizationId: string,
  id: string,
): Promise<PolicyRow | null> {
  return db
    .prepare(
      `SELECT ${POLICY_COLS}
       FROM policy_documents
       WHERE organization_id = ? AND id = ?
       LIMIT 1`,
    )
    .bind(organizationId, id)
    .first<PolicyRow>()
}

function toClient(row: PolicyRow) {
  return { ...row, body: parseBodyJson(row.body_json) }
}

policies.get('/', requireModule('pol', 1), async (c) => {
  const user = c.get('user')
  const category = c.req.query('category')
  const { results } = await c.env.DB.prepare(
    category
      ? `SELECT p.id, p.category, p.code, p.title, p.version, p.policy_type,
                p.effective_from, p.effective_to, p.status,
                p.applicable_departments, p.summary, p.file_name, p.r2_key,
                p.owner_name, p.last_reviewed_at, p.updated_at,
                (SELECT COUNT(*) FROM policy_attachments a
                 WHERE a.policy_id = p.id) AS attachment_count
         FROM policy_documents p
         WHERE p.organization_id = ? AND p.category = ?
         ORDER BY p.code`
      : `SELECT p.id, p.category, p.code, p.title, p.version, p.policy_type,
                p.effective_from, p.effective_to, p.status,
                p.applicable_departments, p.summary, p.file_name, p.r2_key,
                p.owner_name, p.last_reviewed_at, p.updated_at,
                (SELECT COUNT(*) FROM policy_attachments a
                 WHERE a.policy_id = p.id) AS attachment_count
         FROM policy_documents p
         WHERE p.organization_id = ?
         ORDER BY p.category, p.code`,
  )
    .bind(...(category ? [user.organizationId, category] : [user.organizationId]))
    .all()
  return json(c, { items: results ?? [] })
})

policies.get(
  '/attachments/:attachmentId/download',
  requireModule('pol', 1),
  async (c) => {
    const user = c.get('user')
    const row = await c.env.DB.prepare(
      `SELECT id, file_name, r2_key FROM policy_attachments
       WHERE organization_id = ? AND id = ? LIMIT 1`,
    )
      .bind(user.organizationId, c.req.param('attachmentId'))
      .first<{ id: string; file_name: string; r2_key: string }>()
    if (!row) return notFound(c, 'Attachment not found')
    const object = await c.env.DOCUMENTS.get(row.r2_key)
    if (!object) return notFound(c, 'File missing in R2')
    const disposition =
      c.req.query('disposition') === 'attachment' ? 'attachment' : 'inline'
    return r2ObjectResponse(object, row.file_name, disposition)
  },
)

policies.delete(
  '/attachments/:attachmentId',
  requireModule('pol', 2),
  async (c) => {
    const user = c.get('user')
    if (!isHrAdmin(user)) return forbidden(c, 'Forbidden')
    const attachmentId = c.req.param('attachmentId')
    const row = await c.env.DB.prepare(
      `SELECT id, r2_key, policy_id, file_name FROM policy_attachments
       WHERE organization_id = ? AND id = ? LIMIT 1`,
    )
      .bind(user.organizationId, attachmentId)
      .first<{
        id: string
        r2_key: string
        policy_id: string
        file_name: string
      }>()
    if (!row) return notFound(c, 'Attachment not found')
    try {
      await c.env.DOCUMENTS.delete(row.r2_key)
    } catch (err) {
      console.warn('r2_delete_failed', row.r2_key, err)
    }
    await c.env.DB.prepare(
      `DELETE FROM policy_attachments WHERE organization_id = ? AND id = ?`,
    )
      .bind(user.organizationId, attachmentId)
      .run()

    const primary = await c.env.DB.prepare(
      `SELECT r2_key FROM policy_documents
       WHERE organization_id = ? AND id = ?`,
    )
      .bind(user.organizationId, row.policy_id)
      .first<{ r2_key: string | null }>()
    if (primary?.r2_key === row.r2_key) {
      await c.env.DB.prepare(
        `UPDATE policy_documents
         SET file_name = NULL, content_type = NULL, size_bytes = 0, r2_key = NULL,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND organization_id = ?`,
      )
        .bind(row.policy_id, user.organizationId)
        .run()
    }

    await writeAuditEvent(c.env.DB, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.accountType,
      actorEmail: user.email,
      action: 'policy.attachment.delete',
      entityType: 'policy_attachments',
      entityId: attachmentId,
      detail: `Deleted ${row.file_name} (${row.r2_key})`,
    })
    return json(c, { ok: true })
  },
)

policies.post(
  '/attachments/:attachmentId/ocr',
  requireModule('pol', 2),
  async (c) => {
    const user = c.get('user')
    if (!isHrAdmin(user)) return forbidden(c, 'Forbidden')
    const attachmentId = c.req.param('attachmentId')
    const apply =
      c.req.query('apply') !== '0' && c.req.query('apply') !== 'false'

    const att = await c.env.DB.prepare(
      `SELECT id, policy_id, file_name, content_type, r2_key
       FROM policy_attachments
       WHERE organization_id = ? AND id = ? LIMIT 1`,
    )
      .bind(user.organizationId, attachmentId)
      .first<{
        id: string
        policy_id: string
        file_name: string
        content_type: string | null
        r2_key: string
      }>()
    if (!att) return notFound(c, 'Attachment not found')

    await c.env.DB.prepare(
      `UPDATE policy_attachments SET ocr_status = 'pending', ocr_error = NULL
       WHERE id = ?`,
    )
      .bind(attachmentId)
      .run()

    const object = await c.env.DOCUMENTS.get(att.r2_key)
    if (!object) {
      await c.env.DB.prepare(
        `UPDATE policy_attachments SET ocr_status = 'failed', ocr_error = ?
         WHERE id = ?`,
      )
        .bind('File missing in R2', attachmentId)
        .run()
      return notFound(c, 'File missing in R2')
    }

    const mime =
      att.content_type ||
      object.httpMetadata?.contentType ||
      'application/octet-stream'
    const buffer = await object.arrayBuffer()

    const extractedDoc = await extractMarkdownFromR2Object(
      c.env.AI,
      att.file_name,
      mime,
      buffer,
    )
    const markdown = extractedDoc.markdown
    const method = extractedDoc.method
    const note = extractedDoc.note

    if (!markdown.trim() && method === 'unavailable') {
      await c.env.DB.prepare(
        `UPDATE policy_attachments SET ocr_status = 'failed', ocr_error = ?
         WHERE id = ?`,
      )
        .bind((note ?? 'OCR unavailable').slice(0, 500), attachmentId)
        .run()
      // Still return 200 so UI can keep the file and let user paste/fill manually.
      return json(c, {
        method,
        markdown: '',
        sections: [],
        extracted: extractPolicyFieldsFromText(''),
        applied: false,
        note,
        policy: null,
        ai_available: !!c.env.AI,
      })
    }

    const sections = markdownToSections(markdown)
    const fieldGuess = extractPolicyFieldsFromText(markdown)
    const summaryGuess =
      fieldGuess.summary ??
      sections[0]?.b?.split('\n').find((l) => l.trim())?.slice(0, 400) ??
      null

    await c.env.DB.prepare(
      `UPDATE policy_attachments SET ocr_status = 'done', ocr_error = NULL
       WHERE id = ?`,
    )
      .bind(attachmentId)
      .run()

    let policy = await loadPolicy(c.env.DB, user.organizationId, att.policy_id)
    if (!policy) return notFound(c, 'Policy not found')

    if (apply && markdown.trim()) {
      const body = {
        sections,
        ocr_source_attachment_id: attachmentId,
        ocr_at: new Date().toISOString(),
      }
      const nextSummary = policy.summary?.trim()
        ? policy.summary
        : summaryGuess
      await c.env.DB.prepare(
        `UPDATE policy_documents
         SET body_json = ?, content_text = ?,
             summary = COALESCE(?, summary),
             code = CASE WHEN trim(COALESCE(code,'')) = '' OR code LIKE 'OCR-%'
               THEN COALESCE(?, code) ELSE code END,
             title = CASE WHEN title LIKE 'OCR %' OR title LIKE 'Draft %'
               THEN COALESCE(?, title) ELSE title END,
             policy_type = COALESCE(policy_type, ?),
             version = COALESCE(version, ?),
             effective_from = COALESCE(effective_from, ?),
             effective_to = COALESCE(effective_to, ?),
             owner_name = COALESCE(owner_name, ?),
             applicable_departments = COALESCE(applicable_departments, ?),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND organization_id = ?`,
      )
        .bind(
          JSON.stringify(body),
          markdown.slice(0, 100_000),
          nextSummary,
          fieldGuess.code,
          fieldGuess.title,
          fieldGuess.policy_type,
          fieldGuess.version,
          fieldGuess.effective_from,
          fieldGuess.effective_to,
          fieldGuess.owner_name,
          fieldGuess.applicable_departments,
          att.policy_id,
          user.organizationId,
        )
        .run()

      await writeAuditEvent(c.env.DB, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        actorRole: user.accountType,
        actorEmail: user.email,
        action: 'policy.ocr.apply',
        entityType: 'policy_attachments',
        entityId: attachmentId,
        detail: `OCR via ${method}; applied ${sections.length} sections`,
      })
      policy = await loadPolicy(c.env.DB, user.organizationId, att.policy_id)
    }

    return json(c, {
      method,
      markdown,
      sections,
      extracted: fieldGuess,
      applied: apply,
      note,
      ai_available: !!c.env.AI,
      policy: policy ? toClient(policy) : null,
    })
  },
)

policies.get('/:id', requireModule('pol', 1), async (c) => {
  const user = c.get('user')
  const row = await loadPolicy(c.env.DB, user.organizationId, c.req.param('id'))
  if (!row) return notFound(c, 'Policy not found')
  const { results: attachments } = await c.env.DB.prepare(
    `SELECT id, policy_id, file_name, content_type, size_bytes, r2_key,
            uploaded_by, ocr_status, ocr_error, created_at
     FROM policy_attachments
     WHERE organization_id = ? AND policy_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(user.organizationId, row.id)
    .all<AttachmentRow>()
  return json(c, { policy: toClient(row), attachments: attachments ?? [] })
})

policies.get('/:id/file', requireModule('pol', 1), async (c) => {
  const user = c.get('user')
  const row = await loadPolicy(c.env.DB, user.organizationId, c.req.param('id'))
  if (!row?.r2_key) return notFound(c, 'No primary file')
  const object = await c.env.DOCUMENTS.get(row.r2_key)
  if (!object) return notFound(c, 'File missing in R2')
  const disposition =
    c.req.query('disposition') === 'attachment' ? 'attachment' : 'inline'
  return r2ObjectResponse(object, row.file_name || 'document', disposition)
})

policies.post('/', requireModule('pol', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Forbidden')
  let body: z.infer<typeof createPolicySchema>
  try {
    body = createPolicySchema.parse(await c.req.json())
  } catch (err) {
    return badRequest(c, 'Invalid policy', err)
  }
  const id = newId()
  const bodyJson = JSON.stringify(body.body_json ?? { sections: [] })
  try {
    await c.env.DB.prepare(
      `INSERT INTO policy_documents (
         id, organization_id, category, code, title, version, policy_type,
         effective_from, effective_to, status, applicable_departments,
         summary, content_text, body_json, owner_name, owner_user_id,
         last_reviewed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.organizationId,
        body.category,
        body.code,
        body.title,
        body.version ?? null,
        body.policy_type ?? null,
        body.effective_from ?? null,
        body.effective_to ?? null,
        body.status ?? 'active',
        body.applicable_departments ?? null,
        body.summary ?? null,
        body.content_text ?? null,
        bodyJson,
        body.owner_name ?? null,
        body.owner_user_id ?? null,
        body.last_reviewed_at ?? null,
      )
      .run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      return badRequest(c, `Duplicate code: ${body.code}`)
    }
    throw err
  }
  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'policy.create',
    entityType: 'policy_documents',
    entityId: id,
    detail: `Created policy ${body.code}`,
  })
  const row = await loadPolicy(c.env.DB, user.organizationId, id)
  return json(c, { policy: toClient(row!) }, 201)
})

policies.patch('/:id', requireModule('pol', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Forbidden')
  const id = c.req.param('id')
  let body: z.infer<typeof policyFieldsSchema>
  try {
    body = policyFieldsSchema.parse(await c.req.json())
  } catch (err) {
    return badRequest(c, 'Invalid policy update', err)
  }
  const existing = await loadPolicy(c.env.DB, user.organizationId, id)
  if (!existing) return notFound(c, 'Policy not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  const keys = [
    'category',
    'code',
    'title',
    'version',
    'policy_type',
    'effective_from',
    'effective_to',
    'status',
    'applicable_departments',
    'summary',
    'content_text',
    'owner_name',
    'owner_user_id',
    'last_reviewed_at',
  ] as const
  for (const key of keys) {
    if (body[key] !== undefined) set(key, body[key])
  }
  if (body.body_json !== undefined) set('body_json', JSON.stringify(body.body_json))
  if (fields.length === 0) return badRequest(c, 'No fields')
  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
  values.push(id, user.organizationId)
  try {
    await c.env.DB.prepare(
      `UPDATE policy_documents SET ${fields.join(', ')}
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(...values)
      .run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      return badRequest(c, `Duplicate code: ${body.code}`)
    }
    throw err
  }
  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'policy.update',
    entityType: 'policy_documents',
    entityId: id,
    detail: `Updated: ${Object.keys(body).join(',')}`,
  })
  const row = await loadPolicy(c.env.DB, user.organizationId, id)
  return json(c, { policy: toClient(row!) })
})

policies.delete('/:id', requireModule('pol', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Forbidden')
  const id = c.req.param('id')
  const existing = await loadPolicy(c.env.DB, user.organizationId, id)
  if (!existing) return notFound(c, 'Policy not found')

  const { results: attachments } = await c.env.DB.prepare(
    `SELECT r2_key FROM policy_attachments
     WHERE organization_id = ? AND policy_id = ?`,
  )
    .bind(user.organizationId, id)
    .all<{ r2_key: string }>()

  const keys = new Set<string>()
  if (existing.r2_key) keys.add(existing.r2_key)
  for (const a of attachments ?? []) keys.add(a.r2_key)
  for (const key of keys) {
    try {
      await c.env.DOCUMENTS.delete(key)
    } catch (err) {
      console.warn('r2_delete_failed', key, err)
    }
  }

  await c.env.DB.prepare(
    `DELETE FROM policy_attachments WHERE organization_id = ? AND policy_id = ?`,
  )
    .bind(user.organizationId, id)
    .run()
  await c.env.DB.prepare(
    `DELETE FROM policy_documents WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'policy.delete',
    entityType: 'policy_documents',
    entityId: id,
    detail: `Deleted policy ${existing.code}`,
  })
  return json(c, { ok: true })
})

/** Upload binary to R2 DOCUMENTS; D1 stores metadata only. */
policies.post('/:id/attachments', requireModule('pol', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Forbidden')
  const policyId = c.req.param('id')
  const policy = await loadPolicy(c.env.DB, user.organizationId, policyId)
  if (!policy) return notFound(c, 'Policy not found')

  const form = await c.req.parseBody({ all: true })
  const raw = form['file']
  const file = Array.isArray(raw) ? raw[0] : raw
  if (!(file instanceof File)) {
    return badRequest(c, 'Missing multipart field "file"')
  }
  if (file.size <= 0) return badRequest(c, 'Empty file')
  if (file.size > MAX_UPLOAD_BYTES) {
    return badRequest(c, `File too large (max ${MAX_UPLOAD_BYTES} bytes)`)
  }
  const contentType = file.type || 'application/octet-stream'
  if (
    contentType !== 'application/octet-stream' &&
    !ALLOWED_MIME.has(contentType)
  ) {
    return badRequest(c, `Unsupported type: ${contentType}`)
  }

  const attachmentId = newId()
  const fileName = file.name || 'document.bin'
  const r2Key = policyAttachmentKey(
    user.organizationId,
    policyId,
    attachmentId,
    fileName,
  )
  const bytes = await file.arrayBuffer()
  await putDocumentBytes(c.env.DOCUMENTS, r2Key, bytes, contentType)

  await c.env.DB.prepare(
    `INSERT INTO policy_attachments (
       id, organization_id, policy_id, file_name, content_type,
       size_bytes, r2_key, uploaded_by, ocr_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none')`,
  )
    .bind(
      attachmentId,
      user.organizationId,
      policyId,
      fileName,
      contentType,
      file.size,
      r2Key,
      user.id,
    )
    .run()

  // Mirror latest upload as primary file metadata on the policy row.
  await c.env.DB.prepare(
    `UPDATE policy_documents
     SET file_name = ?, content_type = ?, size_bytes = ?, r2_key = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(
      fileName,
      contentType,
      file.size,
      r2Key,
      policyId,
      user.organizationId,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'policy.attachment.upload',
    entityType: 'policy_attachments',
    entityId: attachmentId,
    detail: `Uploaded ${fileName} -> R2 ${r2Key}`,
  })

  const attachment = await c.env.DB.prepare(
    `SELECT id, policy_id, file_name, content_type, size_bytes, r2_key,
            uploaded_by, ocr_status, ocr_error, created_at
     FROM policy_attachments WHERE id = ?`,
  )
    .bind(attachmentId)
    .first<AttachmentRow>()

  return json(c, { attachment }, 201)
})

export default policies
