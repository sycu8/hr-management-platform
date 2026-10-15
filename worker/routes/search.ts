import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json, privateCacheHeaders } from '../lib/http.ts'
import {
  employeeIdInClause,
  resolveEmployeeScope,
} from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { getAllModuleLevels } from '../middleware/rbac.ts'

type Hit = {
  kind: 'employee' | 'policy' | 'job' | 'candidate' | 'course' | 'page'
  id: string
  title: string
  subtitle?: string
  path: string
  moduleKey: string
  score: number
}

const search = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

search.use('*', requireAuth)

function like(q: string): string {
  return `%${q.replace(/[%_]/g, '')}%`
}

search.get('/', async (c) => {
  const user = c.get('user')
  const q = (c.req.query('q') ?? '').trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 40)

  if (q.length < 1) {
    return json(c, { q, items: [] as Hit[] })
  }

  const needle = like(q)
  const hits: Hit[] = []
  const levels = await getAllModuleLevels(c.env.DB, user)
  const db = c.env.DB
  const org = user.organizationId

  type BatchSlot =
    | 'employees'
    | 'policies'
    | 'jobs'
    | 'candidates'
    | 'courses'

  const statements: D1PreparedStatement[] = []
  const slots: BatchSlot[] = []

  if (levels.emp >= 1) {
    const scope = await resolveEmployeeScope(db, user)
    if (scope.mode !== 'none') {
      let scopeSql = ''
      const scopeBinds: string[] = []
      if (scope.mode === 'ids') {
        const clause = employeeIdInClause('id', scope)
        scopeSql = clause.sql
        scopeBinds.push(...clause.binds)
      }
      statements.push(
        db
          .prepare(
            `SELECT id, code, full_name, department, title
             FROM employees
             WHERE organization_id = ?
               ${scopeSql}
               AND (code LIKE ? COLLATE NOCASE
                 OR full_name LIKE ? COLLATE NOCASE
                 OR department LIKE ? COLLATE NOCASE
                 OR title LIKE ? COLLATE NOCASE
                 OR ifnull(email,'') LIKE ? COLLATE NOCASE)
             ORDER BY code
             LIMIT 8`,
          )
          .bind(org, ...scopeBinds, needle, needle, needle, needle, needle),
      )
      slots.push('employees')
    }
  }

  if (levels.pol >= 1) {
    statements.push(
      db
        .prepare(
          `SELECT id, code, title, category
           FROM policy_documents
           WHERE organization_id = ?
             AND (code LIKE ? COLLATE NOCASE
               OR title LIKE ? COLLATE NOCASE
               OR ifnull(summary,'') LIKE ? COLLATE NOCASE)
           ORDER BY title
           LIMIT 6`,
        )
        .bind(org, needle, needle, needle),
    )
    slots.push('policies')
  }

  if (levels.rec >= 1) {
    statements.push(
      db
        .prepare(
          `SELECT id, title, department, status
           FROM job_requisitions
           WHERE organization_id = ?
             AND (title LIKE ? COLLATE NOCASE
               OR department LIKE ? COLLATE NOCASE)
           ORDER BY title
           LIMIT 5`,
        )
        .bind(org, needle, needle),
    )
    slots.push('jobs')

    statements.push(
      db
        .prepare(
          `SELECT id, full_name, stage, email
           FROM candidates
           WHERE organization_id = ?
             AND (full_name LIKE ? COLLATE NOCASE
               OR ifnull(email,'') LIKE ? COLLATE NOCASE)
           ORDER BY full_name
           LIMIT 5`,
        )
        .bind(org, needle, needle),
    )
    slots.push('candidates')
  }

  if (levels.learn >= 1) {
    statements.push(
      db
        .prepare(
          `SELECT id, title, course_type, code
           FROM courses
           WHERE organization_id = ?
             AND (title LIKE ? COLLATE NOCASE
               OR ifnull(code,'') LIKE ? COLLATE NOCASE
               OR ifnull(skill,'') LIKE ? COLLATE NOCASE)
           ORDER BY title
           LIMIT 5`,
        )
        .bind(org, needle, needle, needle),
    )
    slots.push('courses')
  }

  const batch =
    statements.length > 0 ? await db.batch(statements) : ([] as D1Result[])

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const rows = batch[i]?.results ?? []

    if (slot === 'employees') {
      for (const r of rows as {
        id: string
        code: string
        full_name: string
        department: string
        title: string
      }[]) {
        hits.push({
          kind: 'employee',
          id: r.id,
          title: `${r.code} · ${r.full_name}`,
          subtitle: `${r.title} · ${r.department}`,
          path: `/employees?highlight=${encodeURIComponent(r.id)}`,
          moduleKey: 'emp',
          score: 10,
        })
      }
    } else if (slot === 'policies') {
      for (const r of rows as {
        id: string
        code: string
        title: string
        category: string
      }[]) {
        const path =
          r.category === 'Quy trình'
            ? '/policies/sop'
            : r.category === 'Pháp lý'
              ? '/policies/legal'
              : '/policies/rules'
        hits.push({
          kind: 'policy',
          id: r.id,
          title: r.title,
          subtitle: r.code,
          path: `${path}?q=${encodeURIComponent(q)}`,
          moduleKey: 'pol',
          score: 8,
        })
      }
    } else if (slot === 'jobs') {
      for (const r of rows as {
        id: string
        title: string
        department: string
        status: string
      }[]) {
        hits.push({
          kind: 'job',
          id: r.id,
          title: r.title,
          subtitle: `${r.department} · ${r.status}`,
          path: `/recruitment/jobs?q=${encodeURIComponent(q)}`,
          moduleKey: 'rec',
          score: 7,
        })
      }
    } else if (slot === 'candidates') {
      for (const r of rows as {
        id: string
        full_name: string
        stage: string
        email: string | null
      }[]) {
        hits.push({
          kind: 'candidate',
          id: r.id,
          title: r.full_name,
          subtitle: r.stage,
          path: `/recruitment/candidates?q=${encodeURIComponent(q)}`,
          moduleKey: 'rec',
          score: 7,
        })
      }
    } else if (slot === 'courses') {
      for (const r of rows as {
        id: string
        title: string
        course_type: string
        code: string | null
      }[]) {
        hits.push({
          kind: 'course',
          id: r.id,
          title: r.title,
          subtitle: r.code ?? r.course_type,
          path: `/learning/courses?q=${encodeURIComponent(q)}`,
          moduleKey: 'learn',
          score: 6,
        })
      }
    }
  }

  hits.sort((a, b) => b.score - a.score)
  return json(
    c,
    { q, items: hits.slice(0, limit) },
    200,
    privateCacheHeaders(15),
  )
})

export default search
