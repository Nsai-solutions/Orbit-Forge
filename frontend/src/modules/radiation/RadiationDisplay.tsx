import { useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { computeRadiationEnvironment } from '@/lib/radiation'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'

export default function RadiationDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const shieldingMm = useStore((s) => s.shieldingThicknessMm)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const incDeg = elements.inclination

  const rad = useMemo(
    () => computeRadiationEnvironment(avgAlt, incDeg, shieldingMm, mission.lifetimeTarget),
    [avgAlt, incDeg, shieldingMm, mission.lifetimeTarget]
  )

  const fmtDose = (v: number) => v < 0.1 ? v.toFixed(3) : v.toFixed(1)

  const radiationEquations: Equation[] = [
    {
      name: 'Total Ionizing Dose',
      formula: 'TID = annual_dose \u00D7 t_mission \u00D7 shielding_factor',
      computed: `TID = ${fmtDose(rad.unshieldedDoseKradPerYear)} krad/yr \u00D7 ${mission.lifetimeTarget.toFixed(1)} yr \u00D7 ${rad.shieldingFactor.toFixed(3)} = ${fmtDose(rad.missionTotalDoseKrad)} krad`,
      description: `At ${avgAlt.toFixed(0)} km, ${incDeg.toFixed(1)}\u00B0 inclination, ${shieldingMm.toFixed(1)} mm Al shielding.`,
    },
    {
      name: 'AP-8 Trapped Proton Model',
      formula: 'Trapped proton flux model for radiation belts',
      computed: `At ${avgAlt.toFixed(0)} km, ${incDeg.toFixed(1)}\u00B0 inc \u2192 ${fmtDose(rad.unshieldedDoseKradPerYear)} krad/yr unshielded (incl. factor \u00D7${rad.inclinationFactor.toFixed(2)})`,
      description: 'Peak flux in inner belt (1000\u20136000 km). Models proton environment as function of altitude and magnetic field coordinates.',
    },
    {
      name: 'Shielding Attenuation',
      formula: 'dose = dose_unshielded \u00D7 e^(-t / \u03BB)',
      computed: `dose = ${fmtDose(rad.unshieldedDoseKradPerYear)} \u00D7 ${rad.shieldingFactor.toFixed(3)} = ${fmtDose(rad.shieldedDoseKradPerYear)} krad/yr (${shieldingMm.toFixed(1)} mm Al)`,
      variables: [
        { symbol: 't', definition: `${shieldingMm.toFixed(1)} mm Al` },
      ],
    },
  ]

  const saaStatusColor: Record<string, 'nominal' | 'warning' | 'critical'> = {
    low: 'nominal',
    moderate: 'warning',
    high: 'critical',
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Annual Dose"
          value={rad.shieldedDoseKradPerYear < 0.1
            ? rad.shieldedDoseKradPerYear.toFixed(3)
            : rad.shieldedDoseKradPerYear.toFixed(1)}
          unit="krad/yr"
          status={rad.componentStatus}
        />
        <MetricCard
          label="Mission Total"
          value={rad.missionTotalDoseKrad < 0.1
            ? rad.missionTotalDoseKrad.toFixed(3)
            : rad.missionTotalDoseKrad.toFixed(1)}
          unit="krad"
          status={rad.componentStatus}
        />
        <MetricCard
          label="SAA Exposure"
          value={rad.saaExposure.charAt(0).toUpperCase() + rad.saaExposure.slice(1)}
          status={saaStatusColor[rad.saaExposure]}
        />
        <MetricCard
          label="Belt Region"
          value={avgAlt < 800 ? 'LEO' : avgAlt < 6000 ? 'Inner Belt' : avgAlt < 20000 ? 'Slot/Outer' : 'GEO'}
          status={avgAlt < 800 ? 'nominal' : avgAlt < 1500 ? 'warning' : 'critical'}
        />
      </div>

      <SectionHeader title="Radiation Environment">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Unshielded Dose"
            value={rad.unshieldedDoseKradPerYear < 0.1
              ? rad.unshieldedDoseKradPerYear.toFixed(3)
              : rad.unshieldedDoseKradPerYear.toFixed(1)}
            unit="krad/yr"
          />
          <DataReadout
            label="Shielded Dose"
            value={rad.shieldedDoseKradPerYear < 0.1
              ? rad.shieldedDoseKradPerYear.toFixed(3)
              : rad.shieldedDoseKradPerYear.toFixed(1)}
            unit="krad/yr"
            status={rad.componentStatus}
          />
          <DataReadout
            label="Shielding Factor"
            value={rad.shieldingFactor.toFixed(3)}
            unit="×"
          />
          <DataReadout
            label="Inclination Factor"
            value={rad.inclinationFactor.toFixed(2)}
            unit="×"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Orbit Details">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout label="Altitude" value={avgAlt.toFixed(0)} unit="km" />
          <DataReadout label="Inclination" value={incDeg.toFixed(1)} unit="°" />
          <DataReadout label="Shielding" value={shieldingMm.toFixed(1)} unit="mm Al" />
          <DataReadout label="Mission Life" value={mission.lifetimeTarget.toFixed(1)} unit="yr" />
        </div>
      </SectionHeader>

      <SectionHeader title="Belt Classification">
        <div className="text-[10px] text-[var(--text-secondary)] px-1">
          {rad.beltRegion}
        </div>
        <div className="mt-2 space-y-1">
          {[
            { label: 'LEO (< 800 km)', range: '0.1–8 krad/yr', active: avgAlt < 800 },
            { label: 'Inner Belt (800–6000 km)', range: '8–500 krad/yr', active: avgAlt >= 800 && avgAlt < 6000 },
            { label: 'Slot Region (6000–12000 km)', range: '10–100 krad/yr', active: avgAlt >= 6000 && avgAlt < 12000 },
            { label: 'Outer Belt (12000–25000 km)', range: '4–30 krad/yr', active: avgAlt >= 12000 && avgAlt < 25000 },
            { label: 'GEO (> 25000 km)', range: '1–4 krad/yr', active: avgAlt >= 25000 },
          ].map((region) => (
            <div
              key={region.label}
              className={`flex justify-between text-[9px] px-1 py-0.5 rounded ${
                region.active ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--text-tertiary)]'
              }`}
            >
              <span>{region.label}</span>
              <span className="font-mono">{region.range}</span>
            </div>
          ))}
        </div>
      </SectionHeader>

      <EquationsPanel equations={radiationEquations} />
    </div>
  )
}
