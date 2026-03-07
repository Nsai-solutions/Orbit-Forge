import { useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { computeEOAnalysis } from '@/lib/payload-eo'
import { computeSARAnalysis } from '@/lib/payload-sar'
import { computeSATCOMAnalysis } from '@/lib/payload-satcom'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'

export default function PayloadDisplay() {
  const payloadType = useStore((s) => s.payloadType)
  const shared = useStore((s) => s.payloadShared)
  const eo = useStore((s) => s.payloadEO)
  const sar = useStore((s) => s.payloadSAR)
  const satcom = useStore((s) => s.payloadSATCOM)
  const elements = useStore((s) => s.elements)

  const altKm = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const incDeg = elements.inclination

  const eoAnalysis = useMemo(
    () => payloadType === 'earth-observation'
      ? computeEOAnalysis(eo, shared, altKm, incDeg)
      : null,
    [payloadType, eo, shared, altKm, incDeg],
  )

  const sarAnalysis = useMemo(
    () => payloadType === 'sar'
      ? computeSARAnalysis(sar, shared, altKm)
      : null,
    [payloadType, sar, shared, altKm],
  )

  const satcomAnalysis = useMemo(
    () => payloadType === 'satcom'
      ? computeSATCOMAnalysis(satcom, shared, altKm)
      : null,
    [payloadType, satcom, shared, altKm],
  )

  const eoEquations: Equation[] = eoAnalysis ? [
    {
      name: 'Ground Sample Distance',
      formula: 'GSD = (pixel_size \u00D7 altitude) / focal_length',
      computed: `GSD = (${eo.pixelSize} \u00B5m \u00D7 ${altKm.toFixed(1)} km) / ${eo.focalLength} mm = ${eoAnalysis.gsdNadir.toFixed(2)} m`,
      variables: [
        { symbol: 'pixel_size', definition: `${eo.pixelSize} \u00B5m` },
        { symbol: 'focal_length', definition: `${eo.focalLength} mm` },
      ],
    },
    {
      name: 'Swath Width',
      formula: 'Swath = 2 \u00D7 altitude \u00D7 tan(FOV/2)',
      computed: `Swath = 2 \u00D7 ${altKm.toFixed(1)} km \u00D7 tan(${eoAnalysis.fovCrossTrack.toFixed(2)}\u00B0/2) = ${eoAnalysis.swathWidth.toFixed(1)} km`,
      description: `FOV = ${eoAnalysis.fovCrossTrack.toFixed(2)}\u00B0 cross-track`,
    },
    {
      name: 'Signal-to-Noise Ratio',
      formula: 'SNR = (L \u00D7 \u03C1 \u00D7 \u03C4_atm \u00D7 \u03C0 \u00D7 D\u00B2 \u00D7 t_int \u00D7 QE) / (4 \u00D7 f#\u00B2 \u00D7 NEP)',
      computed: `SNR = ${eoAnalysis.snr.toFixed(0)} (f/${eoAnalysis.fNumber.toFixed(1)}, D=${eo.apertureDia} mm)`,
      description: 'Full radiometric chain from target radiance through optics to detector.',
    },
  ] : []

  return (
    <div className="space-y-3">
      {/* ─── Shared Metrics ─── */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Mass"
          value={shared.mass.toFixed(1)}
          unit="kg"
          status="nominal"
        />
        <MetricCard
          label="Avg Power"
          value={shared.powerAvg.toFixed(0)}
          unit="W"
          status="nominal"
        />
      </div>

      {/* ─── EO Display ─── */}
      {eoAnalysis && (
        <>
          <SectionHeader title="Imaging Performance">
            <div className="grid grid-cols-2 gap-2">
              <DataReadout label="GSD (Nadir)" value={eoAnalysis.gsdNadir.toFixed(2)} unit="m" />
              <DataReadout label="GSD (Off-Nadir)" value={eoAnalysis.gsdOffNadir.toFixed(2)} unit="m" />
              <DataReadout label="Swath Width" value={eoAnalysis.swathWidth.toFixed(1)} unit="km" />
              <DataReadout label="FOV" value={eoAnalysis.fovCrossTrack.toFixed(2)} unit="°" />
              <DataReadout label="IFOV" value={eoAnalysis.ifov.toFixed(1)} unit="μrad" />
              <DataReadout label="F-number" value={`f/${eoAnalysis.fNumber.toFixed(1)}`} />
              <DataReadout label="SNR" value={eoAnalysis.snr.toFixed(0)}
                status={eoAnalysis.snr > 100 ? 'nominal' : eoAnalysis.snr > 50 ? 'warning' : 'critical'} />
              <DataReadout label="Revisit" value={eoAnalysis.revisitTime.toFixed(1)} unit="days" />
            </div>
          </SectionHeader>

          <SectionHeader title="Data Budget">
            <div className="grid grid-cols-2 gap-2">
              <DataReadout label="Volume/Orbit" value={eoAnalysis.dataVolumePerOrbit.toFixed(2)} unit="GB" />
              <DataReadout label="Volume/Day" value={eoAnalysis.dataVolumePerDay.toFixed(1)} unit="GB" />
              <DataReadout label="Daily Coverage" value={fmtArea(eoAnalysis.dailyImagingCapacity)} unit="km²" />
              <DataReadout label="Storage Fill"
                value={eoAnalysis.storageFillDays.toFixed(1)} unit="days"
                status={eoAnalysis.storageFillDays > 3 ? 'nominal' : eoAnalysis.storageFillDays > 1 ? 'warning' : 'critical'} />
            </div>
          </SectionHeader>
        </>
      )}

      {/* ─── SAR Display ─── */}
      {sarAnalysis && (
        <>
          <SectionHeader title="SAR Performance">
            <div className="grid grid-cols-2 gap-2">
              <DataReadout label="Wavelength" value={(sarAnalysis.wavelength * 100).toFixed(2)} unit="cm" />
              <DataReadout label="Slant Range" value={sarAnalysis.slantRange.toFixed(0)} unit="km" />
              <DataReadout label="Ground Range Res" value={sarAnalysis.groundRangeRes.toFixed(2)} unit="m" />
              <DataReadout label="Azimuth Res" value={sarAnalysis.azimuthRes.toFixed(2)} unit="m" />
              <DataReadout label="Swath Width" value={sarAnalysis.swathWidth.toFixed(1)} unit="km" />
              <DataReadout label="NESZ" value={sarAnalysis.nesz.toFixed(1)} unit="dB"
                status={sarAnalysis.nesz < -20 ? 'nominal' : sarAnalysis.nesz < -15 ? 'warning' : 'critical'} />
            </div>
          </SectionHeader>

          <SectionHeader title="PRF & Data">
            <div className="grid grid-cols-2 gap-2">
              <DataReadout label="Doppler BW" value={sarAnalysis.dopplerBandwidth.toFixed(0)} unit="Hz" />
              <DataReadout label="Min PRF" value={sarAnalysis.minPRF.toFixed(0)} unit="Hz" />
              <DataReadout label="Max PRF (Range)" value={sarAnalysis.maxPRFRange.toFixed(0)} unit="Hz" />
              <DataReadout label="PRF Status"
                value={sarAnalysis.prfStatus === 'ok' ? 'OK' : sarAnalysis.prfStatus === 'marginal' ? 'MARGINAL' : 'INVALID'}
                status={sarAnalysis.prfStatus === 'ok' ? 'nominal' : sarAnalysis.prfStatus === 'marginal' ? 'warning' : 'critical'} />
              <DataReadout label="Data Rate" value={sarAnalysis.dataRateComputed.toFixed(0)} unit="Mbps" />
              <DataReadout label="Coverage Rate" value={sarAnalysis.areaCoverageRate.toFixed(1)} unit="km²/s" />
              <DataReadout label="Volume/Day" value={sarAnalysis.dataVolumePerDay.toFixed(1)} unit="GB" />
              <DataReadout label="Storage Fill"
                value={sarAnalysis.storageFillDays.toFixed(1)} unit="days"
                status={sarAnalysis.storageFillDays > 3 ? 'nominal' : sarAnalysis.storageFillDays > 1 ? 'warning' : 'critical'} />
            </div>
          </SectionHeader>
        </>
      )}

      {/* ─── SATCOM Display ─── */}
      {satcomAnalysis && (
        <>
          <SectionHeader title="Link Budget">
            <div className="grid grid-cols-2 gap-2">
              <DataReadout label="Sat Ant Gain" value={satcomAnalysis.satAntennaGain.toFixed(1)} unit="dBi" />
              <DataReadout label="GS Ant Gain" value={satcomAnalysis.gsAntennaGain.toFixed(1)} unit="dBi" />
              <DataReadout label="EIRP" value={satcomAnalysis.satEIRP.toFixed(1)} unit="dBW" />
              <DataReadout label="G/T" value={satcomAnalysis.gsGOverT.toFixed(1)} unit="dB/K" />
              <DataReadout label="FSPL" value={satcomAnalysis.fspl.toFixed(1)} unit="dB" />
              <DataReadout label="Eb/N0" value={satcomAnalysis.ebN0.toFixed(1)} unit="dB"
                status={satcomAnalysis.linkMargin > 3 ? 'nominal' : satcomAnalysis.linkMargin > 0 ? 'warning' : 'critical'} />
              <DataReadout label="Link Margin" value={satcomAnalysis.linkMargin.toFixed(1)} unit="dB"
                status={satcomAnalysis.linkMargin > 3 ? 'nominal' : satcomAnalysis.linkMargin > 0 ? 'warning' : 'critical'} />
              <DataReadout label="Max Data Rate" value={fmtRate(satcomAnalysis.maxDataRate)} unit="Mbps" />
            </div>
          </SectionHeader>

          <SectionHeader title="Beam & Throughput">
            <div className="grid grid-cols-2 gap-2">
              <DataReadout label="Beamwidth" value={satcomAnalysis.beamwidthDeg.toFixed(1)} unit="°" />
              <DataReadout label="Footprint" value={satcomAnalysis.beamFootprintKm.toFixed(0)} unit="km" />
              <DataReadout label="Volume/Pass" value={satcomAnalysis.dataVolumePerPass.toFixed(3)} unit="GB" />
              <DataReadout label="Volume/Day" value={satcomAnalysis.dataVolumePerDay.toFixed(2)} unit="GB" />
            </div>
          </SectionHeader>
        </>
      )}

      {eoAnalysis && <EquationsPanel equations={eoEquations} />}
    </div>
  )
}

function fmtArea(km2: number): string {
  if (km2 > 1e6) return (km2 / 1e6).toFixed(1) + 'M'
  if (km2 > 1e3) return (km2 / 1e3).toFixed(0) + 'k'
  return km2.toFixed(0)
}

function fmtRate(mbps: number): string {
  if (mbps > 1000) return (mbps / 1000).toFixed(1) + 'G'
  if (mbps < 0.001) return (mbps * 1000).toFixed(1) + 'k'
  return mbps.toFixed(2)
}
