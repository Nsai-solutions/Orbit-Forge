import { useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import SectionHeader from '@/components/ui/SectionHeader'
import { predictPasses, enrichPassesWithLinkBudget, computePassMetrics, computeContactGaps } from '@/lib/pass-prediction'
import { computePassLinkBudget, atmosphericLoss } from '@/lib/link-budget'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'
import LinkBudgetSection from './LinkBudgetSection'

export default function PassDetailsDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)
  const commConfig = useStore((s) => s.commConfig)
  const selectedPassIndex = useStore((s) => s.selectedPassIndex)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL

  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, 3),
    [elements, mission.epoch, groundStations]
  )

  const enrichedPasses = useMemo(
    () => enrichPassesWithLinkBudget(passes, commConfig, avgAlt),
    [passes, commConfig, avgAlt]
  )

  const metrics = useMemo(
    () => computePassMetrics(enrichedPasses, 3, commConfig.dataRateKbps),
    [enrichedPasses, commConfig.dataRateKbps]
  )

  const gaps = useMemo(
    () => computeContactGaps(enrichedPasses),
    [enrichedPasses]
  )

  // Count passes per station
  const stationCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    enrichedPasses.forEach((p) => {
      counts[p.station] = (counts[p.station] || 0) + 1
    })
    return counts
  }, [enrichedPasses])

  // Quality distribution
  const qualityDist = useMemo(() => {
    const dist = { A: 0, B: 0, C: 0, D: 0 }
    enrichedPasses.forEach((p) => { dist[p.quality]++ })
    return dist
  }, [enrichedPasses])

  // Selected pass details
  const selectedPass = selectedPassIndex != null ? enrichedPasses[selectedPassIndex] : null
  const selectedLinkResult = useMemo(() => {
    if (!selectedPass) return null
    return computePassLinkBudget(commConfig, avgAlt, selectedPass.maxElevation, selectedPass.durationSec)
  }, [selectedPass, commConfig, avgAlt])

  const freqMHz = commConfig.frequencyMHz || 437
  const wavelengthM = 299792458 / (freqMHz * 1e6)
  const txPowerDbw = 10 * Math.log10(commConfig.txPowerW)
  const eirpDbw = txPowerDbw + commConfig.satAntennaGainDbi
  // Compute slant range at 10° elevation for reference
  const elRef = 10
  const elRad = elRef * Math.PI / 180
  const rE = R_EARTH_EQUATORIAL
  const slantRef = Math.sqrt((rE + avgAlt) * (rE + avgAlt) - (rE * Math.cos(elRad)) * (rE * Math.cos(elRad))) - rE * Math.sin(elRad)
  const fsplRef = 20 * Math.log10(4 * Math.PI * slantRef * 1000 / wavelengthM)
  const atmLossRef = atmosphericLoss(freqMHz, elRef)

  const passEquations: Equation[] = [
    {
      name: 'Free Space Path Loss',
      formula: 'FSPL = 20 \u00D7 log\u2081\u2080(4\u03C0d/\u03BB) dB',
      computed: selectedLinkResult
        ? `FSPL = ${selectedLinkResult.fsplDb.toFixed(1)} dB  (d=${selectedLinkResult.slantRangeKm.toFixed(0)} km, f=${freqMHz} MHz)`
        : `FSPL = ${fsplRef.toFixed(1)} dB  (at 10\u00B0 el, d=${slantRef.toFixed(0)} km, f=${freqMHz} MHz)`,
    },
    {
      name: 'Slant Range',
      formula: 'd = \u221A((R\u2091+h)\u00B2 - (R\u2091\u00D7cos(el))\u00B2) - R\u2091\u00D7sin(el)',
      computed: selectedLinkResult
        ? `d = ${selectedLinkResult.slantRangeKm.toFixed(0)} km  (h=${avgAlt.toFixed(0)} km, el=${selectedPass?.maxElevation.toFixed(1)}\u00B0)`
        : `d = ${slantRef.toFixed(0)} km  (h=${avgAlt.toFixed(0)} km, el=10\u00B0)`,
    },
    {
      name: 'EIRP',
      formula: 'EIRP = P_tx + G_tx (dBW)',
      computed: `EIRP = ${txPowerDbw.toFixed(1)} + ${commConfig.satAntennaGainDbi.toFixed(1)} = ${eirpDbw.toFixed(1)} dBW  (P_tx=${commConfig.txPowerW} W)`,
    },
    {
      name: 'Link Margin',
      formula: 'C/N\u2080 = EIRP - FSPL - L_atm + G/T + 228.6',
      computed: selectedLinkResult
        ? `C/N\u2080 = ${selectedLinkResult.cn0Dbhz.toFixed(1)} dB-Hz, Margin = ${selectedLinkResult.linkMarginDb.toFixed(1)} dB`
        : undefined,
      description: 'Select a pass to see computed link margin.',
    },
    {
      name: 'Atmospheric Loss',
      formula: 'L_atm = L_zenith / sin(el)',
      computed: selectedLinkResult
        ? `L_atm = ${selectedLinkResult.atmosphericLossDb.toFixed(1)} dB  (${commConfig.frequencyBand} at ${selectedPass?.maxElevation.toFixed(1)}\u00B0)`
        : `L_atm = ${atmLossRef.toFixed(1)} dB  (${commConfig.frequencyBand} at 10\u00B0 el)`,
    },
  ]

  return (
    <div className="space-y-3">
      <SectionHeader title="Daily Summary (3-Day Avg)">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Passes/Day"
            value={metrics.totalPassesPerDay.toFixed(1)}
          />
          <DataReadout
            label="Daily Contact"
            value={metrics.dailyContactMin.toFixed(1)}
            unit="min"
          />
          <DataReadout
            label="Max Gap"
            value={metrics.maxGapHours.toFixed(1)}
            unit="hrs"
            status={metrics.maxGapHours > 12 ? 'warning' : 'nominal'}
          />
          <DataReadout
            label="Daily Downlink"
            value={metrics.dailyDataMB >= 1024
              ? (metrics.dailyDataMB / 1024).toFixed(2)
              : metrics.dailyDataMB.toFixed(1)}
            unit={metrics.dailyDataMB >= 1024 ? 'GB' : 'MB'}
          />
          <DataReadout
            label="Total Contact"
            value={metrics.totalContactMin.toFixed(1)}
            unit="min"
          />
          <DataReadout
            label="Avg Duration"
            value={metrics.avgPassDurationMin.toFixed(1)}
            unit="min"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Quality Distribution">
        <div className="flex items-center gap-2">
          {(['A', 'B', 'C', 'D'] as const).map((q) => (
            <div key={q} className="flex-1 text-center">
              <div className={`text-lg font-mono font-bold ${
                q === 'A' ? 'text-accent-green' :
                q === 'B' ? 'text-accent-blue' :
                q === 'C' ? 'text-accent-amber' :
                'text-[var(--text-tertiary)]'
              }`}>
                {qualityDist[q]}
              </div>
              <div className="text-[9px] text-[var(--text-tertiary)]">Grade {q}</div>
            </div>
          ))}
        </div>
      </SectionHeader>

      <SectionHeader title="Passes by Station">
        <div className="space-y-1">
          {Object.entries(stationCounts).map(([name, count]) => (
            <div key={name} className="flex items-center justify-between px-2 py-1">
              <span className="text-xs text-[var(--text-primary)] font-mono truncate">{name}</span>
              <span className="text-xs text-accent-cyan font-mono">{count}</span>
            </div>
          ))}
          {Object.keys(stationCounts).length === 0 && (
            <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-4">
              No active ground stations
            </div>
          )}
        </div>
      </SectionHeader>

      {/* Selected pass details */}
      {selectedPass && selectedLinkResult && (
        <SectionHeader title={`Pass: ${selectedPass.station}`} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-2">
            <DataReadout
              label="Max Elevation"
              value={selectedPass.maxElevation.toFixed(1)}
              unit="\u00B0"
            />
            <DataReadout
              label="Duration"
              value={(selectedPass.durationSec / 60).toFixed(1)}
              unit="min"
            />
            <DataReadout
              label="Link Margin"
              value={selectedLinkResult.linkMarginDb.toFixed(1)}
              unit="dB"
              status={selectedLinkResult.marginStatus}
            />
            <DataReadout
              label="C/N0"
              value={selectedLinkResult.cn0Dbhz.toFixed(1)}
              unit="dB-Hz"
            />
            <DataReadout
              label="Slant Range"
              value={selectedLinkResult.slantRangeKm.toFixed(0)}
              unit="km"
            />
            <DataReadout
              label="FSPL"
              value={selectedLinkResult.fsplDb.toFixed(1)}
              unit="dB"
            />
            <DataReadout
              label="Atm Loss"
              value={selectedLinkResult.atmosphericLossDb.toFixed(1)}
              unit="dB"
            />
            <DataReadout
              label="Data Volume"
              value={selectedLinkResult.dataVolumeMB >= 1
                ? selectedLinkResult.dataVolumeMB.toFixed(1)
                : (selectedLinkResult.dataVolumeMB * 1024).toFixed(0)}
              unit={selectedLinkResult.dataVolumeMB >= 1 ? 'MB' : 'KB'}
            />
            <DataReadout
              label="AOS Time"
              value={selectedPass.aos.toISOString().slice(11, 19)}
              unit="UTC"
            />
            <DataReadout
              label="LOS Time"
              value={selectedPass.los.toISOString().slice(11, 19)}
              unit="UTC"
            />
          </div>
        </SectionHeader>
      )}

      <SectionHeader title="Communication Link">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Data Rate"
            value={commConfig.dataRateKbps >= 1000
              ? (commConfig.dataRateKbps / 1000).toFixed(0)
              : commConfig.dataRateKbps.toFixed(1)}
            unit={commConfig.dataRateKbps >= 1000 ? 'Mbps' : 'kbps'}
          />
          <DataReadout
            label="TX Power"
            value={commConfig.txPowerW}
            unit="W"
          />
          <DataReadout
            label="Sat Antenna"
            value={commConfig.satAntennaGainDbi.toFixed(1)}
            unit="dBi"
          />
          <DataReadout
            label="Frequency"
            value={commConfig.frequencyBand}
          />
          <DataReadout
            label="GS Antenna"
            value={commConfig.gsAntennaGainDbi.toFixed(1)}
            unit="dBi"
          />
          <DataReadout
            label="Modulation"
            value={commConfig.modulation}
          />
        </div>
      </SectionHeader>

      <LinkBudgetSection />

      <EquationsPanel equations={passEquations} />
    </div>
  )
}
