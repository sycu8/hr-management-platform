/** Generate a new UUID (v4). */
export function newId(): string {
  return crypto.randomUUID()
}

/** Generate a request/correlation id. */
export function newRequestId(): string {
  return crypto.randomUUID()
}
