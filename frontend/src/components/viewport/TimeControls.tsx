import { useEffect, useCallback } from 'react'
import { useStore } from '@/stores'
import { SIM_SPEED_PRESETS } from '@/stores/simulation-slice'

export default function TimeControls() {
  const simPlaying = useStore((s) => s.simPlaying)
  const simSpeed = useStore((s) => s.simSpeed)
  const simTime = useStore((s) => s.simTime)
  const toggleSimPlaying = useStore((s) => s.toggleSimPlaying)
  const setSimSpeed = useStore((s) => s.setSimSpeed)
  const resetSimulation = useStore((s) => s.resetSimulation)

  const timeStr = simTime > 0
    ? new Date(simTime).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '--'

  const stepSpeed = useCallback((direction: 1 | -1) => {
    const idx = SIM_SPEED_PRESETS.indexOf(simSpeed as typeof SIM_SPEED_PRESETS[number])
    const next = idx + direction
    if (next >= 0 && next < SIM_SPEED_PRESETS.length) {
      setSimSpeed(SIM_SPEED_PRESETS[next])
    }
  }, [simSpeed, setSimSpeed])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    switch (e.key) {
      case ' ':
        e.preventDefault()
        toggleSimPlaying()
        break
      case '+':
      case '=':
        stepSpeed(1)
        break
      case '-':
      case '_':
        stepSpeed(-1)
        break
      case 'r':
      case 'R':
        resetSimulation()
        break
    }
  }, [toggleSimPlaying, stepSpeed, resetSimulation])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-space-900/80 backdrop-blur-sm px-2.5 py-1.5 select-none">
      {/* Reset */}
      <button
        onClick={resetSimulation}
        className="px-1.5 py-0.5 text-[var(--text-tertiary)] hover:text-accent-blue transition-colors"
        title="Reset (R)"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1v5h5" />
          <path d="M3.51 10a6 6 0 1 0 .49-5.5L1 6" />
        </svg>
      </button>

      {/* Step backward */}
      <button
        onClick={() => stepSpeed(-1)}
        className="px-1 py-0.5 text-[var(--text-tertiary)] hover:text-accent-blue transition-colors"
        title="Slower (-)"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M10 2L4 8l6 6V2z" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={() => toggleSimPlaying()}
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
          simPlaying
            ? 'bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25'
            : 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25'
        }`}
        title="Play/Pause (Space)"
      >
        {simPlaying ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={() => stepSpeed(1)}
        className="px-1 py-0.5 text-[var(--text-tertiary)] hover:text-accent-blue transition-colors"
        title="Faster (+)"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 2l6 6-6 6V2z" />
        </svg>
      </button>

      {/* Speed presets */}
      <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-2">
        {SIM_SPEED_PRESETS.map((speed) => (
          <button
            key={speed}
            onClick={() => setSimSpeed(speed)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
              simSpeed === speed
                ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Sim time readout */}
      <div className="ml-1.5 border-l border-white/10 pl-2 font-mono text-[10px] text-accent-cyan tracking-wide min-w-[148px]">
        {simPlaying && <span className="text-accent-amber mr-1">SIM</span>}
        {timeStr}
      </div>
    </div>
  )
}
