import { Hono } from 'hono'
import type { Env } from './env.ts'
import { apiError } from './lib/http.ts'
import type { AuthUser } from './middleware/auth.ts'
import auth from './routes/auth.ts'
import dashboard from './routes/dashboard.ts'
import employees from './routes/employees.ts'
import health from './routes/health.ts'
import payroll from './routes/payroll.ts'
import trips from './routes/trips.ts'
import users from './routes/users.ts'
import lists from './routes/lists.ts'
import dataSources from './routes/data-sources.ts'
import recruitment from './routes/recruitment.ts'
import leave from './routes/leave.ts'
import learning from './routes/learning.ts'
import policies from './routes/policies.ts'
import documents from './routes/documents.ts'
import okr from './routes/okr.ts'
import feedback360 from './routes/feedback360.ts'
import search from './routes/search.ts'

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
  api.route('/auth', auth)
  api.route('/users', users)
  api.route('/employees', employees)
  api.route('/trips', trips)
  api.route('/payroll', payroll)
  api.route('/dashboard', dashboard)
  api.route('/lists', lists)
  api.route('/data-sources', dataSources)
  api.route('/recruitment', recruitment)
  api.route('/leave', leave)
  api.route('/learning', learning)
  api.route('/policies', policies)
  api.route('/documents', documents)
  api.route('/okr', okr)
  api.route('/feedback-360', feedback360)
  api.route('/search', search)

  app.route('/api', api)

  return app
}
