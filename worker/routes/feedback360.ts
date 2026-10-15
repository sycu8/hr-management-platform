import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { runWorkersAiViaGateway } from '../lib/ai-gateway.ts'
import {
  normalizeFeedback,
  ROLE_KEYS,
  ROLE_LABEL,
  type RoleKey,
} from '../lib/feedback360.ts'
import { apiError, badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type Row = {
  id: string
  employee_id: string
  period: string
  competencies_json: string
  scores_json: string
  comments_json: string | null
  ai_analysis: string | null
  ai_analyzed_at: string | null
  updated_at: string | null
  updated_by: string | null
  employee_name: string
  employee_code: string
  department: string
  title: string
}

const scoreMapSchema = z.record(
  z.string(),
  z.union([z.number().min(0).max(5), z.array(z.number().min(0).max(5))]),
)

const upsertSchema = z.object({
  employee_id: z.string().min(1),
  period: z.string().min(1).max(40),
  competencies: z.array(z.string().min(1).max(80)).min(3).max(12),
  scores: scoreMapSchema,
  comments: z
    .record(z.string(), z.string().max(2000))
    .optional()
    .default({}),
})

const feedback = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

feedback.use('*', requireAuth)

function isElevated(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

function enrich(row: Row) {
  const normalized = normalizeFeedback({
    competencies_json: row.competencies_json,
    scores_json: row.scores_json,
    comments_json: row.comments_json,
  })
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_code: row.employee_code,
    employee_name: row.employee_name,
    department: row.department,
    title: row.title,
    period: row.period,
    competencies: normalized.competencies,
    scores: normalized.byRole,
    role_avg: normalized.roleAvg,
    competency_avg: normalized.competencyAvg,
    overall: normalized.overall,
    overall_pct:
      normalized.overall == null
        ? null
        : Math.round((normalized.overall / 5) * 100),
    comments: normalized.comments,
    ai_analysis: row.ai_analysis,
    ai_analyzed_at: row.ai_analyzed_at,
    updated_at: row.updated_at,
    chart: {
      radar: normalized.competencies.map((label, i) => ({
        label,
        self: normalized.byRole.self[i] ?? null,
        mgr: normalized.byRole.mgr[i] ?? null,
        peer: normalized.byRole.peer[i] ?? null,
        report: normalized.byRole.report[i] ?? null,
        avg: normalized.competencyAvg[i] ?? 0,
      })),
      roles: ROLE_KEYS.map((role) => ({
        role,
        label: ROLE_LABEL[role],
        avg: normalized.roleAvg[role],
      })),
    },
  }
}

const SELECT = `SELECT f.id, f.employee_id, f.period, f.competencies_json, f.scores_json,
            f.comments_json, f.ai_analysis, f.ai_analyzed_at, f.updated_at, f.updated_by,
            e.full_name AS employee_name, e.code AS employee_code,
            e.department, e.title
     FROM feedback_360 f
     JOIN employees e ON e.id = f.employee_id`

feedback.get('/', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const period = c.req.query('period')
  const { results } = await c.env.DB.prepare(
    `${SELECT}
     WHERE f.organization_id = ?
       AND (? IS NULL OR f.period = ?)
     ORDER BY f.period DESC, e.code`,
  )
    .bind(user.organizationId, period ?? null, period ?? null)
    .all<Row>()

  return json(c, {
    items: (results ?? []).map(enrich),
    roles: ROLE_KEYS.map((r) => ({ role: r, label: ROLE_LABEL[r] })),
  })
})

feedback.get('/:id', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `${SELECT}
     WHERE f.organization_id = ? AND f.id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first<Row>()
  if (!row) return notFound(c, 'Feedback not found')
  return json(c, { item: enrich(row) })
})

feedback.post('/', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  if (!isElevated(user) && !user.employeeId) {
    return forbidden(c, 'Không có quyền thêm đánh giá')
  }

  let body: z.infer<typeof upsertSchema>
  try {
    body = upsertSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid 360 payload')
  }

  // Non-admin may only submit as self scores for themselves
  if (!isElevated(user)) {
    if (body.employee_id !== user.employeeId) {
      return forbidden(c, 'Chỉ được đánh giá / cập nhật hồ sơ của mình')
    }
  }

  const emp = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, body.employee_id)
    .first()
  if (!emp) return notFound(c, 'Employee not found')

  const existing = await c.env.DB.prepare(
    `SELECT id FROM feedback_360
     WHERE organization_id = ? AND employee_id = ? AND period = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, body.employee_id, body.period)
    .first<{ id: string }>()

  const now = new Date().toISOString()
  const competenciesJson = JSON.stringify(body.competencies)
  const scoresJson = JSON.stringify(body.scores)
  const commentsJson = JSON.stringify(body.comments ?? {})

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE feedback_360
       SET competencies_json = ?, scores_json = ?, comments_json = ?,
           ai_analysis = NULL, ai_analyzed_at = NULL,
           updated_at = ?, updated_by = ?
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(
        competenciesJson,
        scoresJson,
        commentsJson,
        now,
        user.id,
        existing.id,
        user.organizationId,
      )
      .run()

    await writeAuditEvent(c.env.DB, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.accountType,
      actorEmail: user.email,
      action: 'feedback360.update',
      entityType: 'feedback_360',
      entityId: existing.id,
      detail: `Updated 360 ${body.period}`,
    })

    return json(c, { id: existing.id, updated: true })
  }

  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO feedback_360 (
       id, organization_id, employee_id, period, competencies_json, scores_json,
       comments_json, updated_at, updated_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.employee_id,
      body.period,
      competenciesJson,
      scoresJson,
      commentsJson,
      now,
      user.id,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'feedback360.create',
    entityType: 'feedback_360',
    entityId: id,
    detail: `Created 360 ${body.period}`,
  })

  return json(c, { id, updated: false }, 201)
})

/** AI analysis via Workers AI + AI Gateway. */
feedback.post('/:id/analyze', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    `${SELECT}
     WHERE f.organization_id = ? AND f.id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<Row>()
  if (!row) return notFound(c, 'Feedback not found')

  const item = enrich(row)
  const roleLines = ROLE_KEYS.map((role) => {
    const avg = item.role_avg[role]
    const comment = item.comments[role as RoleKey]
    return `- ${ROLE_LABEL[role]}: ${avg == null ? 'chưa có' : avg.toFixed(2)}/5${
      comment ? ` | Nhận xét: ${comment}` : ''
    }`
  }).join('\n')

  const competencyLines = item.chart.radar
    .map(
      (r) =>
        `- ${r.label}: TB ${r.avg.toFixed(2)} (self ${r.self ?? '—'}, QL ${r.mgr ?? '—'}, peer ${r.peer ?? '—'}, cấp dưới ${r.report ?? '—'})`,
    )
    .join('\n')

  const system = `Bạn là chuyên gia nhân sự (HR BP) tại công ty Việt Nam.
Phân tích đánh giá 360 độ ngắn gọn, khách quan, tiếng Việt.
Trả về đúng cấu trúc Markdown với các mục:
## Tóm tắt
## Điểm mạnh
## Điểm cần cải thiện
## Khoảng lệch giữa các chiều (self vs quản lý/đồng nghiệp)
## Gợi ý phát triển 90 ngày
Không bịa số liệu ngoài dữ liệu được cung cấp.`

  const userPrompt = `Nhân viên: ${item.employee_name} (${item.employee_code}) — ${item.title}, ${item.department}
Kỳ: ${item.period}
Điểm tổng: ${item.overall?.toFixed(2) ?? 'n/a'}/5

Điểm theo chiều:
${roleLines}

Điểm theo năng lực:
${competencyLines}`

  try {
    const { text, model, gatewayId } = await runWorkersAiViaGateway(
      c.env,
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1100,
      },
      {
        skipCache: true,
        metadata: {
          feature: 'feedback360',
          feedback_id: id,
          org: user.organizationId,
        },
      },
    )

    const now = new Date().toISOString()
    await c.env.DB.prepare(
      `UPDATE feedback_360
       SET ai_analysis = ?, ai_analyzed_at = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(text, now, now, user.id, id, user.organizationId)
      .run()

    await writeAuditEvent(c.env.DB, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.accountType,
      actorEmail: user.email,
      action: 'feedback360.ai_analyze',
      entityType: 'feedback_360',
      entityId: id,
      detail: `AI analyze via gateway ${gatewayId} model ${model}`,
    })

    return json(c, {
      ok: true,
      analysis: text,
      analyzed_at: now,
      model,
      gateway_id: gatewayId,
    })
  } catch (err) {
    console.error('feedback360_ai_failed', err)
    return apiError(
      c,
      503,
      'ai_unavailable',
      err instanceof Error ? err.message : 'AI analysis failed',
      {
        ai_available: !!c.env.AI,
        gateway_id: c.env.AI_GATEWAY_ID || 'default',
      },
    )
  }
})

export default feedback
