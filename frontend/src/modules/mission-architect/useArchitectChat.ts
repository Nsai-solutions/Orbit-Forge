import { useCallback, useRef } from 'react'
import { useStore } from '@/stores'
import { sendChat } from '@/lib/anthropic-client'
import type { StreamEvent } from '@/lib/anthropic-client'
import { TOOL_DEFINITIONS, executeToolCall } from '@/lib/architect-tools'
import { ARCHITECT_SYSTEM_PROMPT } from '@/lib/architect-system-prompt'
import type {
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicToolUseBlock,
  ChatMessage,
  ToolCallRecord,
} from '@/types/architect'

let messageIdCounter = 0
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`
}

function buildApiMessages(messages: ChatMessage[]): AnthropicMessage[] {
  const apiMessages: AnthropicMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      apiMessages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = []

      if (msg.content) {
        blocks.push({ type: 'text', text: msg.content })
      }

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.toolName,
            input: tc.input,
          })
        }
      }

      if (blocks.length > 0) {
        apiMessages.push({ role: 'assistant', content: blocks })
      }

      // Add tool results as user messages (Anthropic API format)
      if (msg.toolCalls) {
        const toolResults: AnthropicContentBlock[] = []
        for (const tc of msg.toolCalls) {
          if (tc.status === 'complete' || tc.status === 'error') {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tc.id,
              content: tc.error
                ? JSON.stringify({ error: tc.error })
                : JSON.stringify(tc.output),
              is_error: tc.status === 'error',
            })
          }
        }
        if (toolResults.length > 0) {
          apiMessages.push({ role: 'user', content: toolResults })
        }
      }
    }
  }

  return apiMessages
}

export function useArchitectChat() {
  const store = useStore()
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (userText: string) => {
    const {
      addArchitectMessage,
      updateArchitectMessage,
      setArchitectStreaming,
      setArchitectError,
      architectMessages,
    } = store

    setArchitectError(null)
    setArchitectStreaming(true)

    // Add user message
    const userId = nextId()
    const userMsg: ChatMessage = {
      id: userId,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    }
    addArchitectMessage(userMsg)

    // Process the conversation (may loop for tool use)
    await processConversation([...architectMessages, userMsg])
  }, [store])

  const processConversation = useCallback(async (allMessages: ChatMessage[]) => {
    const {
      addArchitectMessage,
      updateArchitectMessage,
      setArchitectStreaming,
      setArchitectError,
    } = store

    const assistantId = nextId()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      toolCalls: [],
    }
    addArchitectMessage(assistantMsg)

    let textContent = ''

    try {
      const abort = new AbortController()
      abortRef.current = abort

      const apiMessages = buildApiMessages(allMessages)
      const stream = await sendChat(apiMessages, TOOL_DEFINITIONS, ARCHITECT_SYSTEM_PROMPT, abort.signal)
      const reader = stream.getReader()
      let currentToolCalls: ToolCallRecord[] = []
      let currentToolUseId = ''
      let currentToolName = ''
      let currentToolJson = ''
      let stopReason: string | null = null

      // Batched updates for text streaming
      let pendingTextUpdate = false

      const flushText = () => {
        if (pendingTextUpdate) {
          updateArchitectMessage(assistantId, { content: textContent })
          pendingTextUpdate = false
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const event = value as StreamEvent

        switch (event.type) {
          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              currentToolUseId = event.content_block.id || ''
              currentToolName = event.content_block.name || ''
              currentToolJson = ''
            }
            break

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta' && event.delta.text) {
              textContent += event.delta.text
              pendingTextUpdate = true
              // Batch updates — flush every frame
              if (!pendingTextUpdate) {
                requestAnimationFrame(flushText)
              }
              // Flush every ~100 chars for responsiveness
              if (textContent.length % 100 < 5) {
                flushText()
              }
            }
            if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
              currentToolJson += event.delta.partial_json
            }
            break

          case 'content_block_stop':
            if (currentToolUseId && currentToolName) {
              let toolInput: Record<string, unknown> = {}
              try {
                toolInput = JSON.parse(currentToolJson)
              } catch {
                // Partial JSON — try to use what we have
              }
              currentToolCalls.push({
                id: currentToolUseId,
                toolName: currentToolName,
                input: toolInput,
                output: null,
                status: 'pending',
              })
              currentToolUseId = ''
              currentToolName = ''
              currentToolJson = ''
            }
            break

          case 'message_delta':
            if (event.delta && 'stop_reason' in event.delta) {
              stopReason = (event.delta as Record<string, unknown>).stop_reason as string | null
            }
            break

          case 'error':
            throw new Error(event.error?.message || 'Stream error')
        }
      }

      // Final text flush
      flushText()

      // Update assistant message with tool calls
      updateArchitectMessage(assistantId, {
        content: textContent,
        toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
        isStreaming: false,
      })

      // If we stopped for tool use, execute tools and continue
      if (stopReason === 'tool_use' && currentToolCalls.length > 0) {
        // Execute each tool
        const executedToolCalls: ToolCallRecord[] = []
        for (const tc of currentToolCalls) {
          try {
            const result = executeToolCall(tc.toolName, tc.input)
            executedToolCalls.push({
              ...tc,
              output: result,
              status: 'complete',
            })
          } catch (err) {
            executedToolCalls.push({
              ...tc,
              output: null,
              status: 'error',
              error: err instanceof Error ? err.message : 'Tool execution failed',
            })
          }
        }

        // Update the assistant message with tool results
        updateArchitectMessage(assistantId, {
          toolCalls: executedToolCalls,
        })

        // Build updated message list including this assistant turn with tool results
        const updatedAssistant: ChatMessage = {
          ...assistantMsg,
          content: textContent,
          toolCalls: executedToolCalls,
          isStreaming: false,
        }

        const updatedMessages = [...allMessages, updatedAssistant]

        // Continue the conversation with tool results
        await processConversation(updatedMessages)
        return
      }

      // Done — mark streaming complete
      setArchitectStreaming(false)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        updateArchitectMessage(assistantId, { isStreaming: false })
        setArchitectStreaming(false)
        return
      }

      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setArchitectError(errorMessage)
      updateArchitectMessage(assistantId, {
        isStreaming: false,
        content: textContent || '',
      })
      setArchitectStreaming(false)
    }
  }, [store])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
    store.setArchitectStreaming(false)
  }, [store])

  return { sendMessage, cancelStream }
}
