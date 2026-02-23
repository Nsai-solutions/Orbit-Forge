import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores'
import { useArchitectChat } from './useArchitectChat'
import AccessBadge from './AccessBadge'
import type { ChatMessage, ToolCallRecord } from '@/types/architect'

// ─── Simple Markdown Renderer ───

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-space-900/50 rounded p-2 my-1 text-[11px] overflow-x-auto"><code>$2</code></pre>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-space-900/50 px-1 rounded text-accent-cyan text-[11px]">$1</code>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text-primary)] font-semibold">$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-3">$1</li>')
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc space-y-0.5 my-1">$&</ul>')
  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-3">$1</li>')
  // Line breaks
  html = html.replace(/\n/g, '<br/>')
  return html
}

// ─── Tool Call Indicator ───

function ToolCallIndicator({ toolCall }: { toolCall: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false)
  const toolLabels: Record<string, string> = {
    analyze_orbit: 'Analyzing orbit',
    compute_power_budget: 'Computing power budget',
    compute_ground_passes: 'Computing ground passes',
    predict_lifetime: 'Predicting lifetime',
    analyze_payload: 'Analyzing payload',
    set_visualization: 'Rendering visualization',
  }

  const label = toolLabels[toolCall.toolName] || toolCall.toolName
  const isRunning = toolCall.status === 'pending' || toolCall.status === 'running'
  const isError = toolCall.status === 'error'

  return (
    <div className="my-1.5 rounded border border-white/5 bg-space-900/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-white/[0.02] transition-colors"
      >
        {isRunning && (
          <span className="w-3 h-3 rounded-full border-2 border-accent-cyan/30 border-t-accent-cyan animate-spin" />
        )}
        {!isRunning && !isError && (
          <span className="text-accent-green text-xs">&#10003;</span>
        )}
        {isError && (
          <span className="text-accent-red text-xs">&#10007;</span>
        )}
        <span className="text-[var(--text-secondary)]">
          {isRunning ? `${label}...` : label}
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && toolCall.output && (
        <div className="px-2.5 pb-2 border-t border-white/5">
          <pre className="text-[10px] text-[var(--text-secondary)] mt-1.5 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(toolCall.output, null, 2)}
          </pre>
        </div>
      )}
      {expanded && toolCall.error && (
        <div className="px-2.5 pb-2 border-t border-white/5">
          <p className="text-[11px] text-accent-red mt-1.5">{toolCall.error}</p>
        </div>
      )}
    </div>
  )
}

// ─── Chat Bubble ───

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-accent-blue/10 border border-accent-blue/20 text-[var(--text-primary)]'
            : 'bg-white/[0.03] border border-white/5 text-[var(--text-secondary)]'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.content && (
              <div
                className="architect-markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            )}
            {message.toolCalls?.map((tc) => (
              <ToolCallIndicator key={tc.id} toolCall={tc} />
            ))}
            {message.isStreaming && !message.content && (
              <span className="inline-flex gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan/50 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan/50 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan/50 animate-pulse [animation-delay:0.4s]" />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Welcome Message ───

function WelcomeMessage({ onSelect }: { onSelect: (text: string) => void }) {
  const examples = [
    'Design a 3U CubeSat Earth observation mission at 550km SSO with sub-5m GSD',
    'Plan a 6U SATCOM relay satellite at 600km, 45 degree inclination',
    'I want to image forests in the Amazon from a small satellite — what orbit and payload do I need?',
  ]

  return (
    <div className="space-y-4 py-4">
      <div className="text-center space-y-2">
        <p className="text-sm text-[var(--text-primary)] font-medium">Mission Architect</p>
        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          Describe your satellite mission in natural language. I'll extract parameters
          and run OrbitForge's calculation engines to produce a complete analysis.
        </p>
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] text-center">
          Try an example
        </p>
        {examples.map((ex, i) => (
          <button
            key={i}
            onClick={() => onSelect(ex)}
            className="w-full text-left px-3 py-2 rounded border border-white/5 bg-white/[0.02] text-xs text-[var(--text-secondary)] hover:bg-white/[0.05] hover:border-accent-cyan/20 transition-colors leading-relaxed"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Error Banner ───

function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="mx-1 rounded border border-accent-red/20 bg-accent-red/5 px-3 py-2 flex items-start gap-2">
      <span className="text-accent-red text-xs mt-0.5">&#9888;</span>
      <div className="flex-1">
        <p className="text-xs text-accent-red">{error}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      >
        &#10005;
      </button>
    </div>
  )
}

// ─── Main Chat Panel ───

export default function ChatPanel() {
  const messages = useStore((s) => s.architectMessages)
  const isStreaming = useStore((s) => s.architectIsStreaming)
  const error = useStore((s) => s.architectError)
  const setError = useStore((s) => s.setArchitectError)
  const clearSession = useStore((s) => s.clearArchitectSession)
  const { sendMessage, cancelStream } = useArchitectChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleSend = (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || isStreaming) return
    setInput('')
    sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Header */}
      <div className="h-11 min-h-[44px] flex items-center px-4 border-b border-white/5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
          Mission Architect
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearSession}
            className="ml-auto text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            New Session
          </button>
        )}
      </div>

      {/* Access Mode Badge */}
      <AccessBadge />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && <WelcomeMessage onSelect={handleSend} />}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your mission..."
            className="input-field flex-1 text-xs resize-none leading-relaxed"
            rows={2}
            disabled={isStreaming}
          />
          <button
            onClick={() => (isStreaming ? cancelStream() : handleSend())}
            disabled={!isStreaming && !input.trim()}
            className={`px-4 rounded text-xs font-medium transition-colors self-end ${
              isStreaming
                ? 'bg-accent-red/20 text-accent-red border border-accent-red/30 hover:bg-accent-red/30'
                : 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/30 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            style={{ height: '36px' }}
          >
            {isStreaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>
    </>
  )
}
