import type { AnthropicMessage, AnthropicToolDef } from '@/types/architect'

const DIRECT_API_URL = 'https://api.anthropic.com/v1/messages'
const PROXY_API_URL = '/api/architect-chat'
const STORAGE_KEY = 'orbitforge-anthropic-key'
const MODEL = 'claude-sonnet-4-20250514'

// ─── API Key Management ───

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ─── Rate Limit Tracking (for proxy mode UI) ───

let remainingAnalyses: number | null = null
const remainingListeners = new Set<(n: number | null) => void>()

function updateRemainingAnalyses(n: number | null) {
  remainingAnalyses = n
  remainingListeners.forEach((fn) => fn(n))
}

export function getRemainingAnalyses(): number | null {
  return remainingAnalyses
}

export function onRemainingChange(fn: (n: number | null) => void): () => void {
  remainingListeners.add(fn)
  return () => { remainingListeners.delete(fn) }
}

// ─── Stream Event Types ───

export interface StreamEvent {
  type: string
  index?: number
  delta?: {
    type?: string
    text?: string
    partial_json?: string
  }
  content_block?: {
    type: string
    id?: string
    name?: string
    text?: string
    input?: Record<string, unknown>
  }
  message?: {
    id: string
    role: string
    stop_reason?: string | null
  }
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: {
    type: string
    message: string
  }
}

// ─── SSE Stream Parser (shared between both modes) ───

function parseSSEStream(response: Response): ReadableStream<StreamEvent> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream<StreamEvent>({
    async pull(controller) {
      let buffer = ''

      const processBuffer = () => {
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue
            try {
              const event = JSON.parse(data) as StreamEvent
              controller.enqueue(event)
            } catch {
              // Skip malformed events
            }
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            buffer += '\n'
            processBuffer()
          }
          controller.close()
          return
        }
        buffer += decoder.decode(value, { stream: true })
        processBuffer()
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}

// ─── Dual-Mode Chat: Proxy (default) or Direct (user key) ───

export async function sendChat(
  messages: AnthropicMessage[],
  tools: AnthropicToolDef[],
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<ReadableStream<StreamEvent>> {
  const userApiKey = getApiKey()

  if (userApiKey) {
    return sendDirect(messages, tools, systemPrompt, userApiKey, signal)
  }
  return sendProxy(messages, tools, systemPrompt, signal)
}

// ─── Proxy Mode (free tier, rate limited) ───

async function sendProxy(
  messages: AnthropicMessage[],
  tools: AnthropicToolDef[],
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<ReadableStream<StreamEvent>> {
  const response = await fetch(PROXY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      messages,
      tools: tools.length > 0 ? tools : undefined,
      system: systemPrompt,
    }),
  })

  if (response.status === 429) {
    let msg = 'Daily limit reached. Enter your own API key for unlimited access.'
    try {
      const errorData = await response.json()
      if (errorData.message) msg = errorData.message
    } catch { /* use default */ }
    updateRemainingAnalyses(0)
    throw new Error(`RATE_LIMITED:${msg}`)
  }

  if (!response.ok) {
    let errorMessage: string
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || `Proxy error ${response.status}`
    } catch {
      errorMessage = `Proxy error ${response.status}: ${response.statusText}`
    }
    throw new Error(errorMessage)
  }

  // Update remaining count from headers
  const remaining = response.headers.get('X-RateLimit-Remaining')
  if (remaining !== null) {
    updateRemainingAnalyses(parseInt(remaining, 10))
  }

  return parseSSEStream(response)
}

// ─── Direct Mode (user's own key, unlimited) ───

async function sendDirect(
  messages: AnthropicMessage[],
  tools: AnthropicToolDef[],
  systemPrompt: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ReadableStream<StreamEvent>> {
  const response = await fetch(DIRECT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    let errorMessage: string
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error?.message || `API error ${response.status}`
    } catch {
      errorMessage = `API error ${response.status}: ${response.statusText}`
    }

    if (response.status === 401) {
      clearApiKey()
      throw new Error('INVALID_KEY')
    }
    if (response.status === 429) {
      throw new Error('Rate limited by Anthropic. Please wait a moment and try again.')
    }
    throw new Error(errorMessage)
  }

  // Direct mode = unlimited, clear any proxy rate limit display
  updateRemainingAnalyses(null)

  return parseSSEStream(response)
}
