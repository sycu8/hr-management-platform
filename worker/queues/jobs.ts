import type { Env } from '../env.ts'

export type JobQueueMessage = {
  kind: string
  payload?: Record<string, unknown>
}

/**
 * Stub consumer for background jobs (exports, payroll close prep, etc.).
 * Domain work will live in shared/domain + dedicated job handlers later.
 */
export async function handleJobBatch(
  batch: MessageBatch<JobQueueMessage>,
  _env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    console.log('jobs queue stub', message.body.kind, message.body.payload ?? {})
    message.ack()
  }
}
