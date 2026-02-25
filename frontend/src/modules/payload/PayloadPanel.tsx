import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import type { PayloadType } from '@/types/payload'
import {
  EO_PRESETS,
  SAR_PRESETS,
  SATCOM_PRESETS,
  DEFAULT_SHARED,
  DEFAULT_EO,
  DEFAULT_SAR,
  DEFAULT_SATCOM,
} from '@/types/payload'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

const TYPE_OPTIONS: { value: PayloadType; label: string }[] = [
  { value: 'earth-observation', label: 'EO' },
  { value: 'sar', label: 'SAR' },
  { value: 'satcom', label: 'SATCOM' },
]

export default function PayloadPanel() {
  const payloadType = useStore((s) => s.payloadType)
  const setPayloadType = useStore((s) => s.setPayloadType)
  const shared = useStore((s) => s.payloadShared)
  const updateShared = useStore((s) => s.updatePayloadShared)
  const eo = useStore((s) => s.payloadEO)
  const updateEO = useStore((s) => s.updatePayloadEO)
  const sar = useStore((s) => s.payloadSAR)
  const updateSAR = useStore((s) => s.updatePayloadSAR)
  const satcom = useStore((s) => s.payloadSATCOM)
  const updateSATCOM = useStore((s) => s.updatePayloadSATCOM)
  const updateElements = useStore((s) => s.updateElements)

  const handleTypeSwitch = (type: PayloadType) => {
    setPayloadType(type)
    const defaults: Record<PayloadType, Partial<typeof DEFAULT_SHARED>> = {
      'earth-observation': { name: 'EO Payload', mass: 15, powerPeak: 45, powerAvg: 25, dutyCycle: 0.3, dataRate: 200, storageCapacity: 128 },
      'sar': { name: 'SAR Payload', mass: 30, powerPeak: 800, powerAvg: 150, dutyCycle: 0.15, dataRate: 560, storageCapacity: 256 },
      'satcom': { name: 'SATCOM Payload', mass: 5, powerPeak: 100, powerAvg: 40, dutyCycle: 0.5, dataRate: 10, storageCapacity: 16 },
    }
    updateShared({ ...DEFAULT_SHARED, ...defaults[type] })
  }

  const applyPreset = (preset: (typeof EO_PRESETS)[0]) => {
    updateShared({ ...DEFAULT_SHARED, ...preset.shared })
    if (payloadType === 'earth-observation') updateEO({ ...DEFAULT_EO, ...preset.config as any })
    else if (payloadType === 'sar') updateSAR({ ...DEFAULT_SAR, ...preset.config as any })
    else updateSATCOM({ ...DEFAULT_SATCOM, ...preset.config as any })
    if (preset.orbit) {
      updateElements({
        semiMajorAxis: R_EARTH_EQUATORIAL + preset.orbit.altitudeKm,
        inclination: preset.orbit.inclinationDeg,
      })
    }
  }

  const presets = payloadType === 'earth-observation' ? EO_PRESETS
    : payloadType === 'sar' ? SAR_PRESETS
    : SATCOM_PRESETS

  return (
    <div className="space-y-2">
      {/* Payload Type Selector */}
      <SectionHeader title="Payload Type" defaultOpen={true}>
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTypeSwitch(opt.value)}
              className={`
                flex-1 px-2 py-1.5 rounded text-[10px] font-mono border transition-all
                ${payloadType === opt.value
                  ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue'
                  : 'border-white/10 text-[var(--text-tertiary)] hover:border-white/20'}
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="mt-2">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-mono">Presets</span>
          <div className="flex gap-1 mt-1 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="px-2 py-1 rounded text-[9px] font-mono border border-white/10 text-[var(--text-tertiary)] hover:border-accent-blue/30 hover:text-accent-blue transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </SectionHeader>

      {/* Shared Parameters */}
      <SectionHeader title="General" defaultOpen={true}>
        <div className="space-y-2">
          <InputRow label="Name" value={shared.name}
            onChange={(v) => updateShared({ name: v })} type="text" />
          <InputRow label="Mass" value={shared.mass} unit="kg"
            onChange={(v) => updateShared({ mass: parseFloat(v) || 0 })} />
          <InputRow label="Peak Power" value={shared.powerPeak} unit="W"
            onChange={(v) => updateShared({ powerPeak: parseFloat(v) || 0 })} />
          <InputRow label="Avg Power" value={shared.powerAvg} unit="W"
            onChange={(v) => updateShared({ powerAvg: parseFloat(v) || 0 })} />
          <InputRow label="Duty Cycle" value={(shared.dutyCycle * 100).toFixed(0)} unit="%"
            onChange={(v) => updateShared({ dutyCycle: Math.min(1, Math.max(0, (parseFloat(v) || 0) / 100)) })} />
          <InputRow label="Data Rate" value={shared.dataRate} unit="Mbps"
            onChange={(v) => updateShared({ dataRate: parseFloat(v) || 0 })} />
          <InputRow label="Storage" value={shared.storageCapacity} unit="GB"
            onChange={(v) => updateShared({ storageCapacity: parseFloat(v) || 0 })} />
        </div>
      </SectionHeader>

      {/* EO-specific */}
      {payloadType === 'earth-observation' && (
        <SectionHeader title="Optics & Sensor" defaultOpen={true}>
          <div className="space-y-2">
            <InputRow label="Focal Length" value={eo.focalLength} unit="mm"
              onChange={(v) => updateEO({ focalLength: parseFloat(v) || 0 })} />
            <InputRow label="Aperture" value={eo.apertureDia} unit="mm"
              onChange={(v) => updateEO({ apertureDia: parseFloat(v) || 0 })} />
            <InputRow label="Pixel Size" value={eo.pixelSize} unit="μm"
              onChange={(v) => updateEO({ pixelSize: parseFloat(v) || 0 })} />
            <InputRow label="Detector Width" value={eo.detectorWidth} unit="px"
              onChange={(v) => updateEO({ detectorWidth: parseInt(v) || 0 })} />
            <InputRow label="Detector Height" value={eo.detectorHeight} unit="px"
              onChange={(v) => updateEO({ detectorHeight: parseInt(v) || 0 })} />
            <InputRow label="Spectral Bands" value={eo.spectralBands} unit=""
              onChange={(v) => updateEO({ spectralBands: parseInt(v) || 1 })} />
            <InputRow label="Quantization" value={eo.quantBits} unit="bits"
              onChange={(v) => updateEO({ quantBits: parseInt(v) || 8 })} />
            <InputRow label="Sun Elevation" value={eo.sunElevation} unit="°"
              onChange={(v) => updateEO({ sunElevation: Math.max(1, Math.min(90, parseFloat(v) || 45)) })} />
            <InputRow label="Min Sun Elev" value={eo.minSunElev} unit="°"
              onChange={(v) => updateEO({ minSunElev: parseFloat(v) || 0 })} />
            <InputRow label="Max Off-Nadir" value={eo.maxOffNadir} unit="°"
              onChange={(v) => updateEO({ maxOffNadir: parseFloat(v) || 0 })} />
          </div>
        </SectionHeader>
      )}

      {/* SAR-specific */}
      {payloadType === 'sar' && (
        <SectionHeader title="SAR Parameters" defaultOpen={true}>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">Freq Band</span>
              <select
                value={sar.freqBand}
                onChange={(e) => {
                  const band = e.target.value as any
                  const freqMap: Record<string, number> = { X: 9.65, C: 5.405, L: 1.275, S: 3.0 }
                  updateSAR({ freqBand: band, frequency: freqMap[band] || sar.frequency })
                }}
                className="input-field w-24 text-sm"
              >
                <option value="X">X-band</option>
                <option value="C">C-band</option>
                <option value="L">L-band</option>
                <option value="S">S-band</option>
              </select>
            </label>
            <InputRow label="Frequency" value={sar.frequency} unit="GHz"
              onChange={(v) => updateSAR({ frequency: parseFloat(v) || 0 })} />
            <InputRow label="Ant Length" value={sar.antennaLength} unit="m"
              onChange={(v) => updateSAR({ antennaLength: parseFloat(v) || 0 })} />
            <InputRow label="Ant Width" value={sar.antennaWidth} unit="m"
              onChange={(v) => updateSAR({ antennaWidth: parseFloat(v) || 0 })} />
            <InputRow label="Peak Tx Power" value={sar.peakTxPower} unit="W"
              onChange={(v) => updateSAR({ peakTxPower: parseFloat(v) || 0 })} />
            <InputRow label="PRF" value={sar.prf} unit="Hz"
              onChange={(v) => updateSAR({ prf: parseFloat(v) || 0 })} />
            <InputRow label="Pulse BW" value={sar.pulseBandwidth} unit="MHz"
              onChange={(v) => updateSAR({ pulseBandwidth: parseFloat(v) || 0 })} />
            <InputRow label="Look Angle" value={sar.lookAngle} unit="°"
              onChange={(v) => updateSAR({ lookAngle: parseFloat(v) || 0 })} />
            <InputRow label="Num Looks" value={sar.numLooks} unit=""
              onChange={(v) => updateSAR({ numLooks: parseInt(v) || 1 })} />
            <label className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">Imaging Mode</span>
              <select
                value={sar.imagingMode}
                onChange={(e) => updateSAR({ imagingMode: e.target.value as any })}
                className="input-field w-24 text-sm"
              >
                <option value="stripmap">Stripmap</option>
                <option value="spotlight">Spotlight</option>
                <option value="scansar">ScanSAR</option>
              </select>
            </label>
          </div>
        </SectionHeader>
      )}

      {/* SATCOM-specific */}
      {payloadType === 'satcom' && (
        <>
          <SectionHeader title="Satellite RF" defaultOpen={true}>
            <div className="space-y-2">
              <label className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)]">Freq Band</span>
                <select
                  value={satcom.freqBand}
                  onChange={(e) => {
                    const band = e.target.value as any
                    const freqMap: Record<string, [number, number]> = {
                      UHF: [0.4, 0.437],
                      S: [2.0, 2.2],
                      X: [7.9, 8.4],
                      Ku: [14.0, 12.5],
                      Ka: [29.5, 19.7],
                    }
                    const [up, down] = freqMap[band] || [satcom.uplinkFreq, satcom.downlinkFreq]
                    updateSATCOM({ freqBand: band, uplinkFreq: up, downlinkFreq: down })
                  }}
                  className="input-field w-24 text-sm"
                >
                  <option value="UHF">UHF</option>
                  <option value="S">S-band</option>
                  <option value="X">X-band</option>
                  <option value="Ku">Ku-band</option>
                  <option value="Ka">Ka-band</option>
                </select>
              </label>
              <InputRow label="Uplink Freq" value={satcom.uplinkFreq} unit="GHz"
                onChange={(v) => updateSATCOM({ uplinkFreq: parseFloat(v) || 0 })} />
              <InputRow label="Downlink Freq" value={satcom.downlinkFreq} unit="GHz"
                onChange={(v) => updateSATCOM({ downlinkFreq: parseFloat(v) || 0 })} />
              <InputRow label="Sat Ant Dia" value={satcom.satAntennaDia} unit="m"
                onChange={(v) => updateSATCOM({ satAntennaDia: parseFloat(v) || 0 })} />
              <InputRow label="Sat Tx Power" value={satcom.satTxPower} unit="W"
                onChange={(v) => updateSATCOM({ satTxPower: parseFloat(v) || 0 })} />
              <InputRow label="Sat Noise Temp" value={satcom.satNoiseTemp} unit="K"
                onChange={(v) => updateSATCOM({ satNoiseTemp: parseFloat(v) || 0 })} />
            </div>
          </SectionHeader>

          <SectionHeader title="Ground Station RF" defaultOpen={true}>
            <div className="space-y-2">
              <InputRow label="GS Ant Dia" value={satcom.gsAntennaDia} unit="m"
                onChange={(v) => updateSATCOM({ gsAntennaDia: parseFloat(v) || 0 })} />
              <InputRow label="GS Tx Power" value={satcom.gsTxPower} unit="W"
                onChange={(v) => updateSATCOM({ gsTxPower: parseFloat(v) || 0 })} />
              <InputRow label="GS Noise Temp" value={satcom.gsNoiseTemp} unit="K"
                onChange={(v) => updateSATCOM({ gsNoiseTemp: parseFloat(v) || 0 })} />
            </div>
          </SectionHeader>

          <SectionHeader title="Link Parameters" defaultOpen={true}>
            <div className="space-y-2">
              <InputRow label="Req Eb/N0" value={satcom.requiredEbN0} unit="dB"
                onChange={(v) => updateSATCOM({ requiredEbN0: parseFloat(v) || 0 })} />
              <label className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)]">Modulation</span>
                <select
                  value={satcom.modulation}
                  onChange={(e) => updateSATCOM({ modulation: e.target.value as any })}
                  className="input-field w-24 text-sm"
                >
                  <option value="BPSK">BPSK</option>
                  <option value="QPSK">QPSK</option>
                  <option value="8PSK">8PSK</option>
                  <option value="16APSK">16APSK</option>
                </select>
              </label>
              <InputRow label="Coding Rate" value={satcom.codingRate} unit=""
                onChange={(v) => updateSATCOM({ codingRate: parseFloat(v) || 0.5 })} />
              <InputRow label="Rain Margin" value={satcom.rainMargin} unit="dB"
                onChange={(v) => updateSATCOM({ rainMargin: parseFloat(v) || 0 })} />
              <InputRow label="Atm Loss" value={satcom.atmosphericLoss} unit="dB"
                onChange={(v) => updateSATCOM({ atmosphericLoss: parseFloat(v) || 0 })} />
            </div>
          </SectionHeader>
        </>
      )}
    </div>
  )
}

// ─── Reusable input row ───

function InputRow({
  label,
  value,
  unit,
  onChange,
  type = 'number',
}: {
  label: string
  value: string | number
  unit?: string
  onChange: (v: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field w-24 text-sm font-mono"
        />
        {unit && (
          <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">{unit}</span>
        )}
      </div>
    </label>
  )
}
