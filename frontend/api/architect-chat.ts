export const config = {
  runtime: 'edge',
}

// ─── Rate Limiter (in-memory, approximate) ───
// Resets on cold starts — this is fine for cost control, not security.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const DAILY_LIMIT = 10
const DAY_MS = 24 * 60 * 60 * 1000

function checkRateLimit(ip: string): {
  allowed: boolean
  remaining: number
  resetTime: number
  resetHours: number
} {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + DAY_MS })
    return { allowed: true, remaining: DAILY_LIMIT - 1, resetTime: now + DAY_MS, resetHours: 24 }
  }

  if (record.count >= DAILY_LIMIT) {
    const resetHours = Math.ceil((record.resetTime - now) / (60 * 60 * 1000))
    return { allowed: false, remaining: 0, resetTime: record.resetTime, resetHours }
  }

  record.count++
  const remaining = DAILY_LIMIT - record.count
  const resetHours = Math.ceil((record.resetTime - now) / (60 * 60 * 1000))
  return { allowed: true, remaining, resetTime: record.resetTime, resetHours }
}

// ─── Edge Function Handler ───

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limiting by IP
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateResult = checkRateLimit(clientIP)

  if (!rateResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: `You've reached the free tier limit of ${DAILY_LIMIT} analyses per day. Enter your own Anthropic API key for unlimited access.`,
        remaining: 0,
        reset_hours: rateResult.resetHours,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateResult.resetTime),
        },
      },
    )
  }

  // Validate request
  let body: {
    messages?: unknown[]
    tools?: unknown[]
    system?: string
    model?: string
    max_tokens?: number
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: 'Invalid request: messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Forward to Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 4096,
        system: body.system,
        messages: body.messages,
        tools: body.tools,
        stream: true,
      }),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      return new Response(JSON.stringify({ error: 'API error', detail: errText }), {
        status: anthropicResponse.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Stream response back with rate limit headers
    return new Response(anthropicResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Remaining': String(rateResult.remaining),
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to reach AI service' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
