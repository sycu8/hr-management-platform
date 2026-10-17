import type { Env } from '../env.ts'

/** Cheapest active multilingual text model (Workers AI pricing). */
const DEFAULT_MODEL = '@cf/meta/llama-3.2-1b-instruct'

type GatewayOptions = {
  id: string
  skipCache?: boolean
  cacheTtl?: number
  metadata?: Record<string, string>
}

/**
 * Run Workers AI through AI Gateway.
 * Uses `AI_GATEWAY_ID` (default "default" — auto-created on first auth request).
 */
export async function runWorkersAiViaGateway(
  env: Env,
  input: {
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    prompt?: string
    max_tokens?: number
  },
  opts?: { model?: string; skipCache?: boolean; metadata?: Record<string, string> },
): Promise<{ text: string; model: string; gatewayId: string }> {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error('Workers AI binding unavailable')
  }

  const gatewayId = (env.AI_GATEWAY_ID || 'default').trim() || 'default'
  const model = opts?.model || env.AI_MODEL || DEFAULT_MODEL
  const gateway: GatewayOptions = {
    id: gatewayId,
    skipCache: opts?.skipCache ?? false,
    metadata: opts?.metadata,
  }

  const result = await env.AI.run(
    model as Parameters<Ai['run']>[0],
    {
      messages: input.messages,
      prompt: input.prompt,
      max_tokens: input.max_tokens ?? 900,
    } as Parameters<Ai['run']>[1],
    { gateway },
  )

  const text = extractText(result)
  return { text, model, gatewayId }
}

function extractText(result: unknown): string {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return ''
  const row = result as Record<string, unknown>
  if (typeof row.response === 'string') return row.response
  if (typeof row.text === 'string') return row.text
  if (typeof row.result === 'string') return row.result
  try {
    return JSON.stringify(result)
  } catch {
    return ''
  }
}
