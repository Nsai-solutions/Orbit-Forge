import { StateCreator } from 'zustand'
import type { MissionConfig } from '@/types/mission'
import type { OrbitalElements } from '@/types/orbit'
import type { PropulsionConfig } from '@/types/propulsion'
import type { BeyondLeoMode } from '@/types/beyond-leo'

export interface ScenarioMetrics {
  periodMin: number
  perigeeAlt: number
  apogeeAlt: number
  eclipseFraction: number
  passesPerDay: number
  powerMarginBol: number
  powerMarginEol: number
  batteryDoD: number
  lifetimeDays: number
  compliance25yr: boolean
  compliance5yr: boolean
  availableDeltaV: number
  annualRadDoseKrad: number
  hotCaseC: number
  coldCaseC: number
}

export interface BeyondLeoSummary {
  mode: BeyondLeoMode
  totalDeltaVms: number
  transferTimeDays: number
}

export interface Scenario {
  id: string
  name: string
  savedAt: string
  elements: OrbitalElements
  mission: MissionConfig
  propulsion: PropulsionConfig
  shieldingMm: number
  metrics: ScenarioMetrics
  beyondLeoSummary?: BeyondLeoSummary
}

export interface ComparisonSlice {
  scenarios: Scenario[]
  addScenario: (scenario: Scenario) => void
  removeScenario: (id: string) => void
  clearScenarios: () => void
  setScenarios: (scenarios: Scenario[]) => void
}

export const createComparisonSlice: StateCreator<ComparisonSlice, [], [], ComparisonSlice> = (set) => ({
  scenarios: [],

  addScenario: (scenario) =>
    set((s) => ({
      scenarios: [...s.scenarios.slice(-3), scenario], // max 4
    })),

  removeScenario: (id) =>
    set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== id) })),

  clearScenarios: () => set({ scenarios: [] }),

  setScenarios: (scenarios) => set({ scenarios }),
})
