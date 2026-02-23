// ─── Mission Architect Types ───

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  toolCalls?: ToolCallRecord[]
  isStreaming?: boolean
}

export interface ToolCallRecord {
  id: string
  toolName: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  status: 'pending' | 'running' | 'complete' | 'error'
  error?: string
}

export type MetricStatus = 'nominal' | 'warning' | 'critical'

export interface SummaryItem {
  label: string
  value: string
  unit?: string
  status?: MetricStatus
}

export interface MissionSummarySection {
  title: string
  moduleId?: string
  moduleLabel?: string
  items: SummaryItem[]
}

// Anthropic API types (minimal subset needed for tool use + streaming)

export interface AnthropicTextBlock {
  type: 'text'
  text: string
}

export interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export interface AnthropicToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}
