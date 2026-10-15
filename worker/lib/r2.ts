/**
 * R2 object key helpers for the DOCUMENTS bucket (`hrm-documents`).
 *
 * Existing employee docs: `{orgId}/docs/{employeeId}/{slug}.ext`
 * Policy attachments:    `{orgId}/docs/policies/{policyId}/{attachmentId}/{safeFileName}`
 */

const UNSAFE = /[^a-zA-Z0-9._\-\u00C0-\u024F\u1E00-\u1EFF ]+/g

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop()?.trim() || 'file'
  const cleaned = base.replace(UNSAFE, '_').replace(/\s+/g, '_').slice(0, 180)
  return cleaned || 'file'
}

export function employeeDocumentKey(
  organizationId: string,
  employeeId: string,
  fileName: string,
): string {
  return `${organizationId}/docs/${employeeId}/${safeFileName(fileName)}`
}

/** Profile portrait: `{orgId}/docs/{employeeId}/photo/{photoId}/{safeFileName}` */
export function employeePhotoKey(
  organizationId: string,
  employeeId: string,
  photoId: string,
  fileName: string,
): string {
  return `${organizationId}/docs/${employeeId}/photo/${photoId}/${safeFileName(fileName)}`
}

export function policyAttachmentKey(
  organizationId: string,
  policyId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${organizationId}/docs/policies/${policyId}/${attachmentId}/${safeFileName(fileName)}`
}

export async function putDocumentBytes(
  bucket: R2Bucket,
  key: string,
  bytes: ArrayBuffer | ReadableStream | Blob,
  contentType: string | undefined,
): Promise<R2Object> {
  return bucket.put(key, bytes, {
    httpMetadata: contentType
      ? { contentType }
      : { contentType: 'application/octet-stream' },
  })
}

export function r2ObjectResponse(
  object: R2ObjectBody,
  fileName: string,
  disposition: 'inline' | 'attachment' = 'inline',
): Response {
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  )
  headers.set('Cache-Control', 'private, max-age=60')
  return new Response(object.body, { headers })
}
