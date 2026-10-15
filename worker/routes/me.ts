import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'

const me = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

me.get('/me', requireAuth, (c) => {
  const user = c.get('user')
  return json(c, {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    employeeId: user.employeeId,
  })
})

export default me
