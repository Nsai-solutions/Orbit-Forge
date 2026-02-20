import { useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { computePowerAnalysis } from '@/lib/power-budget'
import ThermalSection from './ThermalSection'

export default function PowerAnalysisDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const subsystems = useStore((s) => s.subsystems)

  const analysis = useMemo(
    () => computePowerAnalysis(elements, mission.spacecraft, subsystems, mission.lifetimeTarget),
    [elements, mission.spacecraft, subsystems, mission.lifetimeTarget]
  )

  return (
    <div className="space-y-3">
      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Power Margin (BOL)"
          value={`${(analysis.powerMargin * 100).toFixed(1)}%`}
          status={analysis.marginStatus}
        />
        <MetricCard
          label="Power Margin (EOL)"
          value={`${(analysis.eolMargin * 100).toFixed(1)}%`}
          status={analysis.eolMarginStatus}
        />
        <MetricCard
          label="Battery DoD"
          value={`${(analysis.batteryDoD * 100).toFixed(1)}%`}
          status={analysis.dodStatus}
        />
        <MetricCard
          label="Eclipse Duration"
          value={analysis.eclipseDurationMin.toFixed(1)}
          unit="min"
          status="nominal"
        />
      </div>

      <SectionHeader title="Power Generation">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Peak Solar Power"
            value={analysis.peakSolarPower.toFixed(2)}
            unit="W"
          />
          <DataReadout
            label="Avg Generation (BOL)"
            value={analysis.avgPowerGeneration.toFixed(2)}
            unit="W"
          />
          <DataReadout
            label="Avg Generation (EOL)"
            value={analysis.eolPowerGeneration.toFixed(2)}
            unit="W"
          />
          <DataReadout
            label="Avg Consumption"
            value={analysis.avgPowerConsumption.toFixed(2)}
            unit="W"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Illumination">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Orbital Period"
            value={analysis.periodMin.toFixed(1)}
            unit="min"
          />
          <DataReadout
            label="Eclipse Fraction"
            value={(analysis.eclipseFraction * 100).toFixed(1)}
            unit="%"
          />
          <DataReadout
            label="Sunlight Time"
            value={analysis.sunlightDurationMin.toFixed(1)}
            unit="min"
          />
          <DataReadout
            label="Eclipse Time"
            value={analysis.eclipseDurationMin.toFixed(1)}
            unit="min"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Battery">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Capacity"
            value={mission.spacecraft.batteryCapacity.toFixed(0)}
            unit="Wh"
          />
          <DataReadout
            label="Depth of Discharge"
            value={(analysis.batteryDoD * 100).toFixed(1)}
            unit="%"
            status={analysis.dodStatus}
          />
        </div>
      </SectionHeader>

      <ThermalSection />
    </div>
  )
}
