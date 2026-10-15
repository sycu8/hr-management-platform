# Operations guide

## Required GitHub Actions secrets

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deploy Worker, apply D1 migrations, manage resources |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account |

Suggested API token permissions: Workers Scripts Edit, Workers KV Storage Edit, D1 Edit, R2 Edit, Queues Edit, Account Settings Read, User Details Read, Zone resources as needed for Access/Email/Turnstile.

## Worker vars / secrets

Set through dashboard or `wrangler secret put`:

| Name | Kind | Notes |
| --- | --- | --- |
| `ACCESS_TEAM_DOMAIN` | var | `<team>.cloudflareaccess.com` |
| `ACCESS_AUD` | var | Access application audience |
| `TURNSTILE_SITE_KEY` | var | Public widget key |
| `TURNSTILE_SECRET` | secret | Siteverify secret |
| `EMAIL_FROM` | var | Address on an Email Sending–enabled domain |
| `EMAIL_FROM_NAME` | var | Display name |

## First-time provisioning checklist

1. Create D1 database `HRM_DB` and paste `database_id` into `wrangler.jsonc`.
2. Create R2 buckets `hrm-documents` and `hrm-exports`.
3. Create KV namespace and paste id into `wrangler.jsonc`.
4. Create queues `hrm-notifications` and `hrm-jobs`.
5. Enable Email Sending for the organization domain.
6. Create Turnstile widget for production + localhost.
7. Create Cloudflare Access application for the Worker hostname; connect Microsoft/Google/other IdP.
8. Map Access emails to `users` rows and employee records.
9. Apply migrations: `npm run db:migrate:remote`.
10. Deploy: push to `main` or run the Deploy workflow.

## Local development

```bash
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run dev
```

Without Access locally, `.dev.vars` `DEV_AUTH_EMAIL` selects a simulated signed-in user. Production never accepts this path.

## Importing real data

1. Export CSV templates from System → Export.  
2. Import employees first, then contracts, leave balances, and attendance.  
3. Do not import personal data into shared demo environments.  
4. After import, run reconciliation reports for headcount, leave balances, and sample payroll.

## Backups

- D1: scheduled export to `hrm-exports` via jobs queue.  
- R2: object versioning recommended for documents.  
- Before payroll close: export payroll run JSON snapshot already stored in `payroll_items`.
