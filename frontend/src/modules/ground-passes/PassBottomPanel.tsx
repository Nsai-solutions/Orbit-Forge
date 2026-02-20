import { useState } from 'react'
import PassTimelineChart from './PassTimelineChart'
import LinkBudgetChart from './LinkBudgetChart'

const TABS = [
  { id: 'timeline', label: 'Pass Timeline' },
  { id: 'link', label: 'Link Budget' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function PassBottomPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline')

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
        {activeTab === 'timeline' && <PassTimelineChart />}
        {activeTab === 'link' && <LinkBudgetChart />}
      </div>
    </div>
  )
}
