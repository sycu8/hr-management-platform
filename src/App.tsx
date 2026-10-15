import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { RequireAuth } from './components/RequireAuth'
import { RequireSuperAdmin } from './components/RequireSuperAdmin'
import { AuthProvider } from './lib/auth'
import { LoginPage } from './pages/LoginPage'

const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)
const AlertsPage = lazy(() =>
  import('./pages/dashboard/AlertsPage').then((m) => ({
    default: m.AlertsPage,
  })),
)
const EventsPage = lazy(() =>
  import('./pages/dashboard/EventsPage').then((m) => ({
    default: m.EventsPage,
  })),
)
const PresencePage = lazy(() =>
  import('./pages/dashboard/PresencePage').then((m) => ({
    default: m.PresencePage,
  })),
)
const DocumentsPage = lazy(() =>
  import('./pages/employees/DocumentsPage').then((m) => ({
    default: m.DocumentsPage,
  })),
)
const EmployeeProfilesPage = lazy(() =>
  import('./pages/employees/EmployeeProfilesPage').then((m) => ({
    default: m.EmployeeProfilesPage,
  })),
)
const JobProfilesPage = lazy(() =>
  import('./pages/employees/JobProfilesPage').then((m) => ({
    default: m.JobProfilesPage,
  })),
)
const WorkHistoryPage = lazy(() =>
  import('./pages/employees/WorkHistoryPage').then((m) => ({
    default: m.WorkHistoryPage,
  })),
)
const AttendancePage = lazy(() =>
  import('./pages/leave/AttendancePage').then((m) => ({
    default: m.AttendancePage,
  })),
)
const LeaveQuotaPage = lazy(() =>
  import('./pages/leave/LeaveQuotaPage').then((m) => ({
    default: m.LeaveQuotaPage,
  })),
)
const LeaveRequestPage = lazy(() =>
  import('./pages/leave/LeaveRequestPage').then((m) => ({
    default: m.LeaveRequestPage,
  })),
)
const TeamCalendarPage = lazy(() =>
  import('./pages/leave/TeamCalendarPage').then((m) => ({
    default: m.TeamCalendarPage,
  })),
)
const CareersPage = lazy(() =>
  import('./pages/learning/CareersPage').then((m) => ({
    default: m.CareersPage,
  })),
)
const CertificatesPage = lazy(() =>
  import('./pages/learning/CertificatesPage').then((m) => ({
    default: m.CertificatesPage,
  })),
)
const CoursesPage = lazy(() =>
  import('./pages/learning/CoursesPage').then((m) => ({
    default: m.CoursesPage,
  })),
)
const ProgressPage = lazy(() =>
  import('./pages/learning/ProgressPage').then((m) => ({
    default: m.ProgressPage,
  })),
)
const AllowancesPage = lazy(() =>
  import('./pages/payroll/AllowancesPage').then((m) => ({
    default: m.AllowancesPage,
  })),
)
const InsurancePage = lazy(() =>
  import('./pages/payroll/InsurancePage').then((m) => ({
    default: m.InsurancePage,
  })),
)
const PayrollPage = lazy(() =>
  import('./pages/payroll/PayrollPage').then((m) => ({
    default: m.PayrollPage,
  })),
)
const PayslipsPage = lazy(() =>
  import('./pages/payroll/PayslipsPage').then((m) => ({
    default: m.PayslipsPage,
  })),
)
const CyclesPage = lazy(() =>
  import('./pages/performance/CyclesPage').then((m) => ({
    default: m.CyclesPage,
  })),
)
const OkrPage = lazy(() =>
  import('./pages/performance/OkrPage').then((m) => ({ default: m.OkrPage })),
)
const PerfHistoryPage = lazy(() =>
  import('./pages/performance/PerfHistoryPage').then((m) => ({
    default: m.PerfHistoryPage,
  })),
)
const Review360Page = lazy(() =>
  import('./pages/performance/Review360Page').then((m) => ({
    default: m.Review360Page,
  })),
)
const LegalPage = lazy(() =>
  import('./pages/policies/LegalPage').then((m) => ({ default: m.LegalPage })),
)
const RulesPage = lazy(() =>
  import('./pages/policies/RulesPage').then((m) => ({ default: m.RulesPage })),
)
const SopPage = lazy(() =>
  import('./pages/policies/SopPage').then((m) => ({ default: m.SopPage })),
)
const CandidatesPage = lazy(() =>
  import('./pages/recruitment/CandidatesPage').then((m) => ({
    default: m.CandidatesPage,
  })),
)
const JobListingsPage = lazy(() =>
  import('./pages/recruitment/JobListingsPage').then((m) => ({
    default: m.JobListingsPage,
  })),
)
const OnboardingPage = lazy(() =>
  import('./pages/recruitment/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
)
const TravelApprovalsPage = lazy(() =>
  import('./pages/travel/TravelApprovalsPage').then((m) => ({
    default: m.TravelApprovalsPage,
  })),
)
const TravelOverviewPage = lazy(() =>
  import('./pages/travel/TravelOverviewPage').then((m) => ({
    default: m.TravelOverviewPage,
  })),
)
const TravelPolicyPage = lazy(() =>
  import('./pages/travel/TravelPolicyPage').then((m) => ({
    default: m.TravelPolicyPage,
  })),
)
const TravelReportsPage = lazy(() =>
  import('./pages/travel/TravelReportsPage').then((m) => ({
    default: m.TravelReportsPage,
  })),
)
const TravelSettlementsPage = lazy(() =>
  import('./pages/travel/TravelSettlementsPage').then((m) => ({
    default: m.TravelSettlementsPage,
  })),
)
const TravelTripsPage = lazy(() =>
  import('./pages/travel/TravelTripsPage').then((m) => ({
    default: m.TravelTripsPage,
  })),
)
const ExportsPage = lazy(() =>
  import('./pages/admin/ExportsPage').then((m) => ({
    default: m.ExportsPage,
  })),
)
const IntegrationsPage = lazy(() =>
  import('./pages/admin/IntegrationsPage').then((m) => ({
    default: m.IntegrationsPage,
  })),
)
const PermissionsPage = lazy(() =>
  import('./pages/admin/PermissionsPage').then((m) => ({
    default: m.PermissionsPage,
  })),
)
const SecurityPage = lazy(() =>
  import('./pages/admin/SecurityPage').then((m) => ({
    default: m.SecurityPage,
  })),
)

function RouteFallback() {
  return (
    <div className="login-page">
      <div className="login-card">Đang tải…</div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="presence" element={<PresencePage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="employees" element={<EmployeeProfilesPage />} />
                <Route path="employees/jobs" element={<JobProfilesPage />} />
                <Route path="employees/history" element={<WorkHistoryPage />} />
                <Route path="employees/docs" element={<DocumentsPage />} />
                <Route path="recruitment/jobs" element={<JobListingsPage />} />
                <Route
                  path="recruitment/candidates"
                  element={<CandidatesPage />}
                />
                <Route
                  path="recruitment/onboarding"
                  element={<OnboardingPage />}
                />
                <Route
                  path="onboarding"
                  element={<Navigate to="/recruitment/onboarding" replace />}
                />
                <Route path="leave" element={<LeaveRequestPage />} />
                <Route path="leave/quota" element={<LeaveQuotaPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="leave/calendar" element={<TeamCalendarPage />} />
                <Route path="travel" element={<TravelOverviewPage />} />
                <Route path="travel/trips" element={<TravelTripsPage />} />
                <Route
                  path="travel/approvals"
                  element={<TravelApprovalsPage />}
                />
                <Route
                  path="travel/settlements"
                  element={<TravelSettlementsPage />}
                />
                <Route path="travel/policy" element={<TravelPolicyPage />} />
                <Route path="travel/reports" element={<TravelReportsPage />} />
                <Route path="payroll" element={<PayrollPage />} />
                <Route path="payroll/payslips" element={<PayslipsPage />} />
                <Route path="payroll/allowances" element={<AllowancesPage />} />
                <Route path="payroll/insurance" element={<InsurancePage />} />
                <Route path="performance/cycles" element={<CyclesPage />} />
                <Route path="performance/okr" element={<OkrPage />} />
                <Route path="performance/360" element={<Review360Page />} />
                <Route path="performance/history" element={<PerfHistoryPage />} />
                <Route path="learning/courses" element={<CoursesPage />} />
                <Route path="learning/progress" element={<ProgressPage />} />
                <Route
                  path="learning/certificates"
                  element={<CertificatesPage />}
                />
                <Route path="learning/careers" element={<CareersPage />} />
                <Route path="policies/rules" element={<RulesPage />} />
                <Route path="policies/sop" element={<SopPage />} />
                <Route path="policies/legal" element={<LegalPage />} />
                <Route path="admin/permissions" element={<PermissionsPage />} />
                <Route path="admin/security" element={<SecurityPage />} />
                <Route
                  path="admin/integrations"
                  element={
                    <RequireSuperAdmin>
                      <IntegrationsPage />
                    </RequireSuperAdmin>
                  }
                />
                <Route path="admin/exports" element={<ExportsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
