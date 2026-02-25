import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { UISlice, createUISlice } from './ui-slice'
import { MissionSlice, createMissionSlice } from './mission-slice'
import { OrbitSlice, createOrbitSlice } from './orbit-slice'
import { GroundSlice, createGroundSlice } from './ground-slice'
import { PowerSlice, createPowerSlice } from './power-slice'
import { ConstellationSlice, createConstellationSlice } from './constellation-slice'
import { DeltaVSlice, createDeltaVSlice } from './deltav-slice'
import { RadiationSlice, createRadiationSlice } from './radiation-slice'
import { ComparisonSlice, createComparisonSlice } from './comparison-slice'
import { PayloadSlice, createPayloadSlice } from './payload-slice'
import { BeyondLeoSlice, createBeyondLeoSlice } from './beyond-leo-slice'
import { ArchitectSlice, createArchitectSlice } from './architect-slice'
import { SimulationSlice, createSimulationSlice } from './simulation-slice'

export type AppStore = UISlice & MissionSlice & OrbitSlice & GroundSlice & PowerSlice & ConstellationSlice & DeltaVSlice & RadiationSlice & ComparisonSlice & PayloadSlice & BeyondLeoSlice & ArchitectSlice & SimulationSlice

export const useStore = create<AppStore>()(
  devtools(
    persist(
      (...a) => ({
        ...createUISlice(...a),
        ...createMissionSlice(...a),
        ...createOrbitSlice(...a),
        ...createGroundSlice(...a),
        ...createPowerSlice(...a),
        ...createConstellationSlice(...a),
        ...createDeltaVSlice(...a),
        ...createRadiationSlice(...a),
        ...createComparisonSlice(...a),
        ...createPayloadSlice(...a),
        ...createBeyondLeoSlice(...a),
        ...createArchitectSlice(...a),
        ...createSimulationSlice(...a),
      }),
      {
        name: 'orbitforge-autosave',
        version: 15,
        migrate: (persisted: any, version: number) => {
          if (version < 8) {
            const { groundStations, ...rest } = persisted || {}
            persisted = rest
          }
          if (version < 9) {
            if (persisted?.walkerParams) {
              persisted = {
                ...persisted,
                walkerParams: { ...persisted.walkerParams, syncWithOrbit: false },
              }
            }
          }
          // v10: Add pointingMode to spacecraft config if missing
          if (version < 10) {
            if (persisted?.mission?.spacecraft && !persisted.mission.spacecraft.pointingMode) {
              persisted = {
                ...persisted,
                mission: {
                  ...persisted.mission,
                  spacecraft: { ...persisted.mission.spacecraft, pointingMode: 'nadir-pointing' },
                },
              }
            }
          }
          // v14: Reset ground stations to defaults (stale localStorage may have truncated list)
          if (version < 14) {
            if (persisted) {
              const { groundStations: _gs, ...rest } = persisted
              persisted = rest
            }
          }
          // v15: Add closestApproachAltKm to lunar params
          if (version < 15) {
            if (persisted?.beyondLeo?.lunarParams && persisted.beyondLeo.lunarParams.closestApproachAltKm == null) {
              persisted = {
                ...persisted,
                beyondLeo: {
                  ...persisted.beyondLeo,
                  lunarParams: { ...persisted.beyondLeo.lunarParams, closestApproachAltKm: 250 },
                },
              }
            }
          }
          return persisted as any
        },
        merge: (persisted, current) => {
          const merged = { ...current }
          if (persisted && typeof persisted === 'object') {
            for (const key of Object.keys(persisted as object)) {
              const pVal = (persisted as any)[key]
              const cVal = (current as any)[key]
              if (
                pVal && cVal &&
                typeof pVal === 'object' && typeof cVal === 'object' &&
                !Array.isArray(pVal) && !Array.isArray(cVal)
              ) {
                (merged as any)[key] = { ...cVal, ...pVal }
              } else {
                (merged as any)[key] = pVal
              }
            }
          }
          return merged
        },
        partialize: (state) => ({
          activeModule: state.activeModule,
          bottomPanelExpanded: state.bottomPanelExpanded,
          elements: state.elements,
          groundStations: state.groundStations,
          subsystems: state.subsystems,
          degradationRate: state.degradationRate,
          walkerParams: state.walkerParams,
          propulsion: state.propulsion,
          maneuvers: state.maneuvers,
          shieldingThicknessMm: state.shieldingThicknessMm,
          scenarios: state.scenarios,
          payloadType: state.payloadType,
          payloadShared: state.payloadShared,
          payloadEO: state.payloadEO,
          payloadSAR: state.payloadSAR,
          payloadSATCOM: state.payloadSATCOM,
          beyondLeo: state.beyondLeo,
          mission: {
            ...state.mission,
            epoch: state.mission.epoch instanceof Date
              ? state.mission.epoch.toISOString()
              : state.mission.epoch,
          },
        }),
        onRehydrateStorage: () => (state) => {
          if (state?.elements) {
            state.recompute()
          }
          if (state?.mission?.epoch) {
            state.updateMission({
              epoch: new Date(state.mission.epoch as unknown as string),
            })
          }
          if (state?.subsystems) {
            for (const sub of state.subsystems) {
              if (sub.dutyCycle > 1) {
                state.updateSubsystem(sub.id, { dutyCycle: Math.min(1, sub.dutyCycle / 100) })
              } else if (sub.dutyCycle < 0) {
                state.updateSubsystem(sub.id, { dutyCycle: 0 })
              }
            }
          }
        },
      }
    ),
    { name: 'OrbitForge' }
  )
)
