import { useEffect } from 'react'
import { useStore } from '@/stores'
import { ORBIT_PRESETS } from '@/types/orbit'
import { R_EARTH_EQUATORIAL, MU_EARTH_KM } from '@/lib/constants'
import { computeSunSyncInclination } from '@/lib/orbital-mechanics'
import SliderInput from '@/components/ui/SliderInput'
import SectionHeader from '@/components/ui/SectionHeader'
import type { PropagationMode } from '@/lib/numerical-propagator'

const PROPAGATION_MODES: { mode: PropagationMode; label: string }[] = [
  { mode: 'keplerian', label: 'Kepler' },
  { mode: 'numerical-j2', label: 'J2' },
  { mode: 'numerical-full', label: 'Full' },
]

const PERTURBATION_TOGGLES = [
  { key: 'j2', label: 'J2 Oblateness' },
  { key: 'j3j6', label: 'J3-J6 Zonal' },
  { key: 'drag', label: 'Atmospheric Drag' },
  { key: 'srp', label: 'Solar Radiation' },
  { key: 'thirdBodyMoon', label: 'Moon Gravity' },
  { key: 'thirdBodySun', label: 'Sun Gravity' },
] as const

const INCLINATION_PRESETS = [
  { label: '0\u00B0 Equatorial', value: 0 },
  { label: '51.6\u00B0 ISS', value: 51.6 },
  { label: '53\u00B0 Starlink', value: 53 },
  { label: '90\u00B0 Polar', value: 90 },
  { label: '~98\u00B0 SSO', value: 98 },
]

export default function OrbitInputPanel() {
  const elements = useStore((s) => s.elements)
  const updateElements = useStore((s) => s.updateElements)
  const setFromPreset = useStore((s) => s.setFromPreset)
  const propagationMode = useStore((s) => s.propagationMode)
  const setPropagationMode = useStore((s) => s.setPropagationMode)
  const perturbationConfig = useStore((s) => s.perturbationConfig)
  const setPerturbationConfig = useStore((s) => s.setPerturbationConfig)
  const spacecraftProps = useStore((s) => s.spacecraftProps)
  const setSpacecraftProps = useStore((s) => s.setSpacecraftProps)
  const mission = useStore((s) => s.mission)
  const isPropagating = useStore((s) => s.isPropagating)

  // Sync propagator spacecraft props from mission store values
  useEffect(() => {
    setSpacecraftProps({
      mass: mission.spacecraft.mass,
      area: mission.spacecraft.crossSectionArea,
      cd: mission.spacecraft.dragCoefficient,
    })
  }, [mission.spacecraft.mass, mission.spacecraft.crossSectionArea, mission.spacecraft.dragCoefficient, setSpacecraftProps])
  const numOrbits = useStore((s) => s.numOrbits)
  const setNumOrbits = useStore((s) => s.setNumOrbits)

  const altitude = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(elements.semiMajorAxis, 3) / MU_EARTH_KM)
  const totalHours = numOrbits * periodSec / 3600
  const durationText = totalHours > 48
    ? `~${(totalHours / 24).toFixed(1)} days`
    : `~${totalHours.toFixed(1)} hours`

  const handleAltitudeChange = (alt: number) => {
    updateElements({ semiMajorAxis: alt + R_EARTH_EQUATORIAL })
  }

  const handleAutoSSO = () => {
    const ssoInc = computeSunSyncInclination(elements.semiMajorAxis, elements.eccentricity)
    if (!isNaN(ssoInc)) {
      updateElements({ inclination: ssoInc })
    }
  }

  return (
    <div className="space-y-3">
      {/* Orbit Presets */}
      <SectionHeader title="Orbit Presets" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(ORBIT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => setFromPreset(key)}
              className="text-[11px] px-2 py-1.5 rounded border border-white/10 text-[var(--text-secondary)] hover:border-accent-blue/40 hover:text-accent-blue transition-all font-sans truncate"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </SectionHeader>

      {/* Orbital Elements */}
      <SectionHeader title="Orbital Elements" defaultOpen={true}>
        <SliderInput
          label="Altitude"
          value={altitude}
          min={200}
          max={36000}
          step={10}
          unit="km"
          precision={0}
          onChange={handleAltitudeChange}
          warning={altitude < 300 ? 'Below 300km: rapid orbital decay' : undefined}
        />

        <SliderInput
          label="Eccentricity"
          value={elements.eccentricity}
          min={0}
          max={0.9}
          step={0.001}
          precision={4}
          onChange={(v) => updateElements({ eccentricity: v })}
          warning={elements.eccentricity > 0.05 ? 'High eccentricity for LEO CubeSat' : undefined}
        />

        <div className="space-y-1.5">
          <SliderInput
            label="Inclination"
            value={elements.inclination}
            min={0}
            max={180}
            step={0.1}
            unit="\u00B0"
            precision={2}
            onChange={(v) => updateElements({ inclination: v })}
          />
          <div className="flex flex-wrap gap-1">
            {INCLINATION_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => updateElements({ inclination: p.value })}
                className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-tertiary)] hover:bg-accent-blue/10 hover:text-accent-blue transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <SliderInput
          label="RAAN"
          value={elements.raan}
          min={0}
          max={360}
          step={0.5}
          unit="\u00B0"
          precision={2}
          onChange={(v) => updateElements({ raan: v })}
        />

        <SliderInput
          label="Arg. of Perigee"
          value={elements.argOfPerigee}
          min={0}
          max={360}
          step={0.5}
          unit="\u00B0"
          precision={2}
          onChange={(v) => updateElements({ argOfPerigee: v })}
        />

        <SliderInput
          label="True Anomaly"
          value={elements.trueAnomaly}
          min={0}
          max={360}
          step={1}
          unit="\u00B0"
          precision={1}
          onChange={(v) => updateElements({ trueAnomaly: v })}
        />
      </SectionHeader>

      {/* Sun-Sync Calculator */}
      <SectionHeader title="Sun-Sync Calculator" defaultOpen={false}>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Auto-compute the inclination for a sun-synchronous orbit at the current altitude.
        </p>
        <button
          onClick={handleAutoSSO}
          className="w-full mt-1 px-3 py-2 rounded-md bg-accent-blue/15 border border-accent-blue/30 text-accent-blue text-xs font-sans font-medium hover:bg-accent-blue/25 transition-colors"
        >
          Compute SSO Inclination
        </button>
        {(() => {
          const ssoInc = computeSunSyncInclination(elements.semiMajorAxis, elements.eccentricity)
          if (isNaN(ssoInc)) return (
            <p className="text-[10px] text-accent-amber mt-1">SSO not possible at this altitude</p>
          )
          return (
            <p className="text-[10px] text-accent-green mt-1">Required: {ssoInc.toFixed(2)}\u00B0</p>
          )
        })()}
      </SectionHeader>

      {/* Propagation Mode */}
      <SectionHeader
        title="Propagation"
        defaultOpen={true}
        actions={
          propagationMode !== 'keplerian' ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green border border-accent-green/30 font-mono">
              NUMERICAL
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-3 gap-1.5">
          {PROPAGATION_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setPropagationMode(mode)}
              className={`text-[11px] px-2 py-1.5 rounded border transition-all font-sans ${
                propagationMode === mode
                  ? 'border-accent-blue/50 bg-accent-blue/15 text-accent-blue'
                  : 'border-white/10 text-[var(--text-secondary)] hover:border-accent-blue/40 hover:text-accent-blue'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {propagationMode !== 'keplerian' && (
          <div className="mt-2">
            <SliderInput
              label="PROP. ORBITS"
              value={numOrbits}
              min={5}
              max={200}
              step={5}
              precision={0}
              onChange={setNumOrbits}
            />
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{durationText}</p>
          </div>
        )}
        {isPropagating && (
          <p className="text-[10px] text-accent-amber animate-pulse mt-1">Propagating...</p>
        )}
        {propagationMode !== 'keplerian' && (
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            RK4 integration with {propagationMode === 'numerical-j2' ? 'J2 only' : 'full perturbations'}
          </p>
        )}
      </SectionHeader>

      {/* Perturbation Toggles */}
      {propagationMode !== 'keplerian' && (
        <SectionHeader title="Perturbations" defaultOpen={false}>
          <div className="space-y-1.5">
            {PERTURBATION_TOGGLES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input
                  type="checkbox"
                  checked={perturbationConfig[key as keyof typeof perturbationConfig]}
                  onChange={(e) => setPerturbationConfig({ [key]: e.target.checked })}
                  className="accent-accent-blue w-3 h-3"
                />
                {label}
              </label>
            ))}
          </div>
        </SectionHeader>
      )}

      {/* Spacecraft Properties (for drag/SRP) */}
      {propagationMode !== 'keplerian' && (perturbationConfig.drag || perturbationConfig.srp) && (
        <SectionHeader title="Spacecraft Properties" defaultOpen={false}>
          <SliderInput
            label="Drag Coeff (Cd)"
            value={spacecraftProps.cd}
            min={1.0}
            max={4.0}
            step={0.1}
            precision={1}
            onChange={(v) => setSpacecraftProps({ cd: v })}
          />
          <SliderInput
            label="SRP Coeff (Cr)"
            value={spacecraftProps.cr}
            min={0.5}
            max={2.0}
            step={0.1}
            precision={1}
            onChange={(v) => setSpacecraftProps({ cr: v })}
          />
          <SliderInput
            label="Cross-Section"
            value={spacecraftProps.area}
            min={0.001}
            max={20}
            step={0.001}
            unit="m²"
            precision={3}
            onChange={(v) => setSpacecraftProps({ area: v })}
          />
          <SliderInput
            label="Mass"
            value={spacecraftProps.mass}
            min={0.5}
            max={1000}
            step={0.5}
            unit="kg"
            precision={1}
            onChange={(v) => setSpacecraftProps({ mass: v })}
          />
        </SectionHeader>
      )}
    </div>
  )
}
