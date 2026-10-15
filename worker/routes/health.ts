import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'

const health = new Hono<{ Bindings: Env }>()

health.get('/health', (c) => {
  return json(c, {
    ok: true,
    name: c.env.APP_NAME,
    locale: c.env.APP_LOCALE,
    timezone: c.env.APP_TIMEZONE,
  })
})

export default health
