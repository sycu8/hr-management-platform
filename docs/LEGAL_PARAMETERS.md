# Legal parameters — Vietnam payroll policy (current)

Status: **demo policy aligned to official texts effective 01/07/2026**  
Mode: configurable and effective-dated; payroll close is blocked until `legal_review_status = approved` when `LEGAL_REVIEW_REQUIRED=true`.

These values are the platform’s **current Vietnam sample policy** (`paypol_v2` / `VN_PAY_POLICY_2026_07`). Organization reviewers must still confirm workplace region codes and citations before real payment.

## Current values (effective 01/07/2026)

| Parameter | Value | Source |
| --- | --- | --- |
| Personal deduction | 15,500,000 ₫/month | UBTVQH family-circumstance deductions (handoff cites 110/2025/NQ-UBTVQH) |
| Dependent deduction | 6,200,000 ₫/month | Same |
| Meal exemption cap (cash) | **1,200,000 ₫/month** | Nghị định **253/2026/NĐ-CP** Đ.8(2)(g) — tiền ăn giữa ca / ăn trưa chi bằng tiền; áp dụng từ 01/07/2026 |
| PIT brackets | 5% / 10% / 20% / 30% / 35% | Progressive monthly PIT schedule |
| Employee SI/HI/UI | **10.5%** (BHXH 8% + BHYT 1.5% + BHTN 1%) | Luật BHXH 2024 contribution rates |
| Employer SI/HI/UI | **21.5%** (BHXH 14% + ốm đau 3% + TNLĐ-BNN 0.5% + BHYT 3% + BHTN 1%) | Same |
| BHXH / BHYT reference wage | **2,530,000 ₫** | Nghị định **161/2026/NĐ-CP** — mức lương cơ sở từ 01/07/2026 |
| BHXH / BHYT ceiling | **50,600,000 ₫** (= 20 × 2,530,000) | Luật BHXH 2024 ceiling rule |
| Regional minimum (vùng I) | **5,310,000 ₫** | Nghị định **293/2025/NĐ-CP** — hiệu lực 01/01/2026 (Hà Nội / TP.HCM demo) |
| BHTN ceiling | **106,200,000 ₫** (= 20 × lương tối thiểu vùng) | Luật BHXH 2024 — trần BHTN theo vùng, **không** dùng lương cơ sở |
| Annual leave | 12 days + 1 per 5 years tenure | Labor Code 2019 |
| Probation insurance | Not contributed in sample | Confirm against contract practice and BHXH registration |

### Policy versioning in seed

| Version | Effective | Notes |
| --- | --- | --- |
| `paypol_v1` | 2026-01-01 → 2026-06-30 | Legacy compatibility (ref 2.34tr, meal exempt 730k, single ceiling) |
| `paypol_v2` | 2026-07-01 → | Current policy above; Aug/Sep/Oct 2026 demo runs reference this |

## Production controls

1. Store every change in `payroll_policy_versions` with `effective_from` / `effective_to`.  
2. Closed payroll runs reference a specific policy version and immutable `payroll_items` snapshots.  
3. Require named reviewer, timestamp, and citation links before approval.  
4. Set `bhtnRegionMin` per workplace region (I–IV under NĐ 293/2025); do not reuse the BHXH reference wage for the UI ceiling.  
5. Add 10% provisional tax for probation under 3 months only after legal confirmation — not enabled in compatibility mode.

## Reviewer checklist

- [ ] Confirm personal/dependent deductions for the active tax year  
- [ ] Confirm PIT brackets  
- [ ] Confirm BHXH/BHYT/BHTN rates and ceilings (20 × lương cơ sở vs 20 × LTT vùng)  
- [ ] Confirm regional minimum wages for each workplace  
- [ ] Confirm meal cash exemption vs organized meal practice (NĐ 253/2026)  
- [ ] Confirm leave entitlements against company policy + Labor Code  
- [ ] Confirm travel-policy rates are company regulations, not state-agency mandatory rates  
- [ ] Sign-off stored in system with name and date
