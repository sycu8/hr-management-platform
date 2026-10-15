import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ExportsPage } from './pages/admin/ExportsPage'
import { IntegrationsPage } from './pages/admin/IntegrationsPage'
import { PermissionsPage } from './pages/admin/PermissionsPage'
import { SecurityPage } from './pages/admin/SecurityPage'
import { AlertsPage } from './pages/dashboard/AlertsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { EventsPage } from './pages/dashboard/EventsPage'
import { PresencePage } from './pages/dashboard/PresencePage'
import { DocumentsPage } from './pages/employees/DocumentsPage'
import { EmployeeProfilesPage } from './pages/employees/EmployeeProfilesPage'
import { JobProfilesPage } from './pages/employees/JobProfilesPage'
import { WorkHistoryPage } from './pages/employees/WorkHistoryPage'
import { AttendancePage } from './pages/leave/AttendancePage'
import { LeaveQuotaPage } from './pages/leave/LeaveQuotaPage'
import { LeaveRequestPage } from './pages/leave/LeaveRequestPage'
import { TeamCalendarPage } from './pages/leave/TeamCalendarPage'
import { CareersPage } from './pages/learning/CareersPage'
import { CertificatesPage } from './pages/learning/CertificatesPage'
import { CoursesPage } from './pages/learning/CoursesPage'
import { ProgressPage } from './pages/learning/ProgressPage'
import { AllowancesPage } from './pages/payroll/AllowancesPage'
import { InsurancePage } from './pages/payroll/InsurancePage'
import { PayrollPage } from './pages/payroll/PayrollPage'
import { PayslipsPage } from './pages/payroll/PayslipsPage'
import { CyclesPage } from './pages/performance/CyclesPage'
import { OkrPage } from './pages/performance/OkrPage'
import { PerfHistoryPage } from './pages/performance/PerfHistoryPage'
import { Review360Page } from './pages/performance/Review360Page'
import { LegalPage } from './pages/policies/LegalPage'
import { RulesPage } from './pages/policies/RulesPage'
import { SopPage } from './pages/policies/SopPage'
import { CandidatesPage } from './pages/recruitment/CandidatesPage'
import { JobListingsPage } from './pages/recruitment/JobListingsPage'
import { OnboardingPage } from './pages/recruitment/OnboardingPage'
import { TravelApprovalsPage } from './pages/travel/TravelApprovalsPage'
import { TravelOverviewPage } from './pages/travel/TravelOverviewPage'
import { TravelPolicyPage } from './pages/travel/TravelPolicyPage'
import { TravelReportsPage } from './pages/travel/TravelReportsPage'
import { TravelSettlementsPage } from './pages/travel/TravelSettlementsPage'
import { TravelTripsPage } from './pages/travel/TravelTripsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="recruitment/candidates" element={<CandidatesPage />} />
          <Route path="recruitment/onboarding" element={<OnboardingPage />} />
          <Route path="leave" element={<LeaveRequestPage />} />
          <Route path="leave/quota" element={<LeaveQuotaPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave/calendar" element={<TeamCalendarPage />} />
          <Route path="travel" element={<TravelOverviewPage />} />
          <Route path="travel/trips" element={<TravelTripsPage />} />
          <Route path="travel/approvals" element={<TravelApprovalsPage />} />
          <Route path="travel/settlements" element={<TravelSettlementsPage />} />
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
          <Route path="learning/certificates" element={<CertificatesPage />} />
          <Route path="learning/careers" element={<CareersPage />} />
          <Route path="policies/rules" element={<RulesPage />} />
          <Route path="policies/sop" element={<SopPage />} />
          <Route path="policies/legal" element={<LegalPage />} />
          <Route path="admin/permissions" element={<PermissionsPage />} />
          <Route path="admin/security" element={<SecurityPage />} />
          <Route path="admin/integrations" element={<IntegrationsPage />} />
          <Route path="admin/exports" element={<ExportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
