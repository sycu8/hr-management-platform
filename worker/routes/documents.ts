import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { notFound } from '../lib/http.ts'
import { r2ObjectResponse } from '../lib/r2.ts'
import {
  resolveEmployeeScope,
  scopeAllowsEmployee,
} from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const documents = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

documents.use('*', requireAuth)

documents.get('/:id/download', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT id, file_name, r2_key, employee_id
     FROM documents
     WHERE organization_id = ? AND id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first<{
      id: string
      file_name: string
      r2_key: string | null
      employee_id: string
    }>()

  if (!row?.r2_key) return notFound(c, 'Document not found')

  const scope = await resolveEmployeeScope(c.env.DB, user)
  if (!scopeAllowsEmployee(scope, row.employee_id)) {
    return notFound(c, 'Document not found')
  }

  const object = await c.env.DOCUMENTS.get(row.r2_key)
  if (!object) return notFound(c, 'Không tìm thấy tệp')

  const disposition =
    c.req.query('disposition') === 'attachment' ? 'attachment' : 'inline'
  return r2ObjectResponse(object, row.file_name, disposition)
})

export default documents
