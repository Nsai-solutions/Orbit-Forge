import ChatPanel from './ChatPanel'
import ResultsPanel from './ResultsPanel'

export default function MissionArchitectView() {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Chat Panel — 60% */}
      <div className="w-[60%] flex flex-col border-r border-white/5">
        <ChatPanel />
      </div>

      {/* Results Panel — 40% */}
      <div className="w-[40%] flex flex-col">
        <ResultsPanel />
      </div>
    </div>
  )
}
