import { useState } from 'react'
import { setApiKey } from '@/lib/anthropic-client'

interface Props {
  onKeySet: () => void
}

export default function ApiKeySetup({ onKeySet }: Props) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const trimmed = key.trim()
    if (!trimmed) {
      setError('Please enter an API key')
      return
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Invalid format — Anthropic API keys start with sk-ant-')
      return
    }
    setApiKey(trimmed)
    onKeySet()
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-space-900">
      <div className="glass-panel p-8 max-w-md w-full space-y-5">
        <div>
          <h2 className="text-base font-sans font-semibold text-[var(--text-primary)] mb-1">
            Mission Architect
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            AI-powered mission design using OrbitForge's validated calculation engines.
            Enter your Anthropic API key to get started.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            Anthropic API Key
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="sk-ant-..."
            className="input-field w-full text-sm"
            autoFocus
          />
          {error && <p className="text-[11px] text-accent-red">{error}</p>}
          <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
            Your key is stored locally in your browser and is only sent to Anthropic's API.
            It is never sent to any other server.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full px-4 py-2.5 rounded text-sm font-medium bg-accent-blue/20 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/30 transition-colors"
        >
          Save & Start
        </button>
      </div>
    </div>
  )
}
