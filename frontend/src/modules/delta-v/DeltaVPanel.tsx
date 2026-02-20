import { useMemo } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import { PROPULSION_PRESETS, DEFAULT_MANEUVERS } from '@/types/propulsion'
import type { PropulsionType } from '@/types/propulsion'
import { computeDeorbitDeltaV } from '@/lib/delta-v'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

export default function DeltaVPanel() {
  const elements = useStore((s) => s.elements)
  const propulsion = useStore((s) => s.propulsion)
  const maneuvers = useStore((s) => s.maneuvers)
  const updatePropulsion = useStore((s) => s.updatePropulsion)
  const updateManeuver = useStore((s) => s.updateManeuver)
  const addManeuver = useStore((s) => s.addManeuver)
  const removeManeuver = useStore((s) => s.removeManeuver)
  const resetDeltaV = useStore((s) => s.resetDeltaV)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const deorbitDv = useMemo(() => computeDeorbitDeltaV(avgAlt), [avgAlt])

  const handleTypeChange = (type: PropulsionType) => {
    const preset = PROPULSION_PRESETS[type]
    updatePropulsion({
      type,
      specificImpulse: preset.isp,
      propellantMass: type === 'none' ? 0 : propulsion.propellantMass || 0.1,
    })
  }

  return (
    <div className="space-y-2">
      <SectionHeader title="Propulsion System" defaultOpen={true}>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Thruster Type</span>
            <select
              value={propulsion.type}
              onChange={(e) => handleTypeChange(e.target.value as PropulsionType)}
              className="input-field w-32 text-xs"
            >
              {Object.entries(PROPULSION_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
          </label>

          {propulsion.type === 'none' ? (
            <div className="text-[10px] text-[var(--text-tertiary)] italic px-1 py-2">
              No propulsion system configured. Satellite cannot perform orbit maintenance or controlled deorbit.
            </div>
          ) : (
            <>
              <label className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)]">Specific Impulse</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={propulsion.specificImpulse}
                    onChange={(e) => updatePropulsion({ specificImpulse: Math.max(1, parseFloat(e.target.value) || 0) })}
                    className="input-field w-24 text-sm font-mono"
                    min="1"
                  />
                  <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">s</span>
                </div>
              </label>

              <label className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)]">Propellant Mass</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={propulsion.propellantMass}
                    onChange={(e) => updatePropulsion({ propellantMass: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="input-field w-24 text-sm font-mono"
                    min="0"
                  />
                  <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">kg</span>
                </div>
              </label>
            </>
          )}
        </div>
      </SectionHeader>

      {propulsion.type !== 'none' && (
        <SectionHeader title="Maneuver Budget" defaultOpen={true}>
          <div className="space-y-1.5">
            {maneuvers.map((m) => {
              const isDeorbit = m.id === 'deorbit'
              const displayValue = isDeorbit ? deorbitDv : m.deltaV

              return (
                <div key={m.id} className="flex items-center gap-1.5 group">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">
                      {m.name}
                      {isDeorbit && <span className="text-[9px] text-[var(--text-tertiary)] ml-1">(auto)</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isDeorbit ? (
                        <div className="input-field w-20 text-sm font-mono opacity-60 cursor-default">
                          {deorbitDv.toFixed(1)}
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={m.deltaV}
                          onChange={(e) => updateManeuver(m.id, { deltaV: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="input-field w-20 text-sm font-mono"
                          min="0"
                        />
                      )}
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono">m/s</span>
                      {m.perYear && <span className="text-[11px] text-accent-amber font-mono">/yr</span>}
                    </div>
                  </div>
                  {!DEFAULT_MANEUVERS.find((d) => d.id === m.id) && (
                    <button
                      onClick={() => removeManeuver(m.id)}
                      className="text-[10px] text-[var(--text-tertiary)] hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}

            <button
              onClick={() => addManeuver({
                id: `custom-${Date.now()}`,
                name: 'Custom Maneuver',
                deltaV: 5,
                perYear: false,
              })}
              className="w-full px-2 py-1.5 rounded text-[10px] font-mono border border-white/10 text-[var(--text-tertiary)] hover:bg-white/5 hover:border-accent-blue/30 transition-colors"
            >
              + Add Maneuver
            </button>
          </div>
        </SectionHeader>
      )}

      <button
        onClick={resetDeltaV}
        className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  )
}
