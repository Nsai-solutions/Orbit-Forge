import { useStore } from '@/stores'
import type { AnthropicToolDef } from '@/types/architect'
import type { OrbitalElements } from '@/types/orbit'
import type { SpacecraftConfig, CubeSatSize } from '@/types/mission'
import { DEFAULT_SPACECRAFT, CUBESAT_SIZES } from '@/types/mission'
import { DEFAULT_SHARED, DEFAULT_EO, DEFAULT_SATCOM } from '@/types/payload'
import type { EOConfig, SharedPayloadConfig, SATCOMConfig } from '@/types/payload'
import type { GroundStation } from '@/types/ground-station'
import { R_EARTH_EQUATORIAL } from './constants'
import { computeDerivedParams } from './orbital-mechanics'
import { computePowerAnalysis, DEFAULT_SUBSYSTEMS } from './power-budget'
import type { PowerSubsystem } from './power-budget'
import { predictPasses, computePassMetrics } from './pass-prediction'
import { computeBallisticCoefficient, estimateCrossSection, checkCompliance } from './orbital-lifetime'
import type { SolarActivity } from './orbital-lifetime'
import { computeEOAnalysis } from './payload-eo'
import { computeSATCOMAnalysis } from './payload-satcom'

// ─── Tool Definitions (Anthropic API format) ───

export const TOOL_DEFINITIONS: AnthropicToolDef[] = [
  {
    name: 'analyze_orbit',
    description: 'Analyze orbital parameters. Given altitude and inclination, computes orbital period, velocities, eclipse duration, sun-synchronous status, RAAN drift rate, and more.',
    input_schema: {
      type: 'object',
      properties: {
        altitude_km: { type: 'number', description: 'Orbital altitude in km above Earth surface (typically 200-2000 for LEO)' },
        inclination_deg: { type: 'number', description: 'Orbital inclination in degrees (0-180). For SSO at 500km, ~97.4°' },
        eccentricity: { type: 'number', description: 'Orbital eccentricity (0 for circular, <1 for elliptical). Default: 0' },
        raan_deg: { type: 'number', description: 'Right Ascension of Ascending Node in degrees (0-360). Default: 0' },
      },
      required: ['altitude_km', 'inclination_deg'],
    },
  },
  {
    name: 'compute_power_budget',
    description: 'Compute spacecraft power budget including solar generation, average consumption, power margins, battery depth of discharge, and end-of-life degradation analysis.',
    input_schema: {
      type: 'object',
      properties: {
        altitude_km: { type: 'number', description: 'Orbital altitude in km' },
        inclination_deg: { type: 'number', description: 'Orbital inclination in degrees' },
        spacecraft_size: { type: 'string', enum: ['1U', '1.5U', '2U', '3U', '6U', '12U'], description: 'CubeSat form factor' },
        spacecraft_mass_kg: { type: 'number', description: 'Spacecraft mass in kg' },
        solar_panel_config: { type: 'string', enum: ['body-mounted', '1-axis-deployable', '2-axis-deployable'], description: 'Solar panel configuration' },
        pointing_mode: { type: 'string', enum: ['tumbling', 'nadir-pointing', 'sun-pointing'], description: 'Spacecraft pointing mode' },
        solar_panel_area_m2: { type: 'number', description: 'Total solar panel area in m²' },
        battery_capacity_wh: { type: 'number', description: 'Battery capacity in Wh' },
        lifetime_years: { type: 'number', description: 'Mission design lifetime in years' },
        subsystems: {
          type: 'array',
          description: 'List of power subsystems. If omitted, default CubeSat subsystems are used.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              power_w: { type: 'number', description: 'Power draw when active in Watts' },
              duty_cycle: { type: 'number', description: 'Fraction of time active (0-1)' },
              is_eclipse_only: { type: 'boolean', description: 'True if only active during eclipse (e.g. heaters)' },
            },
            required: ['name', 'power_w', 'duty_cycle'],
          },
        },
      },
      required: ['altitude_km', 'inclination_deg', 'lifetime_years'],
    },
  },
  {
    name: 'compute_ground_passes',
    description: 'Predict satellite ground station passes and compute communication metrics including passes per day, average duration, maximum gap between contacts, and daily data throughput.',
    input_schema: {
      type: 'object',
      properties: {
        altitude_km: { type: 'number', description: 'Orbital altitude in km' },
        inclination_deg: { type: 'number', description: 'Orbital inclination in degrees' },
        ground_stations: {
          type: 'array',
          description: 'Ground stations for pass prediction. If omitted, uses Svalbard as default.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              lat: { type: 'number', description: 'Latitude in degrees (-90 to 90)' },
              lon: { type: 'number', description: 'Longitude in degrees (-180 to 180)' },
              min_elevation_deg: { type: 'number', description: 'Minimum elevation angle in degrees. Default: 5' },
            },
            required: ['name', 'lat', 'lon'],
          },
        },
        duration_days: { type: 'number', description: 'Simulation duration in days (1-7). Default: 1' },
        data_rate_kbps: { type: 'number', description: 'Downlink data rate in kbps for throughput calculation. Default: 9600' },
      },
      required: ['altitude_km', 'inclination_deg'],
    },
  },
  {
    name: 'predict_lifetime',
    description: 'Estimate orbital lifetime from atmospheric drag and check compliance with debris mitigation guidelines (25-year rule and FCC 5-year rule). Returns lifetime estimate, deorbit delta-V needed, and compliance status.',
    input_schema: {
      type: 'object',
      properties: {
        altitude_km: { type: 'number', description: 'Orbital altitude in km' },
        spacecraft_mass_kg: { type: 'number', description: 'Spacecraft mass in kg. Default: 4' },
        spacecraft_size: { type: 'string', enum: ['1U', '1.5U', '2U', '3U', '6U', '12U'], description: 'CubeSat size for drag area estimation. Default: 3U' },
        solar_activity: { type: 'string', enum: ['low', 'moderate', 'high'], description: 'Solar activity level affecting atmospheric density. Default: moderate' },
      },
      required: ['altitude_km'],
    },
  },
  {
    name: 'analyze_payload',
    description: 'Analyze payload performance. For earth-observation payloads: computes GSD, swath width, SNR, imaging capacity, data volume, and revisit time. For SATCOM payloads: computes link budget, antenna gains, EIRP, data rates, and beam footprint.',
    input_schema: {
      type: 'object',
      properties: {
        payload_type: { type: 'string', enum: ['earth-observation', 'satcom'], description: 'Type of payload to analyze' },
        altitude_km: { type: 'number', description: 'Orbital altitude in km' },
        inclination_deg: { type: 'number', description: 'Orbital inclination in degrees. Required for EO revisit calculations.' },
        // EO-specific
        focal_length_mm: { type: 'number', description: 'EO: Focal length in mm. Default: 500' },
        aperture_mm: { type: 'number', description: 'EO: Aperture diameter in mm. Default: 100' },
        pixel_size_um: { type: 'number', description: 'EO: Pixel size in micrometers. Default: 5.5' },
        detector_width_px: { type: 'number', description: 'EO: Detector width in pixels. Default: 8192' },
        spectral_bands: { type: 'number', description: 'EO: Number of spectral bands. Default: 4' },
        // SATCOM-specific
        downlink_freq_ghz: { type: 'number', description: 'SATCOM: Downlink frequency in GHz. Default: 0.437 (UHF)' },
        sat_antenna_dia_m: { type: 'number', description: 'SATCOM: Satellite antenna diameter in meters. Default: 0.1' },
        sat_tx_power_w: { type: 'number', description: 'SATCOM: Satellite transmit power in Watts. Default: 2' },
        gs_antenna_dia_m: { type: 'number', description: 'SATCOM: Ground station antenna diameter in meters. Default: 2.4' },
      },
      required: ['payload_type', 'altitude_km'],
    },
  },
  {
    name: 'set_visualization',
    description: 'Set the 3D visualization in the results panel. Call this after analyze_orbit to show the mission visually. Choose a template that best matches the mission type and pass the orbital parameters.',
    input_schema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          enum: ['leo-orbit', 'leo-with-stations', 'constellation', 'ground-coverage'],
          description: 'Visualization template: leo-orbit (single orbit ring), leo-with-stations (orbit + ground station markers), constellation (Walker constellation with multiple planes), ground-coverage (orbit + swath footprint)',
        },
        altitude_km: { type: 'number', description: 'Orbital altitude in km' },
        inclination_deg: { type: 'number', description: 'Orbital inclination in degrees' },
        stations: {
          type: 'array',
          description: 'Ground stations to show (for leo-with-stations template)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              lat: { type: 'number', description: 'Latitude in degrees' },
              lon: { type: 'number', description: 'Longitude in degrees' },
            },
            required: ['name', 'lat', 'lon'],
          },
        },
        num_planes: { type: 'number', description: 'Number of orbital planes (for constellation template)' },
        sats_per_plane: { type: 'number', description: 'Satellites per plane (for constellation template)' },
        swath_width_km: { type: 'number', description: 'Sensor swath width in km (for ground-coverage template)' },
      },
      required: ['template', 'altitude_km', 'inclination_deg'],
    },
  },
]

// ─── Tool Executors ───

function buildElements(altitudeKm: number, inclinationDeg: number, ecc = 0, raanDeg = 0): OrbitalElements {
  return {
    semiMajorAxis: R_EARTH_EQUATORIAL + altitudeKm,
    eccentricity: ecc,
    inclination: inclinationDeg,
    raan: raanDeg,
    argOfPerigee: 0,
    trueAnomaly: 0,
  }
}

function buildSpacecraft(input: Record<string, unknown>): SpacecraftConfig {
  const size = (input.spacecraft_size as CubeSatSize) || DEFAULT_SPACECRAFT.size
  const sizeSpec = CUBESAT_SIZES[size]

  // Always derive panel area from CubeSat size (matches Power tab behavior).
  // AI-specified solar_panel_area_m2 is ignored to prevent inflated values.
  const panelArea = sizeSpec?.typicalPanelArea || DEFAULT_SPACECRAFT.solarPanelArea

  return {
    ...DEFAULT_SPACECRAFT,
    size,
    mass: (input.spacecraft_mass_kg as number) || sizeSpec?.typicalMass.max || DEFAULT_SPACECRAFT.mass,
    solarPanelConfig: DEFAULT_SPACECRAFT.solarPanelConfig,
    pointingMode: DEFAULT_SPACECRAFT.pointingMode,
    solarPanelArea: panelArea,
    batteryCapacity: (input.battery_capacity_wh as number) || DEFAULT_SPACECRAFT.batteryCapacity,
  }
}

function buildSubsystems(input: Record<string, unknown>): PowerSubsystem[] {
  const subs = input.subsystems as Array<Record<string, unknown>> | undefined
  if (!subs || subs.length === 0) return [...DEFAULT_SUBSYSTEMS]

  return subs.map((s, i) => ({
    id: `ai-sub-${i}`,
    name: (s.name as string) || `Subsystem ${i + 1}`,
    mode: 'Active',
    powerW: (s.power_w as number) || 0,
    dutyCycle: Math.max(0, Math.min(1, (s.duty_cycle as number) || 0)),
    isEclipseOnly: (s.is_eclipse_only as boolean) || false,
  }))
}

function buildGroundStations(input: Record<string, unknown>): GroundStation[] {
  const stations = input.ground_stations as Array<Record<string, unknown>> | undefined
  if (!stations || stations.length === 0) {
    return [{
      id: 'svalbard',
      name: 'Svalbard (SvalSat)',
      lat: 78.23,
      lon: 15.39,
      alt: 0.5,
      minElevation: 5,
      active: true,
    }]
  }

  return stations.map((s, i) => ({
    id: `gs-${i}`,
    name: (s.name as string) || `Station ${i + 1}`,
    lat: s.lat as number,
    lon: s.lon as number,
    alt: (s.alt as number) || 0,
    minElevation: (s.min_elevation_deg as number) || 5,
    active: true,
  }))
}

// Executor dispatch

export function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  switch (toolName) {
    case 'analyze_orbit':
      return executeAnalyzeOrbit(input)
    case 'compute_power_budget':
      return executeComputePowerBudget(input)
    case 'compute_ground_passes':
      return executeComputeGroundPasses(input)
    case 'predict_lifetime':
      return executePredictLifetime(input)
    case 'analyze_payload':
      return executeAnalyzePayload(input)
    case 'set_visualization':
      return executeSetVisualization(input)
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// ─── Individual Executors ───

function executeAnalyzeOrbit(input: Record<string, unknown>): Record<string, unknown> {
  const altKm = input.altitude_km as number
  const incDeg = input.inclination_deg as number
  const ecc = (input.eccentricity as number) || 0
  const raanDeg = (input.raan_deg as number) || 0

  const elements = buildElements(altKm, incDeg, ecc, raanDeg)
  const derived = computeDerivedParams(elements)

  // Sync to orbit tab store
  useStore.getState().updateElements({
    semiMajorAxis: R_EARTH_EQUATORIAL + altKm,
    eccentricity: ecc,
    inclination: incDeg,
    raan: raanDeg,
    argOfPerigee: 0,
    trueAnomaly: 0,
  })

  return {
    altitude_km: altKm,
    inclination_deg: incDeg,
    eccentricity: ecc,
    period_minutes: +(derived.period / 60).toFixed(2),
    velocity_perigee_kms: +derived.velocityPerigee.toFixed(3),
    velocity_apogee_kms: +derived.velocityApogee.toFixed(3),
    perigee_alt_km: +derived.periapsisAlt.toFixed(1),
    apogee_alt_km: +derived.apoapsisAlt.toFixed(1),
    eclipse_fraction: +derived.eclipseFraction.toFixed(4),
    eclipse_duration_minutes: +(derived.avgEclipseDuration / 60).toFixed(2),
    sunlight_duration_minutes: +((derived.period - derived.avgEclipseDuration) / 60).toFixed(2),
    revolutions_per_day: +derived.revsPerDay.toFixed(2),
    raan_drift_deg_per_day: +derived.raanDrift.toFixed(4),
    is_sun_synchronous: derived.isSunSync,
    sun_sync_ltan: derived.sunSyncLTAN,
  }
}

function executeComputePowerBudget(input: Record<string, unknown>): Record<string, unknown> {
  const altKm = input.altitude_km as number
  const incDeg = input.inclination_deg as number
  const lifetimeYears = (input.lifetime_years as number) || 2

  const elements = buildElements(altKm, incDeg)
  const spacecraft = buildSpacecraft(input)
  const subsystems = buildSubsystems(input)

  const analysis = computePowerAnalysis(elements, spacecraft, subsystems, lifetimeYears)

  // Sync to spacecraft + power store
  const store = useStore.getState()
  store.updateSpacecraft({
    size: spacecraft.size,
    mass: spacecraft.mass,
    solarPanelConfig: spacecraft.solarPanelConfig,
    solarPanelArea: spacecraft.solarPanelArea,
    solarCellEfficiency: spacecraft.solarCellEfficiency,
    pointingMode: spacecraft.pointingMode,
    batteryCapacity: spacecraft.batteryCapacity,
  })
  store.updateMission({ lifetimeTarget: lifetimeYears })
  store.setSubsystems(subsystems)

  return {
    spacecraft_config: {
      size: spacecraft.size,
      mass_kg: spacecraft.mass,
      solar_panel_config: spacecraft.solarPanelConfig,
      solar_panel_area_m2: spacecraft.solarPanelArea,
      pointing_mode: spacecraft.pointingMode,
      battery_capacity_wh: spacecraft.batteryCapacity,
    },
    peak_solar_power_w: +analysis.peakSolarPower.toFixed(2),
    avg_power_generation_w: +analysis.avgPowerGeneration.toFixed(2),
    avg_power_consumption_w: +analysis.avgPowerConsumption.toFixed(2),
    power_margin_percent: +(analysis.powerMargin * 100).toFixed(1),
    margin_status: analysis.marginStatus,
    battery_depth_of_discharge: +analysis.batteryDoD.toFixed(3),
    dod_status: analysis.dodStatus,
    eclipse_fraction: +analysis.eclipseFraction.toFixed(4),
    eclipse_duration_minutes: +analysis.eclipseDurationMin.toFixed(2),
    sunlight_duration_minutes: +analysis.sunlightDurationMin.toFixed(2),
    orbital_period_minutes: +analysis.periodMin.toFixed(2),
    eol_power_generation_w: +analysis.eolPowerGeneration.toFixed(2),
    eol_margin_percent: +(analysis.eolMargin * 100).toFixed(1),
    eol_margin_status: analysis.eolMarginStatus,
    lifetime_years: lifetimeYears,
  }
}

function executeComputeGroundPasses(input: Record<string, unknown>): Record<string, unknown> {
  const altKm = input.altitude_km as number
  const incDeg = input.inclination_deg as number
  const durationDays = Math.min(7, Math.max(1, (input.duration_days as number) || 1))
  const dataRateKbps = (input.data_rate_kbps as number) || 9600

  const elements = buildElements(altKm, incDeg)
  const stations = buildGroundStations(input)
  const epoch = new Date()

  const passes = predictPasses(elements, epoch, stations, durationDays)
  const metrics = computePassMetrics(passes, durationDays, dataRateKbps)

  // Sync ground stations to store
  useStore.getState().setGroundStations(stations)

  // Summarize top passes (don't send raw list — too many tokens)
  const topPasses = passes
    .sort((a, b) => b.maxElevation - a.maxElevation)
    .slice(0, 5)
    .map((p) => ({
      station: p.station,
      max_elevation_deg: +p.maxElevation.toFixed(1),
      duration_sec: +p.durationSec.toFixed(0),
      quality: p.quality,
    }))

  return {
    ground_stations: stations.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
    simulation_days: durationDays,
    total_passes: passes.length,
    passes_per_day: +metrics.totalPassesPerDay.toFixed(1),
    avg_pass_duration_minutes: +metrics.avgPassDurationMin.toFixed(1),
    max_gap_hours: +metrics.maxGapHours.toFixed(1),
    daily_contact_time_minutes: +metrics.dailyContactMin.toFixed(1),
    daily_data_throughput_mb: +metrics.dailyDataMB.toFixed(1),
    data_rate_kbps: dataRateKbps,
    best_passes: topPasses,
  }
}

function executePredictLifetime(input: Record<string, unknown>): Record<string, unknown> {
  const altKm = input.altitude_km as number
  const size = (input.spacecraft_size as string) || '3U'
  const massKg = (input.spacecraft_mass_kg as number) || CUBESAT_SIZES[size as CubeSatSize]?.typicalMass.max || 4
  const solarActivity = (input.solar_activity as SolarActivity) || 'moderate'

  const crossSection = estimateCrossSection(size)
  const bStar = computeBallisticCoefficient(massKg, crossSection)
  const compliance = checkCompliance(altKm, bStar, solarActivity)

  // Sync spacecraft mass to store
  useStore.getState().updateSpacecraft({
    size: size as CubeSatSize,
    mass: massKg,
  })

  return {
    altitude_km: altKm,
    spacecraft_size: size,
    spacecraft_mass_kg: massKg,
    cross_section_m2: +crossSection.toFixed(4),
    ballistic_coefficient_m2_per_kg: +bStar.toFixed(6),
    solar_activity: solarActivity,
    lifetime_days: +compliance.lifetimeDays.toFixed(0),
    lifetime_years: +compliance.lifetimeYears.toFixed(2),
    compliant_25_year_rule: compliance.lifetime25Year,
    compliant_fcc_5_year_rule: compliance.lifetime5Year,
    deorbit_delta_v_ms: +compliance.deorbitDeltaV.toFixed(1),
    recommendation: compliance.recommendation,
  }
}

function executeAnalyzePayload(input: Record<string, unknown>): Record<string, unknown> {
  const payloadType = input.payload_type as string
  const altKm = input.altitude_km as number
  const incDeg = (input.inclination_deg as number) || 97.4

  if (payloadType === 'earth-observation') {
    const eoConfig: EOConfig = {
      ...DEFAULT_EO,
      focalLength: (input.focal_length_mm as number) || DEFAULT_EO.focalLength,
      apertureDia: (input.aperture_mm as number) || DEFAULT_EO.apertureDia,
      pixelSize: (input.pixel_size_um as number) || DEFAULT_EO.pixelSize,
      detectorWidth: (input.detector_width_px as number) || DEFAULT_EO.detectorWidth,
      spectralBands: (input.spectral_bands as number) || DEFAULT_EO.spectralBands,
    }
    const shared: SharedPayloadConfig = { ...DEFAULT_SHARED }
    const analysis = computeEOAnalysis(eoConfig, shared, altKm, incDeg)

    // Sync to payload store
    const store = useStore.getState()
    store.setPayloadType('earth-observation')
    store.updatePayloadEO({
      focalLength: eoConfig.focalLength,
      apertureDia: eoConfig.apertureDia,
      pixelSize: eoConfig.pixelSize,
      detectorWidth: eoConfig.detectorWidth,
      spectralBands: eoConfig.spectralBands,
    })

    return {
      payload_type: 'earth-observation',
      altitude_km: altKm,
      inclination_deg: incDeg,
      optics: {
        focal_length_mm: eoConfig.focalLength,
        aperture_mm: eoConfig.apertureDia,
        pixel_size_um: eoConfig.pixelSize,
        f_number: +analysis.fNumber.toFixed(1),
      },
      gsd_nadir_m: +analysis.gsdNadir.toFixed(2),
      gsd_off_nadir_m: +analysis.gsdOffNadir.toFixed(2),
      swath_width_km: +analysis.swathWidth.toFixed(2),
      fov_cross_track_deg: +analysis.fovCrossTrack.toFixed(2),
      snr: +analysis.snr.toFixed(1),
      daily_imaging_capacity_km2: +analysis.dailyImagingCapacity.toFixed(0),
      revisit_time_days: +analysis.revisitTime.toFixed(1),
      data_volume_per_orbit_gb: +analysis.dataVolumePerOrbit.toFixed(2),
      data_volume_per_day_gb: +analysis.dataVolumePerDay.toFixed(2),
      storage_fill_days: +analysis.storageFillDays.toFixed(1),
    }
  }

  if (payloadType === 'satcom') {
    const satcomConfig: SATCOMConfig = {
      ...DEFAULT_SATCOM,
      downlinkFreq: (input.downlink_freq_ghz as number) || DEFAULT_SATCOM.downlinkFreq,
      satAntennaDia: (input.sat_antenna_dia_m as number) || DEFAULT_SATCOM.satAntennaDia,
      satTxPower: (input.sat_tx_power_w as number) || DEFAULT_SATCOM.satTxPower,
      gsAntennaDia: (input.gs_antenna_dia_m as number) || DEFAULT_SATCOM.gsAntennaDia,
    }
    const shared: SharedPayloadConfig = { ...DEFAULT_SHARED }
    const analysis = computeSATCOMAnalysis(satcomConfig, shared, altKm)

    // Sync to payload store
    const store = useStore.getState()
    store.setPayloadType('satcom')
    store.updatePayloadSATCOM({
      downlinkFreq: satcomConfig.downlinkFreq,
      satAntennaDia: satcomConfig.satAntennaDia,
      satTxPower: satcomConfig.satTxPower,
      gsAntennaDia: satcomConfig.gsAntennaDia,
    })

    return {
      payload_type: 'satcom',
      altitude_km: altKm,
      rf_config: {
        downlink_freq_ghz: satcomConfig.downlinkFreq,
        sat_antenna_dia_m: satcomConfig.satAntennaDia,
        sat_tx_power_w: satcomConfig.satTxPower,
        gs_antenna_dia_m: satcomConfig.gsAntennaDia,
      },
      sat_antenna_gain_dbi: +analysis.satAntennaGain.toFixed(1),
      gs_antenna_gain_dbi: +analysis.gsAntennaGain.toFixed(1),
      eirp_dbw: +analysis.satEIRP.toFixed(1),
      free_space_path_loss_db: +analysis.fspl.toFixed(1),
      link_margin_db: +analysis.linkMargin.toFixed(1),
      max_data_rate_mbps: +analysis.maxDataRate.toFixed(3),
      beam_footprint_km: +analysis.beamFootprintKm.toFixed(1),
      data_volume_per_pass_gb: +analysis.dataVolumePerPass.toFixed(3),
      data_volume_per_day_gb: +analysis.dataVolumePerDay.toFixed(3),
    }
  }

  throw new Error(`Unsupported payload type: ${payloadType}. Use 'earth-observation' or 'satcom'.`)
}

function executeSetVisualization(input: Record<string, unknown>): Record<string, unknown> {
  // This tool returns the visualization config for the store.
  // The actual store update is handled by useArchitectChat after tool execution.
  const template = input.template as string
  const altKm = input.altitude_km as number
  const incDeg = input.inclination_deg as number

  const result: Record<string, unknown> = {
    template,
    altitude_km: altKm,
    inclination_deg: incDeg,
    status: 'visualization_set',
  }

  if (input.stations) {
    result.stations = input.stations
  }
  if (input.num_planes) {
    result.num_planes = input.num_planes
  }
  if (input.sats_per_plane) {
    result.sats_per_plane = input.sats_per_plane
  }
  if (input.swath_width_km) {
    result.swath_width_km = input.swath_width_km
  }

  return result
}
