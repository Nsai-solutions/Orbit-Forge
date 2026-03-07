import { R_EARTH_EQUATORIAL, MU_EARTH_KM } from './constants'
import { getNrlmsiseDensity, SOLAR_PRESETS } from './nrlmsise00'

/**
 * Solar activity levels and corresponding F10.7 indices
 */
export type SolarActivity = 'low' | 'moderate' | 'high'

const F107_VALUES: Record<SolarActivity, number> = {
  low: 70,
  moderate: 140,
  high: 250,
}

/**
 * Atmospheric density multiplier based on solar activity
 * The exponential model in constants.ts represents moderate activity.
 * F10.7 scaling: rho ~ rho_ref * (F10.7 / 140)^0.7
 */
function solarActivityMultiplier(activity: SolarActivity): number {
  const f107 = F107_VALUES[activity]
  return Math.pow(f107 / 140, 0.7)
}

/**
 * Compute ballistic coefficient B* = Cd * A / m
 * Cd: drag coefficient (typically 2.2 for LEO)
 * A: cross-sectional area (m^2)
 * m: mass (kg)
 * Returns in m^2/kg
 */
export function computeBallisticCoefficient(
  mass: number,
  crossSectionArea: number,
  cd: number = 2.2,
): number {
  if (mass === 0) return 0
  return (cd * crossSectionArea) / mass
}

/**
 * Estimate cross-sectional area from CubeSat size
 */
export function estimateCrossSection(size: string): number {
  const areas: Record<string, number> = {
    '1U': 0.01,      // 10x10 cm
    '1.5U': 0.01,
    '2U': 0.01,
    '3U': 0.01,      // 10x10 cm face
    '6U': 0.02,      // 20x10 cm
    '12U': 0.04,     // 20x20 cm
  }
  return areas[size] || 0.01
}

/**
 * Compute semi-major axis decay rate (km/day) using King-Hele theory
 * da/dt = -pi * a * rho * Bstar * V
 * where V is orbital velocity
 */
function decayRate(
  altitudeKm: number,
  ballisticCoeffM2Kg: number,
  solarActivity: SolarActivity,
): number {
  if (altitudeKm <= 0) return 0

  const r = R_EARTH_EQUATORIAL + altitudeKm // km
  const v = Math.sqrt(MU_EARTH_KM / r)  // km/s

  // Get atmospheric density (kg/m^3) from NRLMSISE-00
  const preset = SOLAR_PRESETS[solarActivity]
  const rho = getNrlmsiseDensity(altitudeKm, 0, 0, new Date(), preset.f107a, preset.f107, preset.ap)

  // Convert rho from kg/m^3 to kg/km^3 for consistent units
  const rhoKm = rho * 1e9

  // da/dt in km/orbit = -2*pi * a * rho_km * Bstar_km * 1
  // Bstar in m^2/kg = Bstar in km^2/kg * 1e6
  const bstarKm = ballisticCoeffM2Kg * 1e-6

  // Semi-major axis decay per orbit: -2*pi*a^2 * rho * Bstar
  const period = 2 * Math.PI * Math.sqrt(r * r * r / MU_EARTH_KM) // seconds
  const orbitsPerDay = 86400 / period

  const daPerOrbit = -2 * Math.PI * r * r * rhoKm * bstarKm
  return daPerOrbit * orbitsPerDay // km/day
}

/**
 * Simulate orbital decay over time
 * Returns array of {days, altitude} pairs
 */
export interface DecayPoint {
  days: number
  altitude: number
}

export function simulateDecay(
  initialAltitudeKm: number,
  ballisticCoeffM2Kg: number,
  solarActivity: SolarActivity,
  maxYears: number = 30,
  stepDays: number = 1,
): DecayPoint[] {
  const points: DecayPoint[] = []
  let alt = initialAltitudeKm
  const maxDays = maxYears * 365.25

  points.push({ days: 0, altitude: alt })

  for (let d = stepDays; d <= maxDays; d += stepDays) {
    // Use finer sub-steps below 200km where decay accelerates rapidly
    const subSteps = (alt < 200 && stepDays > 0.1) ? Math.ceil(stepDays / 0.1) : 1
    const subDt = stepDays / subSteps

    for (let s = 0; s < subSteps; s++) {
      const rate = decayRate(alt, ballisticCoeffM2Kg, solarActivity)
      alt += rate * subDt // rate is negative
      if (alt <= 80) break
    }

    if (alt <= 80) {
      points.push({ days: d, altitude: 80 })
      break
    }

    points.push({ days: d, altitude: alt })
  }

  return points
}

/**
 * Estimate orbital lifetime in days
 */
export function estimateLifetime(
  initialAltitudeKm: number,
  ballisticCoeffM2Kg: number,
  solarActivity: SolarActivity,
): number {
  const decay = simulateDecay(initialAltitudeKm, ballisticCoeffM2Kg, solarActivity, 50, 1)
  const lastPoint = decay[decay.length - 1]

  if (lastPoint.altitude <= 80) {
    return lastPoint.days
  }
  return lastPoint.days // exceeded max simulation time
}

/**
 * Compute delta-v needed for deorbit burn to lower perigee to ~80km
 * Uses Hohmann transfer approximation
 */
export function computeDeorbitDeltaV(currentAltitudeKm: number): number {
  const r1 = R_EARTH_EQUATORIAL + currentAltitudeKm
  const r2 = R_EARTH_EQUATORIAL + 80 // target perigee

  // Velocity at current altitude (circular orbit)
  const v1 = Math.sqrt(MU_EARTH_KM / r1)

  // Velocity at apoapsis of deorbit ellipse
  const a_transfer = (r1 + r2) / 2
  const v_transfer = Math.sqrt(MU_EARTH_KM * (2 / r1 - 1 / a_transfer))

  // Delta-v is the difference (retrograde burn)
  return Math.abs(v1 - v_transfer) * 1000 // m/s
}

/**
 * Check compliance with debris mitigation guidelines
 */
export interface ComplianceResult {
  lifetime25Year: boolean  // Traditional 25-year rule
  lifetime5Year: boolean   // New FCC 5-year rule (2024+)
  lifetimeDays: number
  lifetimeYears: number
  deorbitDeltaV: number   // m/s
  recommendation: string
}

export function checkCompliance(
  initialAltitudeKm: number,
  ballisticCoeffM2Kg: number,
  solarActivity: SolarActivity,
): ComplianceResult {
  const lifetimeDays = estimateLifetime(initialAltitudeKm, ballisticCoeffM2Kg, solarActivity)
  const lifetimeYears = lifetimeDays / 365.25
  const deorbitDeltaV = computeDeorbitDeltaV(initialAltitudeKm)

  const lifetime25Year = lifetimeYears <= 25
  const lifetime5Year = lifetimeYears <= 5

  let recommendation: string
  if (lifetime5Year) {
    recommendation = 'Compliant with FCC 5-year rule. No deorbit maneuver needed.'
  } else if (lifetime25Year) {
    recommendation = `Natural deorbit in ${lifetimeYears.toFixed(1)} years. Consider deorbit burn (${deorbitDeltaV.toFixed(1)} m/s) for FCC 5-year compliance.`
  } else {
    recommendation = `Exceeds 25-year limit. Active deorbit required: ${deorbitDeltaV.toFixed(1)} m/s delta-v.`
  }

  return {
    lifetime25Year,
    lifetime5Year,
    lifetimeDays,
    lifetimeYears,
    deorbitDeltaV,
    recommendation,
  }
}
