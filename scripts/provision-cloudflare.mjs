/**
 * Provision Cloudflare resources and patch wrangler.jsonc with real IDs.
 * Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
if (!token || !accountId) {
  console.error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required')
  process.exit(1)
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const body = await res.json()
  if (!body.success) {
    const msg = JSON.stringify(body.errors || body, null, 2)
    throw new Error(`${init.method || 'GET'} ${path}\n${msg}`)
  }
  return body.result
}

async function ensureD1(name) {
  const list = await api(`/accounts/${accountId}/d1/database`)
  const existing = (list || []).find((d) => d.name === name)
  if (existing) {
    console.log(`D1 exists: ${name} ${existing.uuid}`)
    return existing.uuid
  }
  const created = await api(`/accounts/${accountId}/d1/database`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  console.log(`D1 created: ${name} ${created.uuid}`)
  return created.uuid
}

async function ensureKv(title) {
  const list = await api(`/accounts/${accountId}/storage/kv/namespaces`)
  const existing = (list || []).find((n) => n.title === title)
  if (existing) {
    console.log(`KV exists: ${title} ${existing.id}`)
    return existing.id
  }
  const created = await api(`/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  console.log(`KV created: ${title} ${created.id}`)
  return created.id
}

async function ensureR2(name) {
  try {
    await api(`/accounts/${accountId}/r2/buckets/${name}`)
    console.log(`R2 exists: ${name}`)
    return
  } catch {
    /* create below */
  }
  await api(`/accounts/${accountId}/r2/buckets`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  console.log(`R2 created: ${name}`)
}

async function ensureQueue(name) {
  try {
    await api(`/accounts/${accountId}/queues/${name}`)
    console.log(`Queue exists: ${name}`)
    return
  } catch {
    /* list fallback */
  }
  const listed = await api(`/accounts/${accountId}/queues`)
  const hit = (listed || []).find((q) => q.queue_name === name || q.name === name)
  if (hit) {
    console.log(`Queue exists: ${name}`)
    return
  }
  await api(`/accounts/${accountId}/queues`, {
    method: 'POST',
    body: JSON.stringify({ queue_name: name }),
  })
  console.log(`Queue created: ${name}`)
}

const d1Id = await ensureD1('HRM_DB')
const kvId = await ensureKv('hrm-cache')
await ensureR2('hrm-documents')
await ensureR2('hrm-exports')
await ensureQueue('hrm-notifications')
await ensureQueue('hrm-jobs')

const path = new URL('../wrangler.jsonc', import.meta.url)
let text = readFileSync(path, 'utf8')
text = text.replace(
  /("database_name": "HRM_DB",\s*"database_id": ")[^"]+(")/,
  `$1${d1Id}$2`,
)
text = text.replace(
  /("binding": "CACHE",\s*"id": ")[^"]+(")/,
  `$1${kvId}$2`,
)
writeFileSync(path, text)
console.log('Patched wrangler.jsonc')
console.log(JSON.stringify({ d1Id, kvId }, null, 2))
