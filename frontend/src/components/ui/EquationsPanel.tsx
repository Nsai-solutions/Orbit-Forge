import { useState } from 'react'

interface Variable {
  symbol: string
  definition: string
}

export interface Equation {
  name: string
  formula: string
  computed?: string
  description?: string
  variables?: Variable[]
}

interface EquationsPanelProps {
  equations: Equation[]
}

export default function EquationsPanel({ equations }: EquationsPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="glass-panel p-0 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-mono font-semibold">
          <span className="text-[13px]" aria-hidden>&#x1D453;</span>
          Equations
        </span>
        <svg
          className={`w-3 h-3 text-[var(--text-tertiary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {equations.map((eq) => (
            <div key={eq.name} className="rounded bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-1.5">
              <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                {eq.name}
              </div>
              <div className="font-mono text-[12px] text-accent-cyan leading-relaxed whitespace-pre-line">
                {eq.formula}
              </div>
              {eq.computed && (
                <div className="font-mono text-[11px] text-accent-green leading-relaxed whitespace-pre-line">
                  {eq.computed}
                </div>
              )}
              {eq.description && (
                <div className="text-[9px] text-[var(--text-tertiary)] leading-relaxed">
                  {eq.description}
                </div>
              )}
              {eq.variables && eq.variables.length > 0 && (
                <div className="space-y-0.5 pt-0.5">
                  {eq.variables.map((v) => (
                    <div key={v.symbol} className="text-[9px] text-[var(--text-tertiary)] leading-relaxed">
                      <span className="font-mono text-accent-purple/80">{v.symbol}</span>
                      {' = '}
                      {v.definition}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
