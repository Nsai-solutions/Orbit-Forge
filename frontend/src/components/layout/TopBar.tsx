import { useState } from 'react'
import { useStore } from '@/stores'
import { ModuleId, MODULE_LABELS, MODULE_NUMBERS } from '@/types'
import UTCClock from '@/components/ui/UTCClock'
import StatusIndicator from '@/components/ui/StatusIndicator'
import { generateMissionReport } from '@/lib/pdf-report'

const MODULES = Object.values(ModuleId)

interface TopBarProps {
  onSaveLoad?: () => void
}

export default function TopBar({ onSaveLoad }: TopBarProps) {
  const activeModule = useStore((s) => s.activeModule)
  const setActiveModule = useStore((s) => s.setActiveModule)
  const [reportStatus, setReportStatus] = useState<'idle' | 'generating'>('idle')

  const handleReport = async () => {
    setReportStatus('generating')
    try {
      await generateMissionReport(useStore.getState())
    } catch {
      // silent fail — user will see no file downloaded
    }
    setReportStatus('idle')
  }

  return (
    <div className="h-12 bg-space-800/90 backdrop-blur-md border-b border-white/5 flex items-center px-4 gap-6 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-6 h-6 rounded bg-accent-blue flex items-center justify-center">
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3" />
            <ellipse cx="8" cy="8" rx="7" ry="3" transform="rotate(-30 8 8)" />
          </svg>
        </div>
        <span className="font-mono font-bold text-sm tracking-widest text-[var(--text-primary)]">
          ORBITFORGE
        </span>
      </div>

      {/* Module Tabs */}
      <nav className="flex items-center gap-1 flex-1">
        {MODULES.map((moduleId) => {
          const isActive = moduleId === activeModule
          return (
            <button
              key={moduleId}
              onClick={() => setActiveModule(moduleId)}
              className={`
                px-3 py-1.5 rounded text-xs font-sans font-medium transition-all duration-150
                ${isActive
                  ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <span className="font-mono mr-1.5 text-[10px] opacity-60">
                {MODULE_NUMBERS[moduleId]}
              </span>
              {MODULE_LABELS[moduleId]}
            </button>
          )
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleReport}
          disabled={reportStatus === 'generating'}
          className="px-3 py-1 rounded text-[11px] font-sans text-[var(--text-secondary)] border border-white/10 hover:border-accent-blue/30 hover:text-accent-blue transition-all disabled:opacity-50"
        >
          {reportStatus === 'generating' ? 'Generating...' : 'Report'}
        </button>
        {onSaveLoad && (
          <button
            onClick={onSaveLoad}
            className="px-3 py-1 rounded text-[11px] font-sans text-[var(--text-secondary)] border border-white/10 hover:border-accent-blue/30 hover:text-accent-blue transition-all"
          >
            Save/Load
          </button>
        )}
        <StatusIndicator status="nominal" label="SYS" size="sm" />
        <div className="w-px h-5 bg-white/10" />
        <UTCClock />
      </div>
    </div>
  )
}
