import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'

const STATUS_COLORS = {
  nominal: 'text-accent-green',
  warning: 'text-accent-amber',
  critical: 'text-accent-red',
}

interface MetricRow {
  label: string
  key: string
  format: (v: number | boolean) => string
  higherIsBetter?: boolean  // true = higher is green, false = lower is green
  isBoolean?: boolean
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Period', key: 'periodMin', format: (v) => `${(v as number).toFixed(1)} min`, higherIsBetter: undefined },
  { label: 'Perigee', key: 'perigeeAlt', format: (v) => `${(v as number).toFixed(0)} km`, higherIsBetter: undefined },
  { label: 'Apogee', key: 'apogeeAlt', format: (v) => `${(v as number).toFixed(0)} km`, higherIsBetter: undefined },
  { label: 'Eclipse', key: 'eclipseFraction', format: (v) => `${((v as number) * 100).toFixed(1)}%`, higherIsBetter: false },
  { label: 'Passes/Day', key: 'passesPerDay', format: (v) => `${(v as number).toFixed(1)}`, higherIsBetter: true },
  { label: 'Power Margin (BOL)', key: 'powerMarginBol', format: (v) => `${((v as number) * 100).toFixed(1)}%`, higherIsBetter: true },
  { label: 'Power Margin (EOL)', key: 'powerMarginEol', format: (v) => `${((v as number) * 100).toFixed(1)}%`, higherIsBetter: true },
  { label: 'Battery DoD', key: 'batteryDoD', format: (v) => `${((v as number) * 100).toFixed(1)}%`, higherIsBetter: false },
  { label: 'Lifetime', key: 'lifetimeDays', format: (v) => {
    const d = v as number
    return d > 36500 ? '> 100 yr' : d > 365 ? `${(d / 365.25).toFixed(1)} yr` : `${d.toFixed(0)} d`
  }, higherIsBetter: true },
  { label: '25yr Compliant', key: 'compliance25yr', format: (v) => v ? 'Yes' : 'No', isBoolean: true },
  { label: '5yr Compliant', key: 'compliance5yr', format: (v) => v ? 'Yes' : 'No', isBoolean: true },
  { label: 'Available ΔV', key: 'availableDeltaV', format: (v) => `${(v as number).toFixed(1)} m/s`, higherIsBetter: true },
  { label: 'Radiation', key: 'annualRadDoseKrad', format: (v) => `${(v as number).toFixed(2)} krad/yr`, higherIsBetter: false },
]

export default function ComparisonDisplay() {
  const scenarios = useStore((s) => s.scenarios)

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-[var(--text-tertiary)] italic p-4 text-center">
        Save scenarios from the left panel to compare them side-by-side.
        <br /><br />
        Switch to other tabs, adjust parameters, then come back to the Compare tab and save each configuration as a scenario.
      </div>
    )
  }

  // Find best values per metric for highlighting
  const bestValues: Record<string, number> = {}
  for (const row of METRIC_ROWS) {
    if (row.isBoolean || row.higherIsBetter === undefined) continue
    const values = scenarios.map((sc) => (sc.metrics as any)[row.key] as number)
    if (row.higherIsBetter) {
      bestValues[row.key] = Math.max(...values)
    } else {
      bestValues[row.key] = Math.min(...values)
    }
  }

  return (
    <div className="space-y-3">
      <SectionHeader title="Side-by-Side Comparison" defaultOpen={true}>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-1.5 px-1 text-[var(--text-tertiary)] font-normal uppercase tracking-wider">
                  Metric
                </th>
                {scenarios.map((sc) => (
                  <th key={sc.id} className="text-right py-1.5 px-1 text-accent-blue font-semibold">
                    {sc.name.length > 10 ? sc.name.slice(0, 10) + '…' : sc.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-1.5 px-1 text-[var(--text-secondary)]">{row.label}</td>
                  {scenarios.map((sc) => {
                    const val = (sc.metrics as any)[row.key]
                    const formatted = row.format(val)
                    const isBest = !row.isBoolean && row.higherIsBetter !== undefined && val === bestValues[row.key] && scenarios.length > 1
                    const boolColor = row.isBoolean ? (val ? 'text-accent-green' : 'text-accent-red') : ''

                    return (
                      <td
                        key={sc.id}
                        className={`py-1.5 px-1 text-right font-mono ${
                          isBest ? 'text-accent-green font-semibold' :
                          boolColor || 'text-[var(--text-primary)]'
                        }`}
                      >
                        {formatted}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {/* Beyond-LEO row — only show if any scenario has it */}
              {scenarios.some((sc) => sc.beyondLeoSummary) && (
                <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-1.5 px-1 text-[var(--text-secondary)]">Beyond-LEO ΔV</td>
                  {scenarios.map((sc) => (
                    <td key={sc.id} className="py-1.5 px-1 text-right font-mono text-[var(--text-primary)]">
                      {sc.beyondLeoSummary ? `${sc.beyondLeoSummary.totalDeltaVms.toFixed(1)} m/s` : '\u2014'}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionHeader>
    </div>
  )
}
