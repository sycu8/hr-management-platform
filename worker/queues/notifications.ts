import type { Env } from '../env.ts'

export type NotificationQueueMessage = {
  outboxId: string
}

type OutboxRow = {
  id: string
  recipient: string
  subject: string
  body_text: string
  body_html: string | null
  status: string
}

/**
 * Consume notification queue messages: mark outbox rows and attempt EMAIL send.
 */
export async function handleNotificationBatch(
  batch: MessageBatch<NotificationQueueMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processOne(message.body, env)
      message.ack()
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('notification consumer failed', message.body.outboxId, detail)
      message.retry()
    }
  }
}

async function processOne(
  body: NotificationQueueMessage,
  env: Env,
): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT id, recipient, subject, body_text, body_html, status
     FROM notification_outbox
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(body.outboxId)
    .first<OutboxRow>()

  if (!row) {
    console.warn('notification_outbox missing', body.outboxId)
    return
  }

  if (row.status === 'sent') {
    return
  }

  try {
    if (!env.EMAIL) {
      throw new Error('EMAIL binding unavailable')
    }

    await env.EMAIL.send({
      from: {
        email: env.EMAIL_FROM,
        name: env.EMAIL_FROM_NAME,
      },
      to: row.recipient,
      subject: row.subject,
      text: row.body_text,
      ...(row.body_html ? { html: row.body_html } : {}),
    })

    await env.DB.prepare(
      `UPDATE notification_outbox
       SET status = 'sent', error = NULL, sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
      .bind(row.id)
      .run()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    await env.DB.prepare(
      `UPDATE notification_outbox
       SET status = 'failed', error = ?
       WHERE id = ?`,
    )
      .bind(detail.slice(0, 2000), row.id)
      .run()
    throw err
  }
}
