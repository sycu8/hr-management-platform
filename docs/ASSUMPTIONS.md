# Assumptions

Recorded because answers were provided for project, auth, attendance, email, and legal mode.

1. Repository is `sycu8/hr-management-platform` (private).  
2. Authentication is Cloudflare Access fronting the Worker, connected to the organization’s IdP.  
3. Attendance starts with CSV/Excel import + in-app punch + audited adjustments.  
4. Notifications use Cloudflare Email Service on a verified organization domain.  
5. Legal/payroll parameters remain configurable and blocked from final payment until an authorized reviewer approves them.  
6. “Use all Cloudflare services” means the coherent product set required by HRM operations, not unrelated products.  
7. Compatibility calculations keep handoff golden values until an explicit policy change is approved.  
8. Prototype role impersonation is removed from production UI.  
9. Manager approvals are scoped to reporting lines; self-approval is denied.  
10. Demo data remains fictional (`@vidu.vn`); no real personal data in seeds.
