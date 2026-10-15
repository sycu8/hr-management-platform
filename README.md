# HR Management Platform

Internal HR portal for a Vietnamese organization: employees, recruitment, leave, attendance, travel expenses, payroll, performance, learning, policies, and administration.

Rebuilt from the HRM Portal handoff as a production Cloudflare application.

## Stack

- React + Vite SPA (Vietnamese UI)
- Cloudflare Workers + Hono API
- D1, R2, KV, Queues, Workflows, Cron, Email Service, Turnstile
- Public email/password login (no Cloudflare Access gate)

## Login (public)

App: https://hrm.orangecloud.vn

Use email/password:

| Account | Email | Password | Rights |
| --- | --- | --- | --- |
| Super Admin | super@orangecloud.vn | SuperAdmin!2026 | Full + view-as |
| Admin (HR) | admin@orangecloud.vn | Admin!2026 | Create users, manage data, reset passwords (no system admin) |
| User (tuyen dung) | user.tuyendung@orangecloud.vn | User!2026 | Recruiting capabilities |
| User (luong) | user.luong@orangecloud.vn | User!2026 | Payroll/benefits capabilities |

## Quick start

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local app + Worker |
| `npm run test:unit` | Domain and unit tests |
| `npm run build` | Production build |
| `npm run deploy` | Build and deploy Worker |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations remotely |

## Credentials

Do not paste tokens into chat. Add them to GitHub Actions secrets and Worker secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- Access audience / team domain
- Turnstile secret
- Email sending domain

See [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Compatibility

Travel trip `CT-2026-0001` and September 2026 payroll golden values from the handoff are locked by automated tests. Business-rule changes require explicit approval.

Payroll parameters require legal review before closed payrolls can be used for payment.
