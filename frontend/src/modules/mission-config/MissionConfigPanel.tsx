import { useStore } from '@/stores'
import { CUBESAT_SIZES, SOLAR_EFFICIENCIES, ANTENNA_GAINS } from '@/types/mission'
import type { CubeSatSize, SolarPanelConfig, AntennaType, FrequencyBand, MissionType } from '@/types/mission'
import SectionHeader from '@/components/ui/SectionHeader'

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ label: string; value: string }>
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-sans">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function NumberField({ label, value, onChange, unit, min, max, step = 1 }: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-sans">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="input-field w-full text-sm font-mono pr-12"
        />
        {unit && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-secondary)] font-mono pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

export default function MissionConfigPanel() {
  const mission = useStore((s) => s.mission)
  const updateMission = useStore((s) => s.updateMission)
  const updateSpacecraft = useStore((s) => s.updateSpacecraft)
  const sc = mission.spacecraft

  return (
    <div className="space-y-3">
      {/* Mission Name */}
      <div className="glass-panel p-3">
        <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-sans mb-1 block">
          Mission Name
        </label>
        <input
          type="text"
          value={mission.name}
          onChange={(e) => updateMission({ name: e.target.value })}
          className="input-field w-full text-sm"
          placeholder="e.g. CubeSat-1 Earth Obs"
        />
      </div>

      {/* CubeSat Size */}
      <SectionHeader title="Spacecraft" defaultOpen={true}>
        <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-sans">
          CubeSat Size
        </label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {(Object.entries(CUBESAT_SIZES) as [CubeSatSize, typeof CUBESAT_SIZES['1U']][]).map(([key, spec]) => (
            <button
              key={key}
              onClick={() => {
                updateSpacecraft({
                  size: key,
                  mass: spec.typicalMass.max,
                  solarPanelArea: spec.typicalPanelArea,
                })
              }}
              className={`
                p-2 rounded border text-center transition-all
                ${sc.size === key
                  ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue'
                  : 'border-white/10 text-[var(--text-secondary)] hover:border-white/20'}
              `}
            >
              <div className="text-sm font-mono font-bold">{key}</div>
              <div className="text-[9px] text-[var(--text-tertiary)]">{spec.dimensions}</div>
            </button>
          ))}
        </div>

        <NumberField label="Mass" value={sc.mass} onChange={(v) => updateSpacecraft({ mass: v })} unit="kg" min={0.1} step={0.1} />

        <SelectField
          label="Solar Panel Config"
          value={sc.solarPanelConfig}
          onChange={(v) => updateSpacecraft({ solarPanelConfig: v as SolarPanelConfig })}
          options={[
            { label: 'Body-Mounted', value: 'body-mounted' },
            { label: '1-Axis Deployable', value: '1-axis-deployable' },
            { label: '2-Axis Deployable', value: '2-axis-deployable' },
          ]}
        />

        <NumberField label="Panel Area" value={sc.solarPanelArea} onChange={(v) => updateSpacecraft({ solarPanelArea: v })} unit="m\u00B2" min={0.01} step={0.01} />

        <SelectField
          label="Solar Cell Efficiency"
          value={String(sc.solarCellEfficiency)}
          onChange={(v) => updateSpacecraft({ solarCellEfficiency: parseFloat(v) })}
          options={SOLAR_EFFICIENCIES.map((e) => ({ label: `${e.label} (${(e.value * 100).toFixed(0)}%)`, value: String(e.value) }))}
        />
      </SectionHeader>

      {/* Power */}
      <SectionHeader title="Power" defaultOpen={true}>
        <NumberField label="Battery Capacity" value={sc.batteryCapacity} onChange={(v) => updateSpacecraft({ batteryCapacity: v })} unit="Wh" min={1} />
        <NumberField label="Power Idle" value={sc.powerIdle} onChange={(v) => updateSpacecraft({ powerIdle: v })} unit="W" min={0} step={0.1} />
        <NumberField label="Power Peak" value={sc.powerPeak} onChange={(v) => updateSpacecraft({ powerPeak: v })} unit="W" min={0} step={0.1} />
        <NumberField label="Power Average" value={sc.powerAverage} onChange={(v) => updateSpacecraft({ powerAverage: v })} unit="W" min={0} step={0.1} />
      </SectionHeader>

      {/* Communications */}
      <SectionHeader title="Communications" defaultOpen={false}>
        <SelectField
          label="Antenna Type"
          value={sc.antennaType}
          onChange={(v) => {
            const at = v as AntennaType
            updateSpacecraft({ antennaType: at, antennaGain: ANTENNA_GAINS[at] })
          }}
          options={[
            { label: 'Dipole (2.15 dBi)', value: 'dipole' },
            { label: 'Patch (6 dBi)', value: 'patch' },
            { label: 'Helical (12 dBi)', value: 'helical' },
            { label: 'Parabolic (20 dBi)', value: 'parabolic' },
          ]}
        />
        <NumberField label="Transmit Power" value={sc.transmitPower} onChange={(v) => updateSpacecraft({ transmitPower: v })} unit="W" min={0.1} step={0.1} />
        <NumberField label="Data Rate" value={sc.dataRate} onChange={(v) => updateSpacecraft({ dataRate: v })} unit="kbps" min={1} />
        <SelectField
          label="Frequency Band"
          value={sc.frequencyBand}
          onChange={(v) => updateSpacecraft({ frequencyBand: v as FrequencyBand })}
          options={[
            { label: 'UHF (435 MHz)', value: 'UHF' },
            { label: 'S-band (2.4 GHz)', value: 'S-band' },
            { label: 'X-band (8 GHz)', value: 'X-band' },
            { label: 'Ka-band (26 GHz)', value: 'Ka-band' },
          ]}
        />
      </SectionHeader>

      {/* Mission Requirements */}
      <SectionHeader title="Mission" defaultOpen={false}>
        <SelectField
          label="Mission Type"
          value={mission.missionType}
          onChange={(v) => updateMission({ missionType: v as MissionType })}
          options={[
            { label: 'Earth Observation', value: 'earth-observation' },
            { label: 'Communications', value: 'communications' },
            { label: 'Technology Demo', value: 'technology-demo' },
            { label: 'Science', value: 'science' },
            { label: 'IoT / M2M', value: 'iot-m2m' },
          ]}
        />
        <NumberField label="Lifetime Target" value={mission.lifetimeTarget} onChange={(v) => updateMission({ lifetimeTarget: v })} unit="yr" min={0.5} step={0.5} />
      </SectionHeader>
    </div>
  )
}
