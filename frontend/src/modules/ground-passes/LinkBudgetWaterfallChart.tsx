import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { predictPasses, enrichPassesWithLinkBudget } from '@/lib/pass-prediction'
import { computeWaterfallSteps, computeLinkMarginProfile } from '@/lib/link-budget'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import type { CommConfig } from '@/lib/link-budget'

export default function LinkBudgetWaterfallChart() {
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

  // Use selected pass elevation or default to 30 deg
  const selectedPass = selectedPassIndex != null ? enrichedPasses[selectedPassIndex] : null
  const elevationDeg = selectedPass?.maxElevation ?? 30

  // Waterfall steps
  const steps = useMemo(
    () => computeWaterfallSteps(commConfig, avgAlt, elevationDeg),
    [commConfig, avgAlt, elevationDeg]
  )

  // Data rate vs elevation profile
  const profile = useMemo(() => {
    const params = {
      txPowerW: commConfig.txPowerW,
      txAntennaGainDbi: commConfig.satAntennaGainDbi,
      frequencyBand: commConfig.frequencyBand,
      rxAntennaGainDbi: commConfig.gsAntennaGainDbi,
      systemNoiseTempK: commConfig.gsNoiseTempK,
      dataRateKbps: commConfig.dataRateKbps,
      requiredEbN0Db: 10,
      atmosphericLossDb: 0.5,
      rainLossDb: commConfig.rainFadeDb,
      pointingLossDb: 0,
      miscLossDb: 0,
    }
    return computeLinkMarginProfile(params, avgAlt)
  }, [commConfig, avgAlt])

  // Build waterfall chart
  const waterfallTrace = useMemo(() => {
    const labels = steps.map((s) => s.label)
    const values = steps.map((s) => s.value)

    // Waterfall with "measure" array
    const measure = steps.map((s, i) =>
      i === steps.length - 1 ? 'total' : (i === 0 ? 'absolute' : 'relative')
    )

    return {
      type: 'waterfall',
      orientation: 'v',
      measure,
      x: labels,
      y: values,
      textposition: 'outside',
      text: values.map((v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`),
      textfont: { size: 9, color: '#9CA3AF', family: 'JetBrains Mono' },
      connector: { line: { color: 'rgba(255,255,255,0.1)', width: 1 } },
      increasing: { marker: { color: 'rgba(16, 185, 129, 0.7)' } },
      decreasing: { marker: { color: 'rgba(239, 68, 68, 0.7)' } },
      totals: { marker: { color: steps[steps.length - 1]?.isGain ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)' } },
    }
  }, [steps])

  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'JetBrains Mono', size: 10, color: '#9CA3AF' },
    margin: { l: 55, r: 55, t: 30, b: 60 },
    legend: {
      font: { size: 9, color: '#9CA3AF' },
      bgcolor: 'transparent',
      orientation: 'h' as const,
      y: 1.12,
    },
  }

  return (
    <div className="flex h-full gap-2">
      {/* Left: Waterfall chart */}
      <div className="flex-1 h-full">
        <Plot
          data={[waterfallTrace as any]}
          layout={{
            ...darkLayout,
            title: {
              text: `Link Budget Waterfall (El: ${elevationDeg.toFixed(0)}\u00B0)`,
              font: { size: 11, color: '#9CA3AF' },
            },
            xaxis: {
              tickangle: -45,
              tickfont: { size: 8 },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
            },
            yaxis: {
              title: { text: 'dB', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
            },
            showlegend: false,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      {/* Right: Data rate vs elevation */}
      <div className="flex-1 h-full">
        <Plot
          data={[
            {
              x: profile.map((p) => p.elevationDeg),
              y: profile.map((p) => p.maxDataRateKbps),
              type: 'scatter',
              mode: 'lines',
              name: 'Max Data Rate',
              line: { color: '#F59E0B', width: 2 },
              fill: 'tozeroy',
              fillcolor: 'rgba(245, 158, 11, 0.1)',
            },
            {
              x: profile.map((p) => p.elevationDeg),
              y: profile.map(() => commConfig.dataRateKbps),
              type: 'scatter',
              mode: 'lines',
              name: `Nominal (${commConfig.dataRateKbps >= 1000 ? `${(commConfig.dataRateKbps / 1000).toFixed(0)} Mbps` : `${commConfig.dataRateKbps} kbps`})`,
              line: { color: 'rgba(239, 68, 68, 0.6)', width: 1, dash: 'dash' },
            },
            // Mark selected pass elevation
            ...(selectedPass ? [{
              x: [selectedPass.maxElevation, selectedPass.maxElevation],
              y: [0, Math.max(...profile.map((p) => p.maxDataRateKbps))],
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Selected Pass',
              line: { color: 'rgba(59, 130, 246, 0.6)', width: 1, dash: 'dot' as const },
              showlegend: false,
            }] : []),
          ]}
          layout={{
            ...darkLayout,
            title: { text: 'Data Rate vs Elevation', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Elevation (\u00B0)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              range: [5, 90],
            },
            yaxis: {
              title: { text: 'Data Rate (kbps)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#F59E0B',
              type: 'log',
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
