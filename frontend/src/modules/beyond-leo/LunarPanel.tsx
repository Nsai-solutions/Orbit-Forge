import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import type { LunarMissionType, LunarTransferType } from '@/types/beyond-leo'

const MISSION_TYPES: { value: LunarMissionType; label: string }[] = [
  { value: 'orbit', label: 'Orbit Insertion' },
  { value: 'flyby', label: 'Flyby' },
  { value: 'landing', label: 'Landing' },
  { value: 'free-return', label: 'Free-Return' },
]

const TRANSFER_TYPES: { value: LunarTransferType; label: string }[] = [
  { value: 'hohmann', label: 'Hohmann' },
  { value: 'low-energy', label: 'Low-Energy (WSB)' },
  { value: 'gravity-assist', label: 'Gravity Assist' },
]

export default function LunarPanel() {
  const params = useStore((s) => s.beyondLeo.lunarParams)
  const update = useStore((s) => s.updateLunarParams)

  const showOrbitParams = params.missionType === 'orbit' || params.missionType === 'landing'

  return (
    <>
      <SectionHeader title="Mission Type">
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Mission</span>
            <select
              value={params.missionType}
              onChange={(e) => update({ missionType: e.target.value as LunarMissionType })}
              className="input-field w-36 text-xs"
            >
              {MISSION_TYPES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Transfer</span>
            <select
              value={params.transferType}
              onChange={(e) => update({ transferType: e.target.value as LunarTransferType })}
              className="input-field w-36 text-xs"
            >
              {TRANSFER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
      </SectionHeader>

      {(params.missionType === 'free-return' || params.missionType === 'flyby') && (
        <SectionHeader title="Closest Approach">
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">CA Altitude</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={params.closestApproachAltKm}
                  onChange={(e) => update({ closestApproachAltKm: parseFloat(e.target.value) || 0 })}
                  className="input-field w-24 text-sm font-mono"
                  min="50"
                  max="5000"
                />
                <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">km</span>
              </div>
            </label>
          </div>
        </SectionHeader>
      )}

      {showOrbitParams && (
        <SectionHeader title="Target Orbit">
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">Altitude</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={params.targetOrbitAltKm}
                  onChange={(e) => update({ targetOrbitAltKm: parseFloat(e.target.value) || 0 })}
                  className="input-field w-24 text-sm font-mono"
                  min="10"
                  max="10000"
                />
                <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">km</span>
              </div>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">Inclination</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={params.targetOrbitIncDeg}
                  onChange={(e) => update({ targetOrbitIncDeg: parseFloat(e.target.value) || 0 })}
                  className="input-field w-24 text-sm font-mono"
                  min="0"
                  max="180"
                />
                <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">°</span>
              </div>
            </label>
          </div>
        </SectionHeader>
      )}

      <SectionHeader title="Departure">
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Parking Alt</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={params.departureAltKm}
                onChange={(e) => update({ departureAltKm: parseFloat(e.target.value) || 0 })}
                className="input-field w-24 text-sm font-mono"
                min="150"
                max="2000"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">km</span>
            </div>
          </label>
        </div>
      </SectionHeader>

      <SectionHeader title="Spacecraft" defaultOpen={false}>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Dry Mass</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={params.spacecraftMassKg}
                onChange={(e) => update({ spacecraftMassKg: parseFloat(e.target.value) || 0 })}
                className="input-field w-24 text-sm font-mono"
                min="1"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">kg</span>
            </div>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Propellant</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={params.propellantMassKg}
                onChange={(e) => update({ propellantMassKg: parseFloat(e.target.value) || 0 })}
                className="input-field w-24 text-sm font-mono"
                min="0"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">kg</span>
            </div>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Isp</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={params.ispS}
                onChange={(e) => update({ ispS: parseFloat(e.target.value) || 0 })}
                className="input-field w-24 text-sm font-mono"
                min="100"
                max="5000"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">s</span>
            </div>
          </label>
        </div>
      </SectionHeader>
    </>
  )
}
