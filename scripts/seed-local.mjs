#!/usr/bin/env node
/**
 * Build sanitized, production-scale local D1 data (org_demo only).
 * Never targets --remote.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(args) {
  console.log('>', 'npx', args.join(' '))
  const r = spawnSync('npx', args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(['wrangler', 'd1', 'migrations', 'apply', 'HRM_DB', '--local'])

const files = [
  'seed/demo.sql',
  'seed/policies_enrich.sql',
  'seed/auth_users.sql',
  'seed/onboarding_checklist_patch.sql',
]

for (const file of files) {
  const abs = path.join(root, file)
  if (!existsSync(abs)) {
    console.warn('skip missing', file)
    continue
  }
  run([
    'wrangler',
    'd1',
    'execute',
    'HRM_DB',
    '--local',
    `--file=${file}`,
  ])
}

console.log('Local D1 seeded with sanitized demo data.')
