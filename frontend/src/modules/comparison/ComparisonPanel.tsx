import { useState } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import { computePowerAnalysis, totalAvgPowerDraw } from '@/lib/power-budget'
import { estimateLifetime, checkCompliance, computeBallisticCoefficient } from '@/lib/orbital-lifetime'
import { computeDeltaVBudget, tsiolkovskyDeltaV } from '@/lib/delta-v'
import { computeRadiationEnvironment } from '@/lib/radiation'
import { computeDerivedParams } from '@/lib/orbital-mechanics'
import { predictPasses, computePassMetrics } from '@/lib/pass-prediction'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { computeLagrangeResult } from '@/lib/lagrange'
import { computeLunarResult } from '@/lib/lunar-transfer'
import { computeInterplanetaryResult } from '@/lib/interplanetary'
import type { ScenarioMetrics, Scenario, BeyondLeoSummary } from '@/stores/comparison-slice'

export default function ComparisonPanel() {
  const [scenarioName, setScenarioName] = useState('')

  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const subsystems = useStore((s) => s.subsystems)
  const propulsion = useStore((s) => s.propulsion)
  const shieldingMm = useStore((s) => s.shieldingThicknessMm)
  const groundStations = useStore((s) => s.groundStations)
  const scenarios = useStore((s) => s.scenarios)
  const addScenario = useStore((s) => s.addScenario)
  const removeScenario = useStore((s) => s.removeScenario)
  const clearScenarios = useStore((s) => s.clearScenarios)

  // Restore a scenario to the active state
  const handleLoad = (scenario: Scenario) => {
    const state = useStore.getState()
    state.updateElements(scenario.elements)
    state.updateMission({
      ...scenario.mission,
      epoch: new Date(scenario.mission.epoch as unknown as string),
    })
    state.setPropulsion(scenario.propulsion)
    state.setShieldingThickness(scenario.shieldingMm)
  }

  const handleSave = () => {
    const name = scenarioName.trim() || `Scenario ${scenarios.length + 1}`

    // Compute all metrics from current state
    const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
    const derived = computeDerivedParams(elements)
    const crossSection = mission.spacecraft.crossSectionArea
    const bStar = computeBallisticCoefficient(mission.spacecraft.mass, crossSection, mission.spacecraft.dragCoefficient)

    const power = computePowerAnalysis(elements, mission.spacecraft, subsystems, mission.lifetimeTarget)
    const lifetimeDays = estimateLifetime(avgAlt, bStar, 'moderate')
    const compliance = checkCompliance(avgAlt, bStar, 'moderate')
    const passes = predictPasses(elements, mission.epoch, groundStations, 1)
    const passMetrics = computePassMetrics(passes, 1, mission.spacecraft.dataRate)
    const dvBudget = computeDeltaVBudget(propulsion, useStore.getState().maneuvers, mission.spacecraft.mass, avgAlt, mission.lifetimeTarget, bStar)
    const rad = computeRadiationEnvironment(avgAlt, elements.inclination, shieldingMm, mission.lifetimeTarget)

    const metrics: ScenarioMetrics = {
      periodMin: derived.period / 60,
      perigeeAlt: derived.periapsisAlt,
      apogeeAlt: derived.apoapsisAlt,
      eclipseFraction: derived.eclipseFraction,
      passesPerDay: passMetrics.totalPassesPerDay,
      powerMarginBol: power.powerMargin,
      powerMarginEol: power.eolMargin,
      batteryDoD: power.batteryDoD,
      lifetimeDays,
      compliance25yr: compliance.lifetime25Year,
      compliance5yr: compliance.lifetime5Year,
      availableDeltaV: dvBudget.availableDeltaV,
      annualRadDoseKrad: rad.shieldedDoseKradPerYear,
      hotCaseC: 0,  // placeholder — would come from thermal module
      coldCaseC: 0,
    }

    // Beyond-LEO summary (optional)
    let beyondLeoSummary: BeyondLeoSummary | undefined
    const beyondLeo = useStore.getState().beyondLeo
    if (beyondLeo) {
      try {
        if (beyondLeo.mode === 'lagrange') {
          const lr = computeLagrangeResult(beyondLeo.lagrangeParams)
          beyondLeoSummary = { mode: 'lagrange', totalDeltaVms: lr.totalDeltaVms, transferTimeDays: lr.transferTimeDays }
        } else if (beyondLeo.mode === 'lunar') {
          const lnr = computeLunarResult(beyondLeo.lunarParams)
          beyondLeoSummary = { mode: 'lunar', totalDeltaVms: lnr.totalDeltaVms, transferTimeDays: lnr.transferTimeDays }
        } else {
          const ir = computeInterplanetaryResult(beyondLeo.interplanetaryParams)
          beyondLeoSummary = { mode: 'interplanetary', totalDeltaVms: ir.totalDeltaVms, transferTimeDays: ir.transferTimeDays }
        }
      } catch { /* ignore if beyond-leo not configured */ }
    }

    const scenario: Scenario = {
      id: `sc-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      elements: { ...elements },
      mission: {
        ...mission,
        epoch: mission.epoch instanceof Date ? mission.epoch.toISOString() as any : mission.epoch,
      },
      propulsion: { ...propulsion },
      shieldingMm,
      metrics,
      beyondLeoSummary,
    }

    addScenario(scenario)
    setScenarioName('')
  }

  return (
    <div className="space-y-2">
      <SectionHeader title="Save Scenario" defaultOpen={true}>
        <div className="space-y-2">
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder={`Scenario ${scenarios.length + 1}`}
            className="input-field w-full text-xs"
          />
          <button
            onClick={handleSave}
            disabled={scenarios.length >= 4}
            className="w-full px-2 py-1.5 rounded text-[10px] font-mono font-medium bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scenarios.length >= 4 ? 'Max 4 Scenarios' : '+ Save Current Config'}
          </button>
          {scenarios.length >= 4 && (
            <div className="text-[9px] text-[var(--text-tertiary)] italic text-center">
              Remove a scenario to save a new one
            </div>
          )}
        </div>
      </SectionHeader>

      <SectionHeader title={`Saved Scenarios (${scenarios.length})`} defaultOpen={true}>
        {scenarios.length === 0 ? (
          <div className="text-[10px] text-[var(--text-tertiary)] italic px-1 py-2 text-center">
            No scenarios saved yet.
            <br />
            Configure your mission and save a scenario to compare.
          </div>
        ) : (
          <div className="space-y-1.5">
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                className="p-2 rounded border border-white/10 hover:border-white/20 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-[var(--text-primary)] font-semibold truncate">
                      {sc.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)] font-mono">
                      {new Date(sc.savedAt).toLocaleString()}
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)] mt-0.5">
                      {sc.metrics.perigeeAlt.toFixed(0)}×{sc.metrics.apogeeAlt.toFixed(0)} km · {sc.metrics.periodMin.toFixed(1)} min
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleLoad(sc)}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => removeScenario(sc.id)}
                      className="px-1.5 py-0.5 rounded text-[9px] text-accent-red/50 hover:text-accent-red hover:bg-accent-red/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Del
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionHeader>

      {scenarios.length > 0 && (
        <button
          onClick={clearScenarios}
          className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-[var(--text-tertiary)] hover:text-accent-red hover:bg-accent-red/5 transition-colors"
        >
          Clear All Scenarios
        </button>
      )}
    </div>
  )
}
