import { useMemo } from 'react'
import { useStore } from '@/stores'
import { ModuleId, MODULE_LABELS } from '@/types'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import type { ChatMessage, ToolCallRecord, MetricStatus } from '@/types/architect'

// ─── Types ───

interface ResultSection {
  title: string
  moduleId: ModuleId
  toolName: string
  items: { label: string; value: string; unit?: string; status?: MetricStatus }[]
  params?: Record<string, unknown>
}

// ─── Status Badge ───

function StatusBadge({ status }: { status?: MetricStatus }) {
  if (!status) return null
  const colors: Record<MetricStatus, string> = {
    nominal: 'text-accent-green',
    warning: 'text-accent-amber',
    critical: 'text-accent-red',
  }
  const icons: Record<MetricStatus, string> = {
    nominal: '\u2713',
    warning: '\u26A0',
    critical: '\u2717',
  }
  return <span className={`${colors[status]} text-[10px]`}>{icons[status]}</span>
}

// ─── Open In Tab Button ───

function OpenInTabButton({ moduleId, params }: { moduleId: ModuleId; params?: Record<string, unknown> }) {
  const setActiveModule = useStore((s) => s.setActiveModule)
  const updateElements = useStore((s) => s.updateElements)

  const handleClick = () => {
    if (params) {
      // Load orbit parameters if available
      const altKm = params.altitude_km as number | undefined
      const incDeg = params.inclination_deg as number | undefined
      const ecc = (params.eccentricity as number) || 0
      if (altKm !== undefined && incDeg !== undefined) {
        updateElements({
          semiMajorAxis: R_EARTH_EQUATORIAL + altKm,
          eccentricity: ecc,
          inclination: incDeg,
          raan: 0,
          argOfPerigee: 0,
          trueAnomaly: 0,
        })
      }
    }
    setActiveModule(moduleId)
  }

  return (
    <button
      onClick={handleClick}
      className="text-[10px] text-accent-blue hover:text-accent-cyan transition-colors flex items-center gap-1"
    >
      Open in {MODULE_LABELS[moduleId]}
      <span className="text-[8px]">&#8599;</span>
    </button>
  )
}

// ─── Section Card ───

function SectionCard({ section }: { section: ResultSection }) {
  const hasWarning = section.items.some((i) => i.status === 'warning' || i.status === 'critical')

  return (
    <div className={`rounded border ${hasWarning ? 'border-accent-amber/20' : 'border-white/5'} bg-white/[0.02] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
          {section.title}
        </span>
        <OpenInTabButton moduleId={section.moduleId} params={section.params} />
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-1.5">
        {section.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-tertiary)]">{item.label}</span>
            <span className="flex items-center gap-1.5 font-mono text-accent-cyan">
              <StatusBadge status={item.status} />
              {item.value}
              {item.unit && (
                <span className="text-[var(--text-tertiary)] text-[10px]">{item.unit}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Extract Results from Messages ───

function extractResultSections(messages: ChatMessage[]): ResultSection[] {
  const sections: ResultSection[] = []
  const seen = new Set<string>()

  // Walk messages in reverse to get the latest result for each tool
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant' || !msg.toolCalls) continue

    for (const tc of msg.toolCalls) {
      if (tc.status !== 'complete' || !tc.output || seen.has(tc.toolName)) continue
      seen.add(tc.toolName)

      const result = tc.output as Record<string, unknown>

      switch (tc.toolName) {
        case 'analyze_orbit':
          sections.push({
            title: 'Orbit',
            moduleId: ModuleId.OrbitDesign,
            toolName: tc.toolName,
            params: { altitude_km: result.altitude_km, inclination_deg: result.inclination_deg, eccentricity: result.eccentricity },
            items: [
              { label: 'Altitude', value: `${result.altitude_km}`, unit: 'km' },
              { label: 'Inclination', value: `${result.inclination_deg}`, unit: 'deg' },
              { label: 'Period', value: `${result.period_minutes}`, unit: 'min' },
              { label: 'Eclipse', value: `${result.eclipse_duration_minutes}`, unit: 'min' },
              { label: 'Sun-Sync', value: result.is_sun_synchronous ? 'Yes' : 'No', status: result.is_sun_synchronous ? 'nominal' : undefined },
              { label: 'Revs/Day', value: `${result.revolutions_per_day}` },
            ],
          })
          break

        case 'compute_power_budget':
          sections.push({
            title: 'Power',
            moduleId: ModuleId.PowerBudget,
            toolName: tc.toolName,
            params: { altitude_km: tc.input.altitude_km, inclination_deg: tc.input.inclination_deg },
            items: [
              { label: 'Avg Generation', value: `${result.avg_power_generation_w}`, unit: 'W' },
              { label: 'Avg Consumption', value: `${result.avg_power_consumption_w}`, unit: 'W' },
              { label: 'Power Margin', value: `${result.power_margin_percent}%`, status: result.margin_status as MetricStatus },
              { label: 'Battery DoD', value: `${((result.battery_depth_of_discharge as number) * 100).toFixed(1)}%`, status: result.dod_status as MetricStatus },
              { label: 'EOL Margin', value: `${result.eol_margin_percent}%`, status: result.eol_margin_status as MetricStatus },
            ],
          })
          break

        case 'compute_ground_passes':
          sections.push({
            title: 'Ground Passes',
            moduleId: ModuleId.GroundPasses,
            toolName: tc.toolName,
            params: { altitude_km: tc.input.altitude_km, inclination_deg: tc.input.inclination_deg },
            items: [
              { label: 'Passes/Day', value: `${result.passes_per_day}` },
              { label: 'Avg Duration', value: `${result.avg_pass_duration_minutes}`, unit: 'min' },
              { label: 'Max Gap', value: `${result.max_gap_hours}`, unit: 'hrs' },
              { label: 'Daily Contact', value: `${result.daily_contact_time_minutes}`, unit: 'min' },
              { label: 'Daily Data', value: `${result.daily_data_throughput_mb}`, unit: 'MB' },
            ],
          })
          break

        case 'predict_lifetime':
          sections.push({
            title: 'Lifetime',
            moduleId: ModuleId.OrbitalLifetime,
            toolName: tc.toolName,
            params: { altitude_km: tc.input.altitude_km },
            items: [
              { label: 'Lifetime', value: `${result.lifetime_years}`, unit: 'yrs' },
              { label: '25-Year Rule', value: result.compliant_25_year_rule ? 'Compliant' : 'Non-compliant', status: result.compliant_25_year_rule ? 'nominal' : 'critical' },
              { label: 'FCC 5-Year', value: result.compliant_fcc_5_year_rule ? 'Compliant' : 'Non-compliant', status: result.compliant_fcc_5_year_rule ? 'nominal' : 'warning' },
              { label: 'Deorbit \u0394V', value: `${result.deorbit_delta_v_ms}`, unit: 'm/s' },
            ],
          })
          break

        case 'analyze_payload': {
          const isEO = result.payload_type === 'earth-observation'
          sections.push({
            title: isEO ? 'Payload (EO)' : 'Payload (SATCOM)',
            moduleId: ModuleId.Payload,
            toolName: tc.toolName,
            params: { altitude_km: tc.input.altitude_km, inclination_deg: tc.input.inclination_deg },
            items: isEO
              ? [
                  { label: 'GSD (nadir)', value: `${result.gsd_nadir_m}`, unit: 'm' },
                  { label: 'Swath Width', value: `${result.swath_width_km}`, unit: 'km' },
                  { label: 'SNR', value: `${result.snr}`, status: (result.snr as number) > 50 ? 'nominal' : (result.snr as number) > 20 ? 'warning' : 'critical' },
                  { label: 'Daily Capacity', value: `${result.daily_imaging_capacity_km2}`, unit: 'km\u00B2' },
                  { label: 'Revisit', value: `${result.revisit_time_days}`, unit: 'days' },
                  { label: 'Data/Day', value: `${result.data_volume_per_day_gb}`, unit: 'GB' },
                ]
              : [
                  { label: 'Link Margin', value: `${result.link_margin_db}`, unit: 'dB', status: (result.link_margin_db as number) > 3 ? 'nominal' : (result.link_margin_db as number) > 0 ? 'warning' : 'critical' },
                  { label: 'Max Data Rate', value: `${result.max_data_rate_mbps}`, unit: 'Mbps' },
                  { label: 'EIRP', value: `${result.eirp_dbw}`, unit: 'dBW' },
                  { label: 'Beam Footprint', value: `${result.beam_footprint_km}`, unit: 'km' },
                  { label: 'Data/Day', value: `${result.data_volume_per_day_gb}`, unit: 'GB' },
                ],
          })
          break
        }
      }
    }
  }

  // Reverse to show in tool order (orbit first, etc.)
  return sections.reverse()
}

// ─── Main Results Panel ───

export default function ResultsPanel() {
  const messages = useStore((s) => s.architectMessages)

  const sections = useMemo(() => extractResultSections(messages), [messages])

  return (
    <>
      {/* Header */}
      <div className="h-11 min-h-[44px] flex items-center px-4 border-b border-white/5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
          Mission Summary
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sections.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center py-12">
            <p className="text-xs text-[var(--text-tertiary)] max-w-[200px] leading-relaxed">
              Start a conversation to see mission analysis results here
            </p>
          </div>
        ) : (
          sections.map((section, i) => (
            <SectionCard key={`${section.toolName}-${i}`} section={section} />
          ))
        )}
      </div>
    </>
  )
}
