import type { AuthUser } from '../middleware/auth.ts'

/**
 * Always attribute mutations to the real session owner (not view-as target).
 */
export async function resolveAuditActor(
  db: D1Database,
  user: AuthUser,
): Promise<{
  actorUserId: string
  actorEmail: string
  actorRole: string
}> {
  const session = await db
    .prepare(`SELECT user_id FROM sessions WHERE id = ? LIMIT 1`)
    .bind(user.sessionId)
    .first<{ user_id: string }>()

  const actorId = session?.user_id ?? user.effectiveUserId
  if (actorId === user.id && !user.viewAsUserId) {
    return {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.accountType,
    }
  }

  const actor = await db
    .prepare(
      `SELECT id, email, account_type FROM users WHERE id = ? LIMIT 1`,
    )
    .bind(actorId)
    .first<{ id: string; email: string; account_type: string }>()

  if (!actor) {
    return {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.accountType,
    }
  }

  return {
    actorUserId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.account_type,
  }
}
