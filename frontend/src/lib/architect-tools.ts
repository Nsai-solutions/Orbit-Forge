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
import { computeBallisticCoefficient, checkCompliance } from './orbital-lifetime'
import type { SolarActivity } from './orbital-lifetime'
import { computeEOAnalysis } from './payload-eo'
import { computeSATCOMAnalysis } from './payload-satcom'
import { computeLagrangeResult } from './lagrange'
import { computeLunarResult, computePropellantMass } from './lunar-transfer'
import { computeInterplanetaryResult } from './interplanetary'
import { PLANET_DATA } from './beyond-leo-constants'
import type { LagrangePoint, LagrangeOrbitType, TargetBody } from '@/types/beyond-leo'
import { BODY_ARRIVAL_DEFAULTS } from '@/types/beyond-leo'

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
        spacecraft_size: { type: 'string', enum: ['1U', '1.5U', '2U', '3U', '6U', '12U', 'SmallSat', 'Custom'], description: 'Spacecraft bus type (CubeSat size, SmallSat, or Custom)' },
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
    description: 'Predict satellite ground station passes and compute communication metrics including passes per day, average duration, maximum gap between contacts, daily data throughput, and pass quality grades (A/B/C/D based on max elevation). Each pass includes a quality grade: A (>60° max el, excellent), B (30-60°, good), C (10-30°, marginal), D (<10°, poor). The Ground Passes tab also provides per-pass RF link budgets and visualization charts.',
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
    description: 'Estimate orbital lifetime from atmospheric drag and check compliance with debris mitigation guidelines (25-year rule and FCC 5-year rule). Returns lifetime estimate, deorbit delta-V needed, and compliance status. You can specify cross-section area directly for non-CubeSat spacecraft.',
    input_schema: {
      type: 'object',
      properties: {
        altitude_km: { type: 'number', description: 'Orbital altitude in km' },
        spacecraft_mass_kg: { type: 'number', description: 'Spacecraft mass in kg. Default: 4' },
        spacecraft_size: { type: 'string', enum: ['1U', '1.5U', '2U', '3U', '6U', '12U', 'SmallSat', 'Custom'], description: 'Bus type. For CubeSats, auto-fills cross-section. Use SmallSat or Custom for larger spacecraft. Default: 3U' },
        cross_section_m2: { type: 'number', description: 'Cross-sectional drag area in m². Overrides the default for the selected bus type. Use this for non-CubeSat spacecraft.' },
        drag_coefficient: { type: 'number', description: 'Drag coefficient Cd (1.0-4.0). Default: 2.2' },
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
    description: 'Set the 3D visualization in the Mission Summary panel. Choose the appropriate template based on the mission type. For LEO missions use leo-orbit, leo-with-stations, ground-coverage, or constellation. For Beyond-LEO missions use the lagrange, lunar, or interplanetary templates.',
    input_schema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          enum: [
            'leo-orbit', 'leo-with-stations', 'ground-coverage', 'constellation',
            'lagrange-halo', 'lagrange-lissajous', 'lagrange-lyapunov', 'lagrange-transfer-only',
            'lunar-orbit-insertion', 'lunar-flyby', 'lunar-free-return', 'lunar-landing',
            'interplanetary-hohmann', 'interplanetary-flyby', 'interplanetary-with-capture', 'interplanetary-porkchop',
          ],
          description: 'The visualization template to use. Pick based on mission type.',
        },
        params: {
          type: 'object',
          description: 'Parameters to customize the visualization. Varies by template.',
          properties: {
            altitude_km: { type: 'number', description: 'LEO orbital altitude in km' },
            inclination_deg: { type: 'number', description: 'LEO orbital inclination in degrees' },
            system: { type: 'string', enum: ['sun-earth', 'earth-moon'], description: 'Three-body system for Lagrange visualizations' },
            l_point: { type: 'integer', description: 'Lagrange point number (1-5)' },
            orbit_type: { type: 'string', enum: ['halo', 'lissajous', 'lyapunov'], description: 'Orbit type around the L-point' },
            amplitude_km: { type: 'number', description: 'Orbit amplitude in km' },
            mission_type: { type: 'string', enum: ['orbit-insertion', 'flyby', 'free-return', 'landing'], description: 'Type of lunar mission' },
            lunar_orbit_alt_km: { type: 'number', description: 'Lunar orbit altitude for orbit insertion' },
            closest_approach_km: { type: 'number', description: 'Closest approach distance for flyby/free-return' },
            target_body: { type: 'string', enum: ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'], description: 'Target planet for interplanetary visualizations' },
            ground_stations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  lat: { type: 'number' },
                  lon: { type: 'number' },
                },
              },
            },
            num_planes: { type: 'number', description: 'Number of orbital planes (for constellation template)' },
            sats_per_plane: { type: 'number', description: 'Satellites per plane (for constellation template)' },
            swath_width_km: { type: 'number', description: 'Sensor swath width in km (for ground-coverage template)' },
          },
        },
      },
      required: ['template'],
    },
  },
  {
    name: 'analyze_lagrange',
    description: 'Analyze a Lagrange point mission. Computes L-point position, transfer ΔV from LEO, station-keeping requirements, and halo/Lissajous orbit parameters. Use for missions to Sun-Earth or Earth-Moon Lagrange points (L1-L5).',
    input_schema: {
      type: 'object',
      properties: {
        system: { type: 'string', enum: ['sun-earth', 'earth-moon'], description: 'The three-body system' },
        l_point: { type: 'integer', minimum: 1, maximum: 5, description: 'Which Lagrange point (1-5)' },
        orbit_type: {
          type: 'string', enum: ['halo', 'lissajous', 'lyapunov'],
          description: 'Type of orbit around the L-point. Halo orbits are out-of-plane, Lissajous are quasi-periodic, Lyapunov are planar. Default to halo for most missions.',
        },
        orbit_amplitude_km: {
          type: 'number',
          description: 'Amplitude of the orbit around the L-point in km. Typical values: 250,000-800,000 km for Sun-Earth, 10,000-65,000 km for Earth-Moon. Use 500,000 km for Sun-Earth and 30,000 km for Earth-Moon as defaults.',
        },
        parking_orbit_alt_km: { type: 'number', description: 'Parking orbit altitude in km for transfer ΔV calculation. Default 200 km (standard LEO).' },
      },
      required: ['system', 'l_point'],
    },
  },
  {
    name: 'analyze_lunar_transfer',
    description: 'Analyze a lunar transfer mission. Computes TLI ΔV, LOI ΔV, transfer time, phase angle, and propellant requirements. Supports orbit insertion, flyby, free-return, and landing mission types. NOTE: Lunar trajectory visualizations are still being refined — the numerical data is validated against Apollo reference values but the 3D visualization may not display correctly.',
    input_schema: {
      type: 'object',
      properties: {
        mission_type: {
          type: 'string', enum: ['orbit-insertion', 'flyby', 'free-return', 'landing'],
          description: 'Type of lunar mission. Orbit insertion: enter lunar orbit. Flyby: gravity assist past Moon. Free-return: loop around Moon and return to Earth. Landing: descend to lunar surface.',
        },
        parking_orbit_alt_km: { type: 'number', description: 'Earth parking orbit altitude in km. Default 200 km.' },
        lunar_orbit_alt_km: { type: 'number', description: 'Target lunar orbit altitude in km (for orbit insertion). Default 100 km. Not used for flyby/free-return.' },
        closest_approach_km: { type: 'number', description: 'Closest approach distance to Moon surface in km (for flyby/free-return). Default 200 km for flyby, 250 km for free-return.' },
        spacecraft_mass_kg: { type: 'number', description: 'Spacecraft dry mass in kg for propellant calculations. Default 10 kg.' },
        isp_s: { type: 'number', description: 'Specific impulse of propulsion system in seconds. Default 220 s (cold gas). Use 300 s for bipropellant, 1500 s for electric propulsion.' },
      },
      required: ['mission_type'],
    },
  },
  {
    name: 'analyze_interplanetary',
    description: 'Analyze an interplanetary transfer mission using Hohmann transfer calculations. Computes departure ΔV, arrival ΔV, C3 energy, transfer time, and propellant requirements for missions to any planet in the solar system.',
    input_schema: {
      type: 'object',
      properties: {
        target_body: {
          type: 'string', enum: ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'ceres', 'vesta'],
          description: 'Target destination',
        },
        parking_orbit_alt_km: { type: 'number', description: 'Earth parking orbit altitude in km. Default 200 km.' },
        capture_orbit_alt_km: { type: 'number', description: 'Target body capture orbit altitude in km. Uses per-body defaults (300 km for rocky, 2000 km for gas giants with elliptical capture).' },
        spacecraft_mass_kg: { type: 'number', description: 'Spacecraft dry mass in kg. Default 500 kg.' },
        isp_s: { type: 'number', description: 'Specific impulse in seconds. Default 320 s (bipropellant).' },
        mission_type: {
          type: 'string', enum: ['hohmann', 'flyby'],
          description: 'Hohmann: minimum-energy transfer with orbit capture. Flyby: gravity assist trajectory (no capture burn). Default hohmann.',
        },
      },
      required: ['target_body'],
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
    crossSectionArea: sizeSpec?.typicalCrossSection || DEFAULT_SPACECRAFT.crossSectionArea,
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
    case 'analyze_lagrange':
      return executeAnalyzeLagrange(input)
    case 'analyze_lunar_transfer':
      return executeAnalyzeLunarTransfer(input)
    case 'analyze_interplanetary':
      return executeAnalyzeInterplanetary(input)
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
    crossSectionArea: spacecraft.crossSectionArea,
    dragCoefficient: spacecraft.dragCoefficient,
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

  // Quality breakdown
  const qualityCounts = { A: 0, B: 0, C: 0, D: 0 }
  passes.forEach((p) => { qualityCounts[p.quality as keyof typeof qualityCounts]++ })

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
    pass_quality_breakdown: qualityCounts,
    best_passes: topPasses,
    note: 'Per-pass RF link budgets and visualization charts (contact timeline, link waterfall, sky plot) are available in the Ground Passes tab.',
  }
}

function executePredictLifetime(input: Record<string, unknown>): Record<string, unknown> {
  const altKm = input.altitude_km as number
  const size = (input.spacecraft_size as string) || '3U'
  const massKg = (input.spacecraft_mass_kg as number) || CUBESAT_SIZES[size as CubeSatSize]?.typicalMass.max || 4
  const solarActivity = (input.solar_activity as SolarActivity) || 'moderate'
  const cd = (input.drag_coefficient as number) || 2.2

  // Use explicit cross-section if provided, otherwise derive from bus type
  const crossSection = (input.cross_section_m2 as number) || CUBESAT_SIZES[size as CubeSatSize]?.typicalCrossSection || 0.03
  const bStar = computeBallisticCoefficient(massKg, crossSection, cd)
  const compliance = checkCompliance(altKm, bStar, solarActivity)

  // Sync spacecraft properties to store
  useStore.getState().updateSpacecraft({
    size: size as CubeSatSize,
    mass: massKg,
    crossSectionArea: crossSection,
    dragCoefficient: cd,
  })

  return {
    altitude_km: altKm,
    spacecraft_size: size,
    spacecraft_mass_kg: massKg,
    cross_section_m2: +crossSection.toFixed(4),
    drag_coefficient: cd,
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

function executeAnalyzeLagrange(input: Record<string, unknown>): Record<string, unknown> {
  const systemRaw = input.system as string
  const system = systemRaw === 'sun-earth' ? 'SE' : 'EM' as const
  const lPoint = input.l_point as number
  const point = `L${lPoint}` as LagrangePoint
  const orbitType = (input.orbit_type as LagrangeOrbitType) || 'halo'
  const defaultAmp = system === 'SE' ? 500000 : 30000
  const amplitudeKm = (input.orbit_amplitude_km as number) || defaultAmp
  const departureAltKm = (input.parking_orbit_alt_km as number) || 200

  const result = computeLagrangeResult({
    system,
    point,
    orbitType,
    amplitudeKm,
    departureAltKm,
    transferType: 'direct',
    missionLifetimeYears: 5,
    stationKeepingBudgetMs: 30,
  })

  // Sync to Beyond-LEO store
  const store = useStore.getState()
  store.setBeyondLeoMode('lagrange')
  store.updateLagrangeParams({
    system,
    point,
    orbitType,
    amplitudeKm,
    departureAltKm,
    transferType: 'direct',
    missionLifetimeYears: 5,
  })

  return {
    system: systemRaw,
    l_point: lPoint,
    orbit_type: orbitType,
    l_point_distance_km: +result.pointDistanceKm.toFixed(0),
    transfer_delta_v_ms: +result.transferDeltaVms.toFixed(0),
    insertion_delta_v_ms: +result.insertionDeltaVms.toFixed(0),
    total_delta_v_ms: +result.totalDeltaVms.toFixed(0),
    transfer_time_days: +result.transferTimeDays.toFixed(0),
    station_keeping_delta_v_ms_per_year: +result.annualStationKeepingMs.toFixed(1),
    orbit_period_days: +result.haloPeriodDays.toFixed(1),
    orbit_amplitude_km: amplitudeKm,
    comms_distance_km: +result.commsDistanceKm.toFixed(0),
    comms_delay_s: +result.commsDelayS.toFixed(2),
    stability: result.stabilityClass,
    mission_total_delta_v_ms: +result.missionTotalDeltaVms.toFixed(0),
    parking_orbit_alt_km: departureAltKm,
  }
}

function executeAnalyzeLunarTransfer(input: Record<string, unknown>): Record<string, unknown> {
  const missionTypeRaw = input.mission_type as string
  // Map tool names to library types
  const missionTypeMap: Record<string, string> = {
    'orbit-insertion': 'orbit',
    'flyby': 'flyby',
    'free-return': 'free-return',
    'landing': 'landing',
  }
  const missionType = (missionTypeMap[missionTypeRaw] || 'orbit') as 'orbit' | 'flyby' | 'landing' | 'free-return'

  const departureAltKm = (input.parking_orbit_alt_km as number) || 200
  const spacecraftMassKg = (input.spacecraft_mass_kg as number) || 10
  const ispS = (input.isp_s as number) || 220

  // Set targetOrbitAltKm based on mission type
  let targetOrbitAltKm: number
  if (missionType === 'flyby') {
    targetOrbitAltKm = (input.closest_approach_km as number) || 200
  } else if (missionType === 'free-return') {
    targetOrbitAltKm = (input.closest_approach_km as number) || 250
  } else {
    targetOrbitAltKm = (input.lunar_orbit_alt_km as number) || 100
  }

  const result = computeLunarResult({
    missionType,
    targetOrbitAltKm,
    targetOrbitIncDeg: 90,
    transferType: 'hohmann',
    departureAltKm,
    spacecraftMassKg,
    ispS,
    propellantMassKg: 0,
    closestApproachAltKm: (input.closest_approach_km as number) || 250,
  })

  // Sync to Beyond-LEO store
  const store = useStore.getState()
  store.setBeyondLeoMode('lunar')
  store.updateLunarParams({
    missionType,
    targetOrbitAltKm,
    departureAltKm,
    spacecraftMassKg,
    ispS,
    transferType: 'hohmann',
    propellantMassKg: result.propellantRequiredKg,
  })

  return {
    mission_type: missionTypeRaw,
    tli_delta_v_ms: +result.tliDeltaVms.toFixed(0),
    loi_delta_v_ms: +result.loiDeltaVms.toFixed(0),
    total_delta_v_ms: +result.totalDeltaVms.toFixed(0),
    transfer_time_days: +result.transferTimeDays.toFixed(1),
    phase_angle_deg: +result.phaseAngleDeg.toFixed(1),
    propellant_mass_kg: +result.propellantRequiredKg.toFixed(1),
    dry_mass_kg: +spacecraftMassKg.toFixed(1),
    spacecraft_mass_kg: spacecraftMassKg,
    isp_s: ispS,
    closest_approach_km: (missionType === 'flyby' || missionType === 'free-return') ? targetOrbitAltKm : undefined,
    lunar_orbit_alt_km: (missionType === 'orbit' || missionType === 'landing') ? targetOrbitAltKm : undefined,
    parking_orbit_alt_km: departureAltKm,
    comm_delay_s: +result.commDelayS.toFixed(2),
    lunar_orbit_period_min: result.lunarOrbitPeriodMin > 0 ? +result.lunarOrbitPeriodMin.toFixed(1) : undefined,
    free_return_period_days: result.freeReturnPeriodDays > 0 ? +result.freeReturnPeriodDays.toFixed(1) : undefined,
    notes: 'TLI ΔV validated against Apollo missions (~3100-3200 m/s). Lunar trajectory visualization is still being refined.',
  }
}

function executeAnalyzeInterplanetary(input: Record<string, unknown>): Record<string, unknown> {
  const targetBody = input.target_body as TargetBody
  const departureAltKm = (input.parking_orbit_alt_km as number) || 200
  const spacecraftMassKg = (input.spacecraft_mass_kg as number) || 500
  const ispS = (input.isp_s as number) || 320
  const missionType = (input.mission_type as string) || 'hohmann'
  const isFlyby = missionType === 'flyby'

  // Use per-body defaults for capture orbit
  const bodyDefaults = BODY_ARRIVAL_DEFAULTS[targetBody]
  const captureOrbitAltKm = (input.capture_orbit_alt_km as number) || bodyDefaults.altKm

  const result = computeInterplanetaryResult({
    targetBody,
    missionType: isFlyby ? 'flyby' : 'orbiter',
    transferType: 'hohmann',
    departureAltKm,
    arrivalOrbitAltKm: captureOrbitAltKm,
    arrivalOrbitType: bodyDefaults.orbitType,
    captureApoFactor: bodyDefaults.apoFactor,
    departureDateISO: '2026-07-01T00:00:00.000Z',
    arrivalDateISO: '2027-01-15T00:00:00.000Z',
    spacecraftMassKg,
  })

  // For flyby, no capture burn
  const arrivalDvMs = isFlyby ? 0 : result.arrivalInsertionDeltaVms
  const totalDvMs = result.departureDeltaVms + arrivalDvMs

  // Compute propellant mass (Tsiolkovsky)
  const propellantMassKg = computePropellantMass(totalDvMs, spacecraftMassKg, ispS)

  // Phase angle: 180° - target's angular displacement during transfer
  const planet = PLANET_DATA[targetBody]
  const rawPhase = 180 - (360 / planet.orbitalPeriodDays) * result.transferTimeDays
  const phaseAngleDeg = ((rawPhase % 360) + 360) % 360

  // Sync to Beyond-LEO store
  const store = useStore.getState()
  store.setBeyondLeoMode('interplanetary')
  store.updateInterplanetaryParams({
    targetBody,
    missionType: isFlyby ? 'flyby' : 'orbiter',
    transferType: 'hohmann',
    departureAltKm,
    arrivalOrbitAltKm: captureOrbitAltKm,
    arrivalOrbitType: bodyDefaults.orbitType,
    captureApoFactor: bodyDefaults.apoFactor,
    spacecraftMassKg,
  })

  return {
    target_body: targetBody,
    mission_type: missionType,
    departure_delta_v_ms: +result.departureDeltaVms.toFixed(0),
    arrival_delta_v_ms: +arrivalDvMs.toFixed(0),
    total_delta_v_ms: +totalDvMs.toFixed(0),
    c3_km2_s2: +result.c3Km2s2.toFixed(1),
    v_inf_depart_kms: +Math.sqrt(result.c3Km2s2).toFixed(2),
    v_inf_arrive_kms: +result.arrivalVinfKms.toFixed(2),
    transfer_time_days: +result.transferTimeDays.toFixed(0),
    transfer_time_years: +(result.transferTimeDays / 365.25).toFixed(2),
    phase_angle_deg: +phaseAngleDeg.toFixed(1),
    synodic_period_days: +result.synodicPeriodDays.toFixed(0),
    propellant_mass_kg: +propellantMassKg.toFixed(1),
    dry_mass_kg: +spacecraftMassKg.toFixed(1),
    spacecraft_mass_kg: spacecraftMassKg,
    isp_s: ispS,
    parking_orbit_alt_km: departureAltKm,
    capture_orbit_alt_km: captureOrbitAltKm,
    comms_distance_au: +result.commsDistanceAU.toFixed(2),
    comms_delay_s: +result.commsDelayS.toFixed(0),
    planet_radius_km: result.planetRadiusKm,
    planet_surface_gravity_ms2: +result.planetSurfaceGravityMs2.toFixed(2),
    notes: 'Hohmann transfer provides minimum-energy trajectory. Actual missions often use slightly different trajectories for shorter transfer times at the cost of more ΔV.',
  }
}

function executeSetVisualization(input: Record<string, unknown>): Record<string, unknown> {
  // This tool returns the visualization config for the store.
  // The actual store update is handled by useArchitectChat after tool execution.
  const template = input.template as string
  const params = (input.params as Record<string, unknown>) || {}

  // For Beyond-LEO templates, also update the Beyond-LEO store
  const store = useStore.getState()

  if (template.startsWith('lagrange-')) {
    const system = params.system === 'earth-moon' ? 'EM' : 'SE' as const
    const lPoint = (params.l_point as number) || 2
    const orbitType = (params.orbit_type as string) || template.replace('lagrange-', '') || 'halo'
    const defaultAmp = system === 'SE' ? 500000 : 30000
    const amplitudeKm = (params.amplitude_km as number) || defaultAmp

    store.setBeyondLeoMode('lagrange')
    store.updateLagrangeParams({
      system,
      point: `L${lPoint}` as LagrangePoint,
      orbitType: (orbitType === 'transfer-only' ? 'halo' : orbitType) as LagrangeOrbitType,
      amplitudeKm,
      departureAltKm: 200,
      transferType: 'direct',
    })
  } else if (template.startsWith('lunar-')) {
    const missionTypeMap: Record<string, string> = {
      'lunar-orbit-insertion': 'orbit',
      'lunar-flyby': 'flyby',
      'lunar-free-return': 'free-return',
      'lunar-landing': 'landing',
    }
    const missionType = (missionTypeMap[template] || params.mission_type || 'orbit') as 'orbit' | 'flyby' | 'free-return' | 'landing'
    const targetOrbitAltKm = (missionType === 'flyby' || missionType === 'free-return')
      ? (params.closest_approach_km as number) || 200
      : (params.lunar_orbit_alt_km as number) || 100

    store.setBeyondLeoMode('lunar')
    store.updateLunarParams({
      missionType,
      targetOrbitAltKm,
      departureAltKm: 200,
      transferType: 'hohmann',
    })
  } else if (template.startsWith('interplanetary-')) {
    const targetBody = (params.target_body as TargetBody) || 'mars'

    store.setBeyondLeoMode('interplanetary')
    store.updateInterplanetaryParams({
      targetBody,
      missionType: template === 'interplanetary-flyby' ? 'flyby' : 'orbiter',
      transferType: 'hohmann',
      departureAltKm: 200,
    })
  }

  const result: Record<string, unknown> = {
    template,
    params,
    status: 'visualization_set',
  }

  return result
}
