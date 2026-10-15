# Acceptance baseline (from handoff characterization)

Derived from [Inventory acceptance tests](d5873011-b4b0-4641-9365-cb0dfced5316) and [Audit legacy HRM](c8ff62d0-bf01-4797-b243-0e4af22fe1d6). Compatibility tests must preserve calculation outputs; authorization defects listed below must **not** be reintroduced.

## Golden calculation locks

| Fixture | Expected |
| --- | --- |
| Travel `CT-2026-0001` estimate | 6,870,000 ₫ |
| Travel `CT-2026-0001` settlement | 6,990,000 ₫ |
| PIT 10,000,000 | 500,000 |
| PIT 25,000,000 | 2,000,000 |
| PIT 70,000,000 | 11,500,000 |
| Sep 2026 company gross | 375,420,909 |
| Sep 2026 company PIT | 11,978,109 |
| Sep 2026 company net | 333,853,800 |
| Sep e1 net | 22,819,500 |
| Sep e4 net | 56,793,636 |
| Sep e5 net | 74,518,800 |
| Sep e11 net | 12,730,000 |

Covered by `shared/domain/__tests__/*` (see [Port domain calculations](7669b9a8-0bad-4843-b919-272ccd96ce3f)).

## Production hard rules (fix prototype defects)

1. No client role impersonation.
2. Server RBAC + scope on every mutation.
3. Manager approvals limited to reporting line; no self-approval.
4. Closed payroll runs are immutable snapshots bound to a policy version.
5. Attendance is punches / import / leave / travel / audited adjustments only — no pseudo-history generation.
6. Documents and receipts store bytes in R2.
7. Payroll/travel parameters are effective-dated; legal review required before payment close.
8. Real calendar date (no fixed demo “12/10/2026” clock in production).

## Module surface

40 menu pages across 10 modules, plus detail routes for employees and trips. Default permission matrix matches the handoff `S.perm` defaults (see seed `permission_matrix`).

## Compatibility quirks to preserve until an approved policy change

- Holidays remain inside payroll standard weekday counts (handoff behavior).
- Allowance field `taxable` was ignored in the prototype; preserve until a dated policy says otherwise.
- Travel local transport uses `nights + 1` calendar days.
