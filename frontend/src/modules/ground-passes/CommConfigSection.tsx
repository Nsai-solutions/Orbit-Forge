import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import { COMM_PRESETS, BAND_NOISE_TEMPS } from '@/lib/link-budget'
import type { FrequencyBand } from '@/types/mission'

const FREQ_BAND_MAP: Array<{ label: string; band: FrequencyBand; mhz: number }> = [
  { label: 'UHF (437 MHz)', band: 'UHF', mhz: 437 },
  { label: 'S-band (2200 MHz)', band: 'S-band', mhz: 2200 },
  { label: 'X-band (8200 MHz)', band: 'X-band', mhz: 8200 },
  { label: 'Ka-band (26500 MHz)', band: 'Ka-band', mhz: 26500 },
]

export default function CommConfigSection() {
  const commConfig = useStore((s) => s.commConfig)
  const updateCommConfig = useStore((s) => s.updateCommConfig)
  const setCommConfig = useStore((s) => s.setCommConfig)
  const payloadSATCOM = useStore((s) => s.payloadSATCOM)

  const handleImportFromPayload = () => {
    if (!payloadSATCOM) return
    const freqMHz = payloadSATCOM.downlinkFreq * 1000 // GHz -> MHz
    const bandMatch = FREQ_BAND_MAP.reduce((best, fb) =>
      Math.abs(freqMHz - fb.mhz) < Math.abs(freqMHz - best.mhz) ? fb : best
    )
    updateCommConfig({
      frequencyMHz: freqMHz,
      frequencyBand: bandMatch.band,
      txPowerW: payloadSATCOM.satTxPower,
      gsNoiseTempK: payloadSATCOM.gsNoiseTemp,
      rainFadeDb: payloadSATCOM.rainMargin,
    })
  }

  return (
    <SectionHeader title="Communications" defaultOpen={false}>
      {/* Presets */}
      <div className="space-y-2">
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Presets</div>
        <div className="flex flex-wrap gap-1">
          {COMM_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setCommConfig(preset.config)}
              className={`px-2 py-1 rounded text-[9px] font-mono border transition-all ${
                commConfig.frequencyMHz === preset.config.frequencyMHz &&
                commConfig.txPowerW === preset.config.txPowerW &&
                commConfig.dataRateKbps === preset.config.dataRateKbps
                  ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 border-white/10'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Import from payload */}
        {payloadSATCOM && (
          <button
            onClick={handleImportFromPayload}
            className="w-full px-2 py-1.5 rounded text-[9px] font-mono text-accent-cyan border border-accent-cyan/20 hover:bg-accent-cyan/10 transition-all"
          >
            Import from SATCOM Payload
          </button>
        )}

        {/* Satellite Transmitter */}
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] mt-2">Satellite TX</div>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Frequency</span>
          <select
            value={commConfig.frequencyBand}
            onChange={(e) => {
              const fb = FREQ_BAND_MAP.find((f) => f.band === e.target.value)
              if (fb) {
                updateCommConfig({
                  frequencyBand: fb.band as FrequencyBand,
                  frequencyMHz: fb.mhz,
                  gsNoiseTempK: BAND_NOISE_TEMPS[fb.band as FrequencyBand],
                })
              }
            }}
            className="input-field w-32 text-[10px] text-center"
          >
            {FREQ_BAND_MAP.map((fb) => (
              <option key={fb.band} value={fb.band}>{fb.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">TX Power</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.txPowerW}
              onChange={(e) => updateCommConfig({ txPowerW: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
              className="input-field w-16 text-xs text-center"
              step="0.5"
              min="0.1"
              max="100"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">W</span>
          </div>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Sat Antenna</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.satAntennaGainDbi}
              onChange={(e) => updateCommConfig({ satAntennaGainDbi: parseFloat(e.target.value) || 0 })}
              className="input-field w-16 text-xs text-center"
              step="1"
              min="0"
              max="30"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">dBi</span>
          </div>
        </label>

        {/* Ground Station Receiver */}
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] mt-2">Ground Station RX</div>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">GS Antenna</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.gsAntennaGainDbi}
              onChange={(e) => updateCommConfig({ gsAntennaGainDbi: parseFloat(e.target.value) || 0 })}
              className="input-field w-16 text-xs text-center"
              step="1"
              min="0"
              max="50"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">dBi</span>
          </div>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Noise Temp</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.gsNoiseTempK}
              onChange={(e) => updateCommConfig({ gsNoiseTempK: Math.max(1, parseFloat(e.target.value) || 1) })}
              className="input-field w-16 text-xs text-center"
              step="10"
              min="1"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">K</span>
          </div>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Min Elev</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.minOperationalElDeg}
              onChange={(e) => updateCommConfig({ minOperationalElDeg: Math.max(5, Math.min(30, parseFloat(e.target.value) || 5)) })}
              className="input-field w-16 text-xs text-center"
              step="1"
              min="5"
              max="30"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">&deg;</span>
          </div>
        </label>

        {/* Data Link */}
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] mt-2">Data Link</div>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Data Rate</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.dataRateKbps}
              onChange={(e) => updateCommConfig({ dataRateKbps: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
              className="input-field w-20 text-xs text-center"
              step="1"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">kbps</span>
          </div>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Modulation</span>
          <select
            value={commConfig.modulation}
            onChange={(e) => updateCommConfig({ modulation: e.target.value as 'BPSK' | 'QPSK' | '8PSK' })}
            className="input-field w-20 text-[10px] text-center"
          >
            <option value="BPSK">BPSK</option>
            <option value="QPSK">QPSK</option>
            <option value="8PSK">8PSK</option>
          </select>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Rain Fade</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={commConfig.rainFadeDb}
              onChange={(e) => updateCommConfig({ rainFadeDb: Math.max(0, Math.min(15, parseFloat(e.target.value) || 0)) })}
              className="input-field w-16 text-xs text-center"
              step="0.5"
              min="0"
              max="15"
            />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono w-6">dB</span>
          </div>
        </label>
      </div>
    </SectionHeader>
  )
}
