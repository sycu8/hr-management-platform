import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import type { Env } from '../env.ts'

export type PayrollCloseWorkflowParams = {
  organizationId: string
  payrollRunId: string
  yearMonth: string
  requestedByUserId?: string
}

/**
 * Stub: payroll close orchestration.
 * Must eventually enforce legal_review_status=approved before mutating closed runs.
 * Domain math belongs in shared/domain/payroll.
 */
export class PayrollCloseWorkflow extends WorkflowEntrypoint<
  Env,
  PayrollCloseWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<PayrollCloseWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<{ ok: boolean }> {
    await step.do('noop-payroll-close', async () => {
      console.log('PayrollCloseWorkflow stub', event.payload)
      return { acknowledged: true }
    })
    return { ok: true }
  }
}
