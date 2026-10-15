import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import type { Env } from '../env.ts'

export type ReminderWorkflowParams = {
  organizationId: string
  kind?: string
}

/**
 * Stub: document expiry / leave / trip reminders.
 * Wire steps to NOTIFICATIONS queue + D1 queries in a later pass.
 */
export class ReminderWorkflow extends WorkflowEntrypoint<
  Env,
  ReminderWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<ReminderWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<{ ok: boolean }> {
    await step.do('noop-reminder', async () => {
      console.log('ReminderWorkflow stub', event.payload)
      return { acknowledged: true }
    })
    return { ok: true }
  }
}
