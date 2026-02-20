import { useState } from 'react'
import PowerChart from './PowerChart'
import ThermalChart from './ThermalChart'

const TABS = [
  { id: 'power', label: 'Power Profile' },
  { id: 'thermal', label: 'Thermal Profile' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function PowerBottomPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('power')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1 rounded text-[10px] font-mono font-medium transition-all
              ${activeTab === tab.id
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 border border-transparent'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'power' && <PowerChart />}
        {activeTab === 'thermal' && <ThermalChart />}
      </div>
    </div>
  )
}
