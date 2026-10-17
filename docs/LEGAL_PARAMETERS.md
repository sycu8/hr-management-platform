# Legal parameters — Vietnam payroll policy (current)

Status: **demo policy aligned to official texts effective 01/07/2026**  
Mode: configurable and effective-dated; payroll close is blocked until `legal_review_status = approved` when `LEGAL_REVIEW_REQUIRED=true`.

These values are the platform’s **current Vietnam sample policy** (`paypol_v2` / `VN_PAY_POLICY_2026_07`). Organization reviewers must still confirm workplace region codes and citations before real payment.

Seed library: `policy_documents` category **Pháp lý** (`pol_h9`–`pol_h20`). Payroll citations in `payroll_policy_versions.source_citations_json` point at those rows via `policyId`.

## Current values (effective 01/07/2026)

| Parameter | Value | Source document (seed) |
| --- | --- | --- |
| Personal deduction | 15,500,000 ₫/month | `pol_h12` — 110/2025/NQ-UBTVQH |
| Dependent deduction | 6,200,000 ₫/month | Same |
| Meal exemption cap (cash) | **1,200,000 ₫/month** | `pol_h16` — 253/2026/NĐ-CP Đ.8(2)(g) |
| PIT brackets | 5% / 10% / 20% / 30% / 35% | `pol_h17` — 109/2025/QH15 |
| Employee SI/HI/UI | **10.5%** (8 + 1.5 + 1) | `pol_h11` + `pol_h19` + `pol_h18` |
| Employer SI/HI/UI | **21.5%** (14 + 3 + 0.5 + 3 + 1) | Same |
| BHXH / BHYT reference wage | **2,530,000 ₫** | `pol_h14` — 161/2026/NĐ-CP |
| BHXH / BHYT ceiling | **50,600,000 ₫** (= 20 × ref) | `pol_h11` + `pol_h14` |
| Regional minimum (vùng I) | **5,310,000 ₫** | `pol_h15` — 293/2025/NĐ-CP |
| BHTN ceiling | **106,200,000 ₫** (= 20 × LTT vùng) | `pol_h18` — 74/2025/QH15 Đ.34 |
| Annual leave | 12 days + 1 per 5 years | `pol_h9` — 45/2019/QH14 |
| Probation insurance | Not contributed in sample | Confirm vs BHXH registration |

## Enterprise legal library (Pháp lý)

| ID | Code | Title | Drives |
| --- | --- | --- | --- |
| `pol_h9` | 45/2019/QH14 | Bộ luật Lao động 2019 | Leave, nội quy |
| `pol_h10` | 145/2020/NĐ-CP | Hướng dẫn Bộ luật Lao động | Nội quy / phụ cấp |
| `pol_h11` | 41/2024/QH15 | Luật BHXH 2024 | Tỷ lệ BHXH + trần 20× lương cơ sở |
| `pol_h12` | 110/2025/NQ-UBTVQH | Giảm trừ gia cảnh | selfDed / depDed |
| `pol_h13` | 40/2017/TT-BTC | Công tác phí (NSNN — tham khảo) | Travel (company rates) |
| `pol_h14` | 161/2026/NĐ-CP | Lương cơ sở 2.530.000 | `ref` |
| `pol_h15` | 293/2025/NĐ-CP | Lương tối thiểu vùng | `bhtnRegionMin` |
| `pol_h16` | 253/2026/NĐ-CP | Hướng dẫn Luật TNCN | `mealExempt` |
| `pol_h17` | 109/2025/QH15 | Luật Thuế TNCN | `brackets` |
| `pol_h18` | 74/2025/QH15 | Luật Việc làm 2025 | BHTN 1% + trần theo vùng |
| `pol_h19` | 188/2025/NĐ-CP | Hướng dẫn Luật BHYT | BHYT 1.5% / 3% |
| `pol_h20` | 51/2024/QH15 | Luật BHYT sửa đổi 2024 | Khung BHYT |

UI:
- **Lương & phúc lợi → Tham số tính lương** (`/payroll/params`) — form + biểu PIT + trần BHXH/BHTN tách riêng; đồng bộ catalog
- **Chính sách → Pháp lý** (`/policies/legal`) — thư viện văn bản `pol_h9`–`pol_h20`

### Policy versioning in seed

| Version | Effective | Notes |
| --- | --- | --- |
| `paypol_v1` | 2026-01-01 → 2026-06-30 | Legacy (ref 2.34tr, meal 730k, single ceiling) |
| `paypol_v2` | 2026-07-01 → | Current; citations → `pol_h11`–`pol_h19`; Aug/Sep/Oct runs |

### Auto-update when the law changes (practical)

The product does **not** scrape government websites. Statutory numbers ship as:

1. Code constant `VN_PAY_POLICY_2026_07` / catalog id `VN_PAY_POLICY_2026_07` in `shared/domain/payroll.ts`
2. Seed rows Pháp lý (`pol_h11`–`pol_h20`) + `paypol_v2.policy_json`

When a decree changes:

1. Update the constant + citations + seed legal docs in a release  
2. Org admins open **Tham số tính lương** — UI flags drift if active `policy_json` ≠ catalog  
3. **Đồng bộ từ thư viện pháp lý** calls `POST /api/payroll/policy-versions/:id/sync-catalog`, which copies catalog params + citations into the open policy version and sets `legal_review_status = pending`  
4. Legal reviewer re-approves before payroll close (when `LEGAL_REVIEW_REQUIRED=true`)

API: `GET /api/payroll/policy-catalog`, `GET|PATCH /api/payroll/policy-versions/:id`, `POST .../sync-catalog`.

## Production controls

1. Store every change in `payroll_policy_versions` with `effective_from` / `effective_to`.  
2. Closed payroll runs reference a specific policy version and immutable `payroll_items` snapshots.  
3. Require named reviewer, timestamp, and citation links (`policyId`) before approval.  
4. Set `bhtnRegionMin` per workplace region (I–IV under NĐ 293/2025); do not reuse the BHXH reference wage for the UI ceiling.  
5. Add 10% provisional tax for probation under 3 months only after legal confirmation — not enabled in compatibility mode.  
6. Prefer syncing from catalog over hand-editing ceilings when a new NĐ lands.

## Reviewer checklist

- [ ] Confirm personal/dependent deductions for the active tax year (`pol_h12`)  
- [ ] Confirm PIT brackets (`pol_h17`)  
- [ ] Confirm BHXH/BHYT/BHTN rates and ceilings (`pol_h11`, `pol_h14`, `pol_h18`, `pol_h19`)  
- [ ] Confirm regional minimum wages for each workplace (`pol_h15`)  
- [ ] Confirm meal cash exemption vs organized meal practice (`pol_h16`)  
- [ ] Confirm leave entitlements against company policy + Labor Code (`pol_h9`)  
- [ ] Confirm travel-policy rates are company regulations, not state-agency mandatory rates (`pol_h13`)  
- [ ] Sign-off stored in system with name and date
