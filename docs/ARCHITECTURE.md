# Architecture — HR Management Platform

## Purpose

Production rebuild of the HRM Portal handoff for a Vietnamese organization. The prototype behavior and golden calculation values are preserved; storage, authentication, authorization, durability, and operations are replaced with Cloudflare Developer Platform services.

## Decisions

| Topic | Choice |
| --- | --- |
| Hosting | Cloudflare Workers + Static Assets (SPA) |
| API | Hono on the same Worker (`/api/*`) |
| Database | D1 (`HRM_DB`) |
| Files | R2 (`hrm-documents`, `hrm-exports`) |
| Cache / short-lived state | KV (`CACHE`) |
| Async work | Queues (`hrm-notifications`, `hrm-jobs`) |
| Multi-step jobs | Workflows (reminders, payroll close) |
| Schedules | Cron `0 1 * * *` Asia/Ho_Chi_Minh business day checks |
| Email | Cloudflare Email Service binding |
| Identity | Cloudflare Access + organization IdP |
| Bot protection | Turnstile on selected public/sensitive forms |
| Observability | Workers Logs + Traces |
| Locale / money | `vi-VN`, VND integer minor units |

“Use all Cloudflare services” is interpreted as every service that solves a concrete HRM requirement. Products without a clear role are intentionally omitted.

## Module map

1. Dashboard  
2. Employees  
3. Recruitment  
4. Leave & attendance  
5. Travel & travel expenses  
6. Payroll & benefits  
7. Performance  
8. Learning  
9. Internal policies  
10. System administration  

## Compatibility rules

Legacy calculation results for travel trip `CT-2026-0001` and September 2026 payroll must remain bit-identical until an authorized, effective-dated policy change is approved.

Known prototype quirks preserved under compatibility mode:

- Holidays remain inside payroll standard weekday counts.
- Closed payrolls in the prototype were mutable; production closed runs store immutable snapshots.
- Pseudo-attendance generation is removed; only punches, imports, leave, travel, and audited adjustments remain.

## Authorization model

Server-enforced RBAC plus scope:

- Employee: self-scoped records.
- Manager: direct/indirect reports only; no self-approval.
- HR / Finance / Admin: module matrix with elevated scopes.
- Client-selected roles are never trusted.

## Legal gate

Payroll parameters require `legal_review_status = approved` before a payroll run can be closed for payment. Values ship as configurable effective-dated policy with source citations.

## Cutover outline

1. Seed demo organization and verify golden tests.  
2. Import real employees without payroll activation.  
3. Parallel payroll for one month.  
4. Approve legal parameters.  
5. Freeze legacy prototype.  
6. Keep rollback by redeploying previous Worker version; D1 snapshots/export beforehand.
