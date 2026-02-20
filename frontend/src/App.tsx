import { useState } from 'react'
import { useStore } from '@/stores'
import { ModuleId } from '@/types'
import TopBar from '@/components/layout/TopBar'
import LeftPanel from '@/components/layout/LeftPanel'
import RightPanel from '@/components/layout/RightPanel'
import BottomPanel from '@/components/layout/BottomPanel'
import CenterViewport from '@/components/layout/CenterViewport'
import MissionConfigPanel from '@/modules/mission-config/MissionConfigPanel'
import GroundStationEditor from '@/modules/mission-config/GroundStationEditor'
import OrbitInputPanel from '@/modules/orbit-design/OrbitInputPanel'
import OrbitalParamsDisplay from '@/modules/orbit-design/OrbitalParamsDisplay'
import GroundTrackPlot from '@/modules/orbit-design/GroundTrackPlot'
import PowerBudgetPanel from '@/modules/power-budget/PowerBudgetPanel'
import PowerAnalysisDisplay from '@/modules/power-budget/PowerAnalysisDisplay'
import PowerBottomPanel from '@/modules/power-budget/PowerBottomPanel'
import PassPredictionPanel from '@/modules/ground-passes/PassPredictionPanel'
import PassDetailsDisplay from '@/modules/ground-passes/PassDetailsDisplay'
import PassBottomPanel from '@/modules/ground-passes/PassBottomPanel'
import LifetimeConfigPanel from '@/modules/orbital-lifetime/LifetimeConfigPanel'
import LifetimeDisplay from '@/modules/orbital-lifetime/LifetimeDisplay'
import DecayCurveChart from '@/modules/orbital-lifetime/DecayCurveChart'
import ConstellationPanel from '@/modules/constellation/ConstellationPanel'
import ConstellationDisplay from '@/modules/constellation/ConstellationDisplay'
import ConstellationChart from '@/modules/constellation/ConstellationChart'
import SaveLoadDialog from '@/components/ui/SaveLoadDialog'

function LeftPanelContent() {
  const activeModule = useStore((s) => s.activeModule)

  switch (activeModule) {
    case ModuleId.MissionConfig:
      return (
        <>
          <MissionConfigPanel />
          <GroundStationEditor />
        </>
      )
    case ModuleId.OrbitDesign:
      return <OrbitInputPanel />
    case ModuleId.PowerBudget:
      return <PowerBudgetPanel />
    case ModuleId.GroundPasses:
      return <PassPredictionPanel />
    case ModuleId.OrbitalLifetime:
      return <LifetimeConfigPanel />
    case ModuleId.Constellation:
      return <ConstellationPanel />
    default:
      return null
  }
}

function RightPanelContent() {
  const activeModule = useStore((s) => s.activeModule)

  switch (activeModule) {
    case ModuleId.MissionConfig:
    case ModuleId.OrbitDesign:
      return <OrbitalParamsDisplay />
    case ModuleId.PowerBudget:
      return <PowerAnalysisDisplay />
    case ModuleId.GroundPasses:
      return <PassDetailsDisplay />
    case ModuleId.OrbitalLifetime:
      return <LifetimeDisplay />
    case ModuleId.Constellation:
      return <ConstellationDisplay />
    default:
      return null
  }
}

function BottomPanelContent() {
  const activeModule = useStore((s) => s.activeModule)

  switch (activeModule) {
    case ModuleId.OrbitDesign:
    case ModuleId.MissionConfig:
      return <GroundTrackPlot />
    case ModuleId.PowerBudget:
      return <PowerBottomPanel />
    case ModuleId.GroundPasses:
      return <PassBottomPanel />
    case ModuleId.OrbitalLifetime:
      return <DecayCurveChart />
    case ModuleId.Constellation:
      return <ConstellationChart />
    default:
      return null
  }
}

export default function App() {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  return (
    <div className="w-full h-screen flex flex-col bg-space-900 overflow-hidden">
      <TopBar onSaveLoad={() => setSaveDialogOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel>
          <LeftPanelContent />
        </LeftPanel>

        <CenterViewport />

        <RightPanel>
          <RightPanelContent />
        </RightPanel>
      </div>

      <BottomPanel>
        <BottomPanelContent />
      </BottomPanel>

      <SaveLoadDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} />
    </div>
  )
}
