import { useState, useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { computeLinkBudget, computeLinkMarginProfile, getDefaultLinkParams } from '@/lib/link-budget'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

export default function LinkBudgetSection() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL

  // Ground segment params — local state (session-specific)
  const [rxGain, setRxGain] = useState(12)
  const [noiseTemp, setNoiseTemp] = useState(500)
  const [reqEbN0, setReqEbN0] = useState(10)
  const [implLoss, setImplLoss] = useState(2)
  const [atmLoss, setAtmLoss] = useState(0.5)
  const [rainMargin, setRainMargin] = useState(0)

  const params = useMemo(() => {
    const defaults = getDefaultLinkParams(mission.spacecraft)
    return {
      ...defaults,
      rxAntennaGainDbi: rxGain,
      systemNoiseTempK: noiseTemp,
      requiredEbN0Db: reqEbN0,
      miscLossDb: implLoss,
      atmosphericLossDb: atmLoss,
      rainLossDb: rainMargin,
    }
  }, [mission.spacecraft, rxGain, noiseTemp, reqEbN0, implLoss, atmLoss, rainMargin])

  // Compute at two reference elevations: worst case (10 deg) and best case (90 deg)
  const worstCase = useMemo(() => computeLinkBudget(params, avgAlt, 10), [params, avgAlt])
  const bestCase = useMemo(() => computeLinkBudget(params, avgAlt, 90), [params, avgAlt])

  // Find minimum elevation for link closure (margin >= 0)
  const minClosureEl = useMemo(() => {
    const profile = computeLinkMarginProfile(params, avgAlt, 5, 90, 0.5)
    const first = profile.find((p) => p.linkMarginDb >= 0)
    return first ? first.elevationDeg : null
  }, [params, avgAlt])

  return (
    <div className="space-y-3">
      <SectionHeader title="Link Budget" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Margin (10\u00B0 El)"
            value={`${worstCase.linkMarginDb.toFixed(1)} dB`}
            status={worstCase.marginStatus}
          />
          <MetricCard
            label="Margin (90\u00B0 El)"
            value={`${bestCase.linkMarginDb.toFixed(1)} dB`}
            status={bestCase.marginStatus}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <DataReadout
            label="EIRP"
            value={worstCase.eirpDbw.toFixed(1)}
            unit="dBW"
          />
          <DataReadout
            label="FSPL (10\u00B0)"
            value={worstCase.fsplDb.toFixed(1)}
            unit="dB"
          />
          <DataReadout
            label="Rx Power (10\u00B0)"
            value={worstCase.rxPowerDbw.toFixed(1)}
            unit="dBW"
          />
          <DataReadout
            label="Eb/N0 (10\u00B0)"
            value={worstCase.ebN0Db.toFixed(1)}
            unit="dB"
            status={worstCase.marginStatus}
          />
          <DataReadout
            label="Slant Range (10\u00B0)"
            value={worstCase.slantRangeKm.toFixed(0)}
            unit="km"
          />
          <DataReadout
            label="Min El (Link Close)"
            value={minClosureEl !== null ? `${minClosureEl.toFixed(1)}` : 'N/A'}
            unit={minClosureEl !== null ? '\u00B0' : ''}
            status={minClosureEl === null ? 'critical' : minClosureEl <= 10 ? 'nominal' : 'warning'}
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Ground Segment" defaultOpen={true}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[var(--text-secondary)]">Rx Antenna Gain</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={rxGain}
                onChange={(e) => setRxGain(parseFloat(e.target.value) || 0)}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="1"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">dBi</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[var(--text-secondary)]">System Noise Temp</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={noiseTemp}
                onChange={(e) => setNoiseTemp(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="50"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">K</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[var(--text-secondary)]">Required Eb/N0</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={reqEbN0}
                onChange={(e) => setReqEbN0(parseFloat(e.target.value) || 0)}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="0.5"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">dB</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[var(--text-secondary)]">Implementation Loss</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={implLoss}
                onChange={(e) => setImplLoss(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="0.5"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">dB</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[var(--text-secondary)]">Atmospheric Loss</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={atmLoss}
                onChange={(e) => setAtmLoss(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="0.1"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">dB</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[var(--text-secondary)]">Rain Margin</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={rainMargin}
                onChange={(e) => setRainMargin(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="0.5"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono w-8">dB</span>
            </div>
          </div>
        </div>
      </SectionHeader>
    </div>
  )
}
