import { useState, useEffect } from 'react'
import { useStore } from '@/stores'
import { ModuleId } from '@/types'
import LandingPage from '@/pages/LandingPage'
import ValidationPage from '@/pages/ValidationPage'
import GuidePage from '@/pages/GuidePage'
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
import DeltaVPanel from '@/modules/delta-v/DeltaVPanel'
import DeltaVDisplay from '@/modules/delta-v/DeltaVDisplay'
import DeltaVChart from '@/modules/delta-v/DeltaVChart'
import RadiationPanel from '@/modules/radiation/RadiationPanel'
import RadiationDisplay from '@/modules/radiation/RadiationDisplay'
import RadiationChart from '@/modules/radiation/RadiationChart'
import PayloadPanel from '@/modules/payload/PayloadPanel'
import PayloadDisplay from '@/modules/payload/PayloadDisplay'
import PayloadChart from '@/modules/payload/PayloadChart'
import BeyondLeoPanel from '@/modules/beyond-leo/BeyondLeoPanel'
import BeyondLeoDisplay from '@/modules/beyond-leo/BeyondLeoDisplay'
import BeyondLeoChart from '@/modules/beyond-leo/BeyondLeoChart'
import ComparisonPanel from '@/modules/comparison/ComparisonPanel'
import ComparisonDisplay from '@/modules/comparison/ComparisonDisplay'
import ComparisonChart from '@/modules/comparison/ComparisonChart'
import MissionArchitectView from '@/modules/mission-architect/MissionArchitectView'
import SaveLoadDialog from '@/components/ui/SaveLoadDialog'
import MobileOverlay from '@/components/ui/MobileOverlay'

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
    case ModuleId.DeltaV:
      return <DeltaVPanel />
    case ModuleId.Radiation:
      return <RadiationPanel />
    case ModuleId.Payload:
      return <PayloadPanel />
    case ModuleId.BeyondLeo:
      return <BeyondLeoPanel />
    case ModuleId.Comparison:
      return <ComparisonPanel />
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
    case ModuleId.DeltaV:
      return <DeltaVDisplay />
    case ModuleId.Radiation:
      return <RadiationDisplay />
    case ModuleId.Payload:
      return <PayloadDisplay />
    case ModuleId.BeyondLeo:
      return <BeyondLeoDisplay />
    case ModuleId.Comparison:
      return <ComparisonDisplay />
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
    case ModuleId.DeltaV:
      return <DeltaVChart />
    case ModuleId.Radiation:
      return <RadiationChart />
    case ModuleId.Payload:
      return <PayloadChart />
    case ModuleId.BeyondLeo:
      return <BeyondLeoChart />
    case ModuleId.Comparison:
      return <ComparisonChart />
    default:
      return null
  }
}

export default function App() {
  const [view, setView] = useState<'landing' | 'app' | 'validation' | 'guide'>(() => {
    const hash = window.location.hash
    if (hash === '#app') return 'app'
    if (hash === '#validation') return 'validation'
    if (hash === '#guide') return 'guide'
    return 'landing'
  })
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const activeModule = useStore((s) => s.activeModule)

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash
      if (hash === '#app') setView('app')
      else if (hash === '#validation') setView('validation')
      else if (hash === '#guide') setView('guide')
      else setView('landing')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (view === 'validation') return <ValidationPage />
  if (view === 'guide') return <GuidePage />

  if (view === 'landing') return <LandingPage />

  return (
    <div className="w-full h-screen flex flex-col bg-space-900 overflow-hidden">
      <MobileOverlay />
      <TopBar onSaveLoad={() => setSaveDialogOpen(true)} />

      {activeModule === ModuleId.MissionArchitect ? (
        <MissionArchitectView />
      ) : (
        <>
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
        </>
      )}

      <SaveLoadDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} />
    </div>
  )
}
