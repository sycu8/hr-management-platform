# Legal parameters — review required before payment

Status: **pending organization approval**  
Mode: configurable and effective-dated; payroll close is blocked until `legal_review_status = approved`.

These values reproduce the handoff sample for compatibility tests. They are **not** authorized for real payroll until an organization reviewer confirms them against current official texts.

## Current sample values (compatibility)

| Parameter | Sample value | Intended source family |
| --- | --- | --- |
| Personal deduction | 15,500,000 ₫/month | UBTVQH resolution on family circumstance deductions (handoff cites 110/2025/NQ-UBTVQH, effective 2026-01-01) |
| Dependent deduction | 6,200,000 ₫/month | Same |
| Meal exemption cap | 730,000 ₫/month | MoF guidance on non-taxable benefits — verify current circular |
| PIT brackets | 5% / 10% / 20% / 30% / 35% | Personal income tax progressive monthly schedule |
| Employee social insurance | 10.5% (8 + 1.5 + 1) | Social insurance / health / unemployment contribution rates |
| Employer social insurance | 21.5% | Same |
| Contribution reference | 2,340,000 ₫ × 20 cap | Contribution base / ceiling — verify against current government reference wage and regional minimum wages for unemployment insurance |
| Annual leave | 12 days + 1 per 5 years tenure | Labor Code 2019 leave rules |
| Probation insurance | Not contributed in sample | Confirm against actual contract practice and BHXH registration rules |

## Production controls

1. Store every change in `payroll_policy_versions` with `effective_from`.  
2. Closed payroll runs reference a specific policy version and immutable `payroll_items` snapshots.  
3. Require named reviewer, timestamp, and citation links before approval.  
4. Separate unemployment-insurance ceiling by regional minimum wage when the organization confirms region codes for each workplace.  
5. Add 10% provisional tax for probation under 3 months only after legal confirmation — not enabled in compatibility mode.

## Reviewer checklist

- [ ] Confirm personal/dependent deductions for the active tax year  
- [ ] Confirm PIT brackets  
- [ ] Confirm BHXH/BHYT/BHTN rates and ceilings  
- [ ] Confirm regional minimum wages for BHTN ceiling  
- [ ] Confirm leave entitlements against company policy + Labor Code  
- [ ] Confirm travel-policy rates are company regulations, not state-agency mandatory rates  
- [ ] Sign-off stored in system with name and date
