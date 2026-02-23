import { useState, useEffect } from 'react'
import { getApiKey, setApiKey, clearApiKey, getRemainingAnalyses, onRemainingChange } from '@/lib/anthropic-client'

export default function AccessBadge() {
  const [hasKey, setHasKey] = useState(() => !!getApiKey())
  const [remaining, setRemaining] = useState<number | null>(getRemainingAnalyses)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [keyError, setKeyError] = useState('')

  useEffect(() => {
    return onRemainingChange((n) => setRemaining(n))
  }, [])

  const handleSaveKey = () => {
    const trimmed = keyInput.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setKeyError('Keys start with sk-ant-')
      return
    }
    setApiKey(trimmed)
    setHasKey(true)
    setShowKeyInput(false)
    setKeyInput('')
    setKeyError('')
  }

  const handleRemoveKey = () => {
    clearApiKey()
    setHasKey(false)
  }

  // Rate limit exhausted
  if (!hasKey && remaining === 0) {
    return (
      <div className="mx-3 mb-2 rounded border border-accent-amber/20 bg-accent-amber/5 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-accent-amber">&#9888;</span>
          <span className="text-accent-amber">Daily limit reached</span>
        </div>
        {showKeyInput ? (
          <div className="mt-2 space-y-1.5">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey() }}
              placeholder="sk-ant-..."
              className="input-field w-full text-[11px]"
              autoFocus
            />
            {keyError && <p className="text-[10px] text-accent-red">{keyError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSaveKey} className="text-[10px] text-accent-blue hover:underline">Save</button>
              <button onClick={() => setShowKeyInput(false)} className="text-[10px] text-[var(--text-tertiary)] hover:underline">Cancel</button>
            </div>
            <p className="text-[9px] text-[var(--text-tertiary)]">
              Stored locally, sent directly to Anthropic. We never see it.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowKeyInput(true)}
            className="mt-1 text-[10px] text-accent-blue hover:underline"
          >
            Enter your API key for unlimited access &rarr;
          </button>
        )}
      </div>
    )
  }

  // Using own key
  if (hasKey) {
    return (
      <div className="mx-3 mb-2 rounded border border-accent-green/15 bg-accent-green/5 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-accent-green text-[10px]">&#9679;</span>
          <span className="text-[var(--text-secondary)]">Using your API key &mdash; Unlimited</span>
        </div>
        <button
          onClick={handleRemoveKey}
          className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          Remove
        </button>
      </div>
    )
  }

  // Free tier with remaining
  return (
    <div className="mx-3 mb-2 rounded border border-white/5 bg-white/[0.02] px-3 py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-accent-green text-[10px]">&#9679;</span>
          <span className="text-[var(--text-secondary)]">
            Free Tier
            {remaining !== null && <span className="text-[var(--text-tertiary)]"> &mdash; {remaining} of 10 remaining today</span>}
          </span>
        </div>
      </div>
      {showKeyInput ? (
        <div className="mt-2 space-y-1.5">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setKeyError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey() }}
            placeholder="sk-ant-..."
            className="input-field w-full text-[11px]"
            autoFocus
          />
          {keyError && <p className="text-[10px] text-accent-red">{keyError}</p>}
          <div className="flex gap-2">
            <button onClick={handleSaveKey} className="text-[10px] text-accent-blue hover:underline">Save</button>
            <button onClick={() => setShowKeyInput(false)} className="text-[10px] text-[var(--text-tertiary)] hover:underline">Cancel</button>
          </div>
          <p className="text-[9px] text-[var(--text-tertiary)]">
            Stored locally, sent directly to Anthropic. We never see it.
          </p>
        </div>
      ) : (
        <button
          onClick={() => setShowKeyInput(true)}
          className="text-[10px] text-accent-blue hover:underline mt-0.5"
        >
          Use your own API key &rarr;
        </button>
      )}
    </div>
  )
}
