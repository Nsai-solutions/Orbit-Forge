import { useStore } from '@/stores'
import { ORBIT_PRESETS } from '@/types/orbit'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { computeSunSyncInclination } from '@/lib/orbital-mechanics'
import SliderInput from '@/components/ui/SliderInput'
import SectionHeader from '@/components/ui/SectionHeader'

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

  const altitude = elements.semiMajorAxis - R_EARTH_EQUATORIAL

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
    </div>
  )
}
