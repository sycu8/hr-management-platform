import { createApp } from './app.ts'
import type { Env } from './env.ts'
import { handleJobBatch, type JobQueueMessage } from './queues/jobs.ts'
import {
  handleNotificationBatch,
  type NotificationQueueMessage,
} from './queues/notifications.ts'

export { ReminderWorkflow } from './workflows/reminder.ts'
export { PayrollCloseWorkflow } from './workflows/payroll-close.ts'

const app = createApp()

const NOTIFICATIONS_QUEUE = 'hrm-notifications'
const JOBS_QUEUE = 'hrm-jobs'

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return app.fetch(request, env, ctx)
  },

  async queue(
    batch: MessageBatch<NotificationQueueMessage | JobQueueMessage>,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    if (batch.queue === NOTIFICATIONS_QUEUE) {
      await handleNotificationBatch(
        batch as MessageBatch<NotificationQueueMessage>,
        env,
      )
      return
    }

    if (batch.queue === JOBS_QUEUE) {
      await handleJobBatch(batch as MessageBatch<JobQueueMessage>, env)
      return
    }

    console.warn('unknown queue', batch.queue)
    batch.ackAll()
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // Cron: `0 1 * * *` — reminder / expiry sweeps start workflows later.
    ctx.waitUntil(
      (async () => {
        console.log('scheduled stub', controller.cron, controller.scheduledTime)
        if (!env.REMINDER_WORKFLOW) return
        try {
          await env.REMINDER_WORKFLOW.create({
            id: `reminder-${controller.scheduledTime}`,
            params: { organizationId: 'org_demo', kind: 'daily' },
          })
        } catch (err) {
          console.error('reminder_workflow_failed', err)
        }
      })(),
    )
  },
} satisfies ExportedHandler<Env, NotificationQueueMessage | JobQueueMessage>

export default worker
