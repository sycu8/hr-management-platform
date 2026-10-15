import { newId } from './ids.ts'

export type WriteAuditEventInput = {
  organizationId: string
  actorUserId?: string | null
  actorRole?: string | null
  actorEmail?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  detail: string
  ip?: string | null
  requestId?: string | null
  at?: string
}

export async function writeAuditEvent(
  db: D1Database,
  input: WriteAuditEventInput,
): Promise<string> {
  const id = newId()
  const at = input.at ?? new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO audit_events (
        id, organization_id, at, actor_user_id, actor_role, actor_email,
        action, entity_type, entity_id, detail, ip, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.organizationId,
      at,
      input.actorUserId ?? null,
      input.actorRole ?? null,
      input.actorEmail ?? null,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      input.detail,
      input.ip ?? null,
      input.requestId ?? null,
    )
    .run()

  return id
}
