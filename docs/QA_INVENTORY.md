# QA inventory — HR Management Platform (local / sanitized)

Scope: **local** demo data only (`org_demo`). No production writes, no real PII.

Roles under test:

| Role | Email (demo) | Password (demo) | Caps |
| --- | --- | --- | --- |
| Super Admin | `super@orangecloud.vn` | `SuperAdmin!2026` | all modules + integrations |
| Admin (HR) | `admin@orangecloud.vn` | `Admin!2026` | all business modules, edit |
| User recruiting | `user.tuyendung@orangecloud.vn` | `User!2026` | dash, recruiting, emp read, perf read |
| User payroll | `user.luong@orangecloud.vn` | `User!2026` | dash, payroll, benefits, emp read, perf read |

## Global shell

| ID | Surface | Acceptance | Edge cases |
| --- | --- | --- | --- |
| G1 | Login + Turnstile | Valid creds + token → session cookie; invalid → error; widget required | Empty email; expired token replay; missing secret → fail closed |
| G2 | Logout | Clears session; next `/` redirects to login | Double logout |
| G3 | Sidebar RBAC | Only allowed modules visible | User without `perf` cannot open `/performance/*` API |
| G4 | Global search Ctrl+K | Suggests pages by keyword; ≥2 chars hits records | Empty query chips; XSS in query escaped; forbidden modules omitted |
| G5 | Breadcrumb / title | Matches `nav.ts` title | Unknown path → home |

## Routes & feature matrix

### Dashboard (`dash`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/` | KPI tiles + QuickHub links resolve 200 | Empty D1 → empty states not crash |
| `/presence` | Renders presence metrics | |
| `/alerts` | Alerts clickable → target route | Missing `href` still renders |
| `/events` | Lists upcoming | |

### Employees (`emp`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/employees` | Card grid; Admin upload photo (R2); filter active/left | No photo → initials; oversized file rejected |
| `/employees/jobs` | Job profiles table/edit if Admin | |
| `/employees/history` | Events list | |
| `/employees/docs` | Document list / download auth | Cross-employee denied for User |

### Recruitment (`rec`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/recruitment/jobs` | List/create JD (Admin) | |
| `/recruitment/candidates` | Pipeline stages | Invalid stage rejected |
| `/recruitment/onboarding` | Checklist cards toggle | Auto-create on hired |

### Leave (`leave`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/leave` | Create/list leave | Overlap / invalid dates |
| `/leave/quota` | Year filter | |
| `/attendance` | Attendance rows | |
| `/leave/calendar` | Month grid | |

### Travel (`trip`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/travel` | Overview charts | |
| `/travel/trips` | Create trip + calc panel | Draft vs submit |
| `/travel/approvals` | Approve/reject | |
| `/travel/settlements` | Settlement flow | |
| `/travel/policy` | Policy display | |
| `/travel/reports` | Reports | |

### Payroll (`pay`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/payroll` | Month matrix; CSV/Excel download | Empty draft period |
| `/payroll/payslips` | Detail + export | Single-slip export |
| `/payroll/allowances` | CRUD Admin | |
| `/payroll/insurance` | BH summary | |

### Performance (`perf`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/performance/cycles` | Cycles list | |
| `/performance/okr` | Self update KR; manager completeness; year view | Period parse Q/H/vi |
| `/performance/360` | Radar + insert + AI analyze | AI missing → 503 message |
| `/performance/history` | Ratings | |

### Learning (`learn`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/learning/courses` | Catalog CRUD Admin | |
| `/learning/progress` | Enrollments | |
| `/learning/certificates` | Certs | |
| `/learning/careers` | Career paths | |

### Policies (`pol`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/policies/rules|sop|legal` | List/form; R2 upload; OCR | OCR fallback without AI |

### Admin (`sys`)

| Route | Criteria | Edges |
| --- | --- | --- |
| `/admin/permissions` | User/cap matrix | |
| `/admin/security` | Settings | |
| `/admin/integrations` | **Super Admin only** | Admin → blocked |
| `/admin/exports` | Export jobs | |

## Workflows (happy path)

1. Admin login → search "lương" → open payroll → download CSV.
2. User payroll login → payslips read-only; no employee create.
3. Admin → employees → edit photo → card shows image.
4. Admin → OKR year view → Q coverage numbers finite.
5. Admin → 360 → open radar → Phân tích AI (local may 503 if AI unbound).

## Stop conditions

- **Clean pass:** typecheck + unit + e2e smoke green on local sanitized DB.
- **Blocked handoff:** missing Cloudflare AI / R2 credentials locally — document and continue non-AI paths.

## Bug log (local QA)

| ID | Surface | Severity | Evidence | Root cause | Fix | Regression |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Login + Turnstile (G1) | P0 | Siteverify fail with always-pass keys (`hostname: example.com`, no `action`) | Strict hostname/action check | `worker/lib/turnstile.ts` testing-key accept | `turnstile.test.ts`; e2e login |
| B2 | Caps `benefits` | P0 | `benefits` → `pol` gave payroll user policy write | Wrong module map | `benefits` → `pay` in `env.ts` | scope/unit |
| B3 | OKR list/summary | P0 | `scope=all` available to any perf user | No elevated check | Force team for non-admin | e2e OKR |
| B4 | 360 GET list/detail | P0 | Org-wide 360 to any perf≥1 | No employee scope | `resolveEmployeeScope` filter | e2e 360 |
| B5 | Payslips/docs/trips | P1 | User with null `employee_id` saw all rows | Missing link treated as elevated | `selfOnlyEmployeeFilter` deny | `scope.test.ts` |
| B6 | Lists (leave, earnings, docs, …) | P1 | Module≥1 returned org-wide PII | No scope filter | Filter via employee scope | unit/e2e |
| B7 | Payroll runs totals | P1 | Org gross/net to pay users | Totals always returned | Redact totals for non-admin | — |
| B8 | Leave create | P1 | UI/QuickHub promised create; API only PATCH | Missing POST | `POST /leave/requests` + form | e2e leave create |
| B9 | 360 forge roles | P1 | Non-admin could POST mgr/peer scores | No role restrict | Self-only merge for users | — |
| B10 | View-as `/me` | P1 | Actor `canEditData` during view-as | Actor fields in me | Effective identity for UX | — |
| B11 | Leave quota UI | P1 | Adjustments only, no remaining balance | Unused `leaveQuota` | `/leave-balances` + UI | — |
| B12 | Documents download | P2 | Download API unused in UI | No button | Download link when `has_file` | — |
| B13 | Exports create | P2 | Page implies create | Stub queue | Honest copy (read-only) | — |
| B14 | Attendance month | P2 | Hardcoded 2026-10 | Stale default | Month picker + current default | — |
| B15 | mask_salary | P2 | Flag never enforced | Dead control | Documented on Security page | — |
| B16 | Search highlight | P2 | `?highlight=` ignored | Profiles never read query | Scroll + outline | — |
| S1 | Turnstile test secret | High | Always-pass secret skipped hostname/action | Prod misconfig = bypass | Reject test keys unless hosts are localhost-only | `turnstile.test.ts` |
| S2 | Employee directory IDOR | High | `emp≥1` saw all employees / detail / photo | `requireSelfOrElevated` treated level 1 as org-wide | Scope self+reports; admin/SA only for all | e2e scoped directory |
| S3 | job-profiles / search / learning detail | High–Med | Sibling routes missed scope | Incomplete B6 | Scope filters + GET checks | unit/e2e |
| S4 | View-as audit actor | Med | leave.create logged as target | Used effective `user.id` | `resolveAuditActor` / `actorUserId` | — |
| S5 | Demo passwords | Med | Public seed passwords | Repo-committed defaults | Ops hard rules + seed warnings (rotate before prod) | — |

## Shared causes / dependencies

- Local Turnstile must use Cloudflare published always-pass sitekey + secret in `.dev.vars` (see `.dev.vars.example`). Production keys reject localhost.
- Vite local QA uses `remoteBindings: false` so D1/R2 stay local; Workers AI still may hit remote and charge — 360 «Phân tích AI» may 503 locally (documented blocked path, non-crashing UI).
- Frontend routes are auth-gated only; module RBAC is enforced on APIs + sidebar. Deep-linking a forbidden module shows API error UI (covered by recruiting→payroll e2e).

## Pass record (2026-10-15 local)

| Gate | Result |
| --- | --- |
| Seed `org_demo` (`npm run db:seed:local:all`) | OK |
| `npx tsc --noEmit` | OK |
| `npm test` (27 unit) | OK |
| Playwright smoke + workflows (23) | OK |

**Verdict:** Clean pass after B1–B16 fixes. **Remaining known gaps (documented, not silent bugs):** Workers AI may 503 locally; export job create/download unfinished; `mask_salary` flag display-only. **Not done without ask:** production deploy, remote D1 writes, destructive resets.
