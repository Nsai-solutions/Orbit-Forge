import { useState, ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}

export default function SectionHeader({ title, children, defaultOpen = true, actions }: SectionHeaderProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="glass-panel p-0 overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
        >
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-mono font-semibold">
            {title}
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
        {actions && (
          <div className="pr-3" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  )
}
