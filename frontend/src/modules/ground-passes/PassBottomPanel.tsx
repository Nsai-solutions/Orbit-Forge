import { useState } from 'react'
import PassTimelineChart from './PassTimelineChart'
import LinkBudgetChart from './LinkBudgetChart'
import SkyPlotChart from './SkyPlotChart'
import ContactTimelineChart from './ContactTimelineChart'
import LinkBudgetWaterfallChart from './LinkBudgetWaterfallChart'

const TABS = [
  { id: 'timeline', label: 'Pass Timeline' },
  { id: 'contact', label: 'Contact Timeline' },
  { id: 'waterfall', label: 'Link Waterfall' },
  { id: 'link', label: 'Link vs Elevation' },
  { id: 'skyplot', label: 'Sky Plot' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function PassBottomPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1 rounded text-[10px] font-mono font-medium transition-all whitespace-nowrap
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
        {activeTab === 'contact' && <ContactTimelineChart />}
        {activeTab === 'waterfall' && <LinkBudgetWaterfallChart />}
        {activeTab === 'link' && <LinkBudgetChart />}
        {activeTab === 'skyplot' && <SkyPlotChart />}
      </div>
    </div>
  )
}
