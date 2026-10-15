import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { getPermissionLevel } from '../middleware/rbac.ts'
import type { ModuleKey } from '../env.ts'

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

  async function can(mod: ModuleKey): Promise<boolean> {
    const level = await getPermissionLevel(c.env.DB, user, mod)
    return level >= 1
  }

  if (await can('emp')) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, code, full_name, department, title
       FROM employees
       WHERE organization_id = ?
         AND (code LIKE ? COLLATE NOCASE
           OR full_name LIKE ? COLLATE NOCASE
           OR department LIKE ? COLLATE NOCASE
           OR title LIKE ? COLLATE NOCASE
           OR ifnull(email,'') LIKE ? COLLATE NOCASE)
       ORDER BY code
       LIMIT 8`,
    )
      .bind(user.organizationId, needle, needle, needle, needle, needle)
      .all<{
        id: string
        code: string
        full_name: string
        department: string
        title: string
      }>()
    for (const r of results ?? []) {
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
  }

  if (await can('pol')) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, code, title, category
       FROM policy_documents
       WHERE organization_id = ?
         AND (code LIKE ? COLLATE NOCASE
           OR title LIKE ? COLLATE NOCASE
           OR ifnull(summary,'') LIKE ? COLLATE NOCASE)
       ORDER BY title
       LIMIT 6`,
    )
      .bind(user.organizationId, needle, needle, needle)
      .all<{ id: string; code: string; title: string; category: string }>()
    for (const r of results ?? []) {
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
  }

  if (await can('rec')) {
    const { results: jobs } = await c.env.DB.prepare(
      `SELECT id, title, department, status
       FROM job_requisitions
       WHERE organization_id = ?
         AND (title LIKE ? COLLATE NOCASE
           OR department LIKE ? COLLATE NOCASE)
       ORDER BY title
       LIMIT 5`,
    )
      .bind(user.organizationId, needle, needle)
      .all<{ id: string; title: string; department: string; status: string }>()
    for (const r of jobs ?? []) {
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

    const { results: cands } = await c.env.DB.prepare(
      `SELECT id, full_name, stage, email
       FROM candidates
       WHERE organization_id = ?
         AND (full_name LIKE ? COLLATE NOCASE
           OR ifnull(email,'') LIKE ? COLLATE NOCASE)
       ORDER BY full_name
       LIMIT 5`,
    )
      .bind(user.organizationId, needle, needle)
      .all<{
        id: string
        full_name: string
        stage: string
        email: string | null
      }>()
    for (const r of cands ?? []) {
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
  }

  if (await can('learn')) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, course_type, code
       FROM courses
       WHERE organization_id = ?
         AND (title LIKE ? COLLATE NOCASE
           OR ifnull(code,'') LIKE ? COLLATE NOCASE
           OR ifnull(skill,'') LIKE ? COLLATE NOCASE)
       ORDER BY title
       LIMIT 5`,
    )
      .bind(user.organizationId, needle, needle, needle)
      .all<{
        id: string
        title: string
        course_type: string
        code: string | null
      }>()
    for (const r of results ?? []) {
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

  hits.sort((a, b) => b.score - a.score)
  return json(c, { q, items: hits.slice(0, limit) })
})

export default search
