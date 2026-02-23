import type { AnthropicMessage, AnthropicToolDef } from '@/types/architect'

const API_URL = 'https://api.anthropic.com/v1/messages'
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

// ─── Streaming Chat ───

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

export async function sendChat(
  messages: AnthropicMessage[],
  tools: AnthropicToolDef[],
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<ReadableStream<StreamEvent>> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API key not configured')

  const response = await fetch(API_URL, {
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
      throw new Error('Invalid API key. Please re-enter your Anthropic API key.')
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.')
    }
    throw new Error(errorMessage)
  }

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
          // Process any remaining buffer
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
