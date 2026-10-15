import { Hono } from 'hono'
import type { Env } from './env.ts'
import { apiError } from './lib/http.ts'
import type { AuthUser } from './middleware/auth.ts'
import employees from './routes/employees.ts'
import health from './routes/health.ts'
import me from './routes/me.ts'
import payroll from './routes/payroll.ts'
import trips from './routes/trips.ts'

export type AppVariables = {
  user: AuthUser
}

export type AppEnv = {
  Bindings: Env
  Variables: AppVariables
}

export function createApp() {
  const app = new Hono<AppEnv>()

  app.onError((err, c) => {
    console.error('api error', err)
    return apiError(c, 500, 'internal_error', 'Internal server error')
  })

  app.notFound((c) => apiError(c, 404, 'not_found', 'Not found'))

  const api = new Hono<AppEnv>()
  api.route('/', health)
  api.route('/', me)
  api.route('/employees', employees)
  api.route('/trips', trips)
  api.route('/payroll', payroll)

  app.route('/api', api)

  return app
}
