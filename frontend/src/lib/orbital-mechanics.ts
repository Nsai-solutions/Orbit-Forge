import { MU_EARTH_KM, R_EARTH_EQUATORIAL, J2, DEG2RAD, RAD2DEG, OMEGA_EARTH, SEC_PER_DAY } from './constants'
import { OrbitalElements, keplerianToCartesian, eciToEcef, ecefToGeodetic, eciToEcefThreeJS } from './coordinate-transforms'
import { dateToGMST } from './time-utils'
import type { Vec3 } from '@/types'

/**
 * Compute orbital period from semi-major axis (km)
 * Returns period in seconds
 */
export function computeOrbitalPeriod(a: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / MU_EARTH_KM)
}

/**
 * Compute velocity at a given radius using vis-viva equation
 * a: semi-major axis (km), r: current radius (km)
 * Returns velocity in km/s
 */
export function computeVelocityAtRadius(a: number, r: number): number {
  return Math.sqrt(MU_EARTH_KM * (2 / r - 1 / a))
}

/**
 * Compute velocity at perigee
 */
export function computeVelocityPerigee(a: number, e: number): number {
  const rp = a * (1 - e)
  return computeVelocityAtRadius(a, rp)
}

/**
 * Compute velocity at apogee
 */
export function computeVelocityApogee(a: number, e: number): number {
  const ra = a * (1 + e)
  return computeVelocityAtRadius(a, ra)
}

/**
 * Solve Kepler's equation: M = E - e*sin(E)
 * Uses Newton-Raphson iteration
 * M: mean anomaly (radians), e: eccentricity
 * Returns eccentric anomaly (radians)
 */
export function solveKeplerEquation(M: number, e: number, tolerance = 1e-12): number {
  // Initial guess
  let E = M + e * Math.sin(M) / (1 - Math.sin(M + e) + Math.sin(M))

  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < tolerance) break
  }

  return E
}

/**
 * Convert eccentric anomaly to true anomaly
 */
export function eccentricToTrueAnomaly(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  )
}

/**
 * Convert true anomaly to eccentric anomaly
 */
export function trueToEccentricAnomaly(nu: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 - e) * Math.sin(nu / 2),
    Math.sqrt(1 + e) * Math.cos(nu / 2)
  )
}

/**
 * Convert true anomaly to mean anomaly
 */
export function trueToMeanAnomaly(nu: number, e: number): number {
  const E = trueToEccentricAnomaly(nu, e)
  return E - e * Math.sin(E)
}

/**
 * Compute J2 secular rate of change of RAAN (deg/day)
 */
export function computeJ2RAANDrift(a: number, e: number, iDeg: number): number {
  if (e >= 1) return NaN // J2 secular rates undefined for parabolic/hyperbolic orbits
  const i = iDeg * DEG2RAD
  const n = Math.sqrt(MU_EARTH_KM / (a * a * a)) // mean motion (rad/s)
  const p = a * (1 - e * e) // semi-latus rectum (km)
  if (p <= 0) return NaN

  // RAAN drift rate (rad/s)
  const dOmega = -1.5 * n * J2 * Math.pow(R_EARTH_EQUATORIAL / p, 2) * Math.cos(i)

  // Convert to deg/day
  return dOmega * RAD2DEG * SEC_PER_DAY
}

/**
 * Compute J2 secular rate of change of argument of perigee (deg/day)
 */
export function computeJ2ArgPerigeeDrift(a: number, e: number, iDeg: number): number {
  if (e >= 1) return NaN // J2 secular rates undefined for parabolic/hyperbolic orbits
  const i = iDeg * DEG2RAD
  const n = Math.sqrt(MU_EARTH_KM / (a * a * a))
  const p = a * (1 - e * e)
  if (p <= 0) return NaN

  // Argument of perigee drift rate (rad/s)
  const domega = 0.75 * n * J2 * Math.pow(R_EARTH_EQUATORIAL / p, 2) * (5 * Math.cos(i) * Math.cos(i) - 1)

  return domega * RAD2DEG * SEC_PER_DAY
}

/**
 * Compute required inclination for sun-synchronous orbit
 * Returns inclination in degrees, or NaN if impossible
 */
export function computeSunSyncInclination(a: number, e: number): number {
  // Sun-sync requires RAAN drift of 360 deg / 365.25 days = 0.9856 deg/day
  const targetDrift = 360.0 / 365.25 // deg/day
  const targetDriftRad = targetDrift * DEG2RAD / SEC_PER_DAY // rad/s

  const n = Math.sqrt(MU_EARTH_KM / (a * a * a))
  const p = a * (1 - e * e)

  // From RAAN drift formula: cos(i) = -targetDrift / (1.5 * n * J2 * (Re/p)^2)
  const cosI = -targetDriftRad / (1.5 * n * J2 * Math.pow(R_EARTH_EQUATORIAL / p, 2))

  if (Math.abs(cosI) > 1) return NaN

  return Math.acos(cosI) * RAD2DEG
}

/**
 * Compute eclipse fraction for a circular orbit (analytical approximation)
 * Returns fraction of orbit spent in eclipse (0-1)
 */
export function computeEclipseFraction(altitudeKm: number): number {
  const r = R_EARTH_EQUATORIAL + altitudeKm
  const sinRho = R_EARTH_EQUATORIAL / r
  if (sinRho >= 1) return 1
  return Math.asin(sinRho) / Math.PI
}

/**
 * Compute revolutions per day
 */
export function computeRevsPerDay(a: number): number {
  const period = computeOrbitalPeriod(a)
  return SEC_PER_DAY / period
}

/**
 * Propagate an orbit and generate position arrays for 3D rendering
 * Returns positions in ECEF-aligned Three.js coordinates (Earth radii units)
 * so the orbit line aligns with the Earth globe texture and ground tracks.
 */
export function propagateOrbitPositions(
  elements: OrbitalElements,
  numPoints = 360,
  epoch: Date = new Date()
): Vec3[] {
  const positions: Vec3[] = []
  const gmst = dateToGMST(epoch)

  for (let i = 0; i <= numPoints; i++) {
    const nu = (i / numPoints) * 360 // true anomaly in degrees
    const elemAtPoint: OrbitalElements = {
      ...elements,
      trueAnomaly: nu,
    }

    const { position } = keplerianToCartesian(elemAtPoint, MU_EARTH_KM)
    positions.push(eciToEcefThreeJS(position, gmst))
  }

  return positions
}

/**
 * Get satellite position at a specific true anomaly
 * Returns position in ECEF-aligned Three.js coordinates
 */
export function getSatellitePosition(elements: OrbitalElements, epoch: Date = new Date()): Vec3 {
  const { position } = keplerianToCartesian(elements, MU_EARTH_KM)
  const gmst = dateToGMST(epoch)
  return eciToEcefThreeJS(position, gmst)
}

/**
 * Compute ground track for multiple orbits
 * Returns array of {lat, lon} in degrees
 *
 * When useFixedGMST is true, a single GMST (at epoch) is used for all points.
 * This matches the orbit ring's rendering (frozen Earth rotation) and ensures
 * the 3D ground track aligns perfectly with the orbit ring and satellite marker.
 * Use useFixedGMST=false (default) for the 2D Mercator map where evolving GMST
 * produces the correct sinusoidal ground trace pattern.
 */
export function computeGroundTrack(
  elements: OrbitalElements,
  epoch: Date,
  numRevolutions = 1,
  pointsPerRev = 360,
  useFixedGMST = false
): Array<{ lat: number; lon: number }> {
  const period = computeOrbitalPeriod(elements.semiMajorAxis)
  const totalPoints = numRevolutions * pointsPerRev
  const track: Array<{ lat: number; lon: number }> = []

  // Compute mean motion
  const n = 2 * Math.PI / period // rad/s

  // J2 secular drift rates
  const raanDrift = computeJ2RAANDrift(
    elements.semiMajorAxis, elements.eccentricity, elements.inclination
  ) * DEG2RAD / SEC_PER_DAY // rad/s

  const omegaDrift = computeJ2ArgPerigeeDrift(
    elements.semiMajorAxis, elements.eccentricity, elements.inclination
  ) * DEG2RAD / SEC_PER_DAY // rad/s

  // Initial mean anomaly
  const nu0 = elements.trueAnomaly * DEG2RAD
  const E0 = trueToEccentricAnomaly(nu0, elements.eccentricity)
  const M0 = E0 - elements.eccentricity * Math.sin(E0)

  // When useFixedGMST is true, compute GMST once (matches orbit ring rendering)
  const fixedGmst = useFixedGMST ? dateToGMST(epoch) : 0

  for (let i = 0; i <= totalPoints; i++) {
    const dt = (i / pointsPerRev) * period // seconds since epoch

    // Update mean anomaly
    const M = M0 + n * dt

    // Solve Kepler equation for eccentric anomaly
    const E = solveKeplerEquation(M % (2 * Math.PI), elements.eccentricity)

    // Convert to true anomaly
    const nu = eccentricToTrueAnomaly(E, elements.eccentricity)

    // Apply J2 secular drift to RAAN and arg of perigee
    const currentElements: OrbitalElements = {
      ...elements,
      raan: elements.raan + raanDrift * dt * RAD2DEG,
      argOfPerigee: elements.argOfPerigee + omegaDrift * dt * RAD2DEG,
      trueAnomaly: nu * RAD2DEG,
    }

    // Get ECI position
    const { position } = keplerianToCartesian(currentElements, MU_EARTH_KM)

    // Convert to ECEF: fixed GMST for 3D alignment, evolving GMST for 2D map
    const gmst = useFixedGMST
      ? fixedGmst
      : dateToGMST(new Date(epoch.getTime() + dt * 1000))
    const ecef = eciToEcef(position, gmst)

    // Convert to geodetic
    const geo = ecefToGeodetic(ecef)

    track.push({ lat: geo.lat, lon: geo.lon })
  }

  return track
}

/**
 * Compute all derived orbital parameters
 */
export interface DerivedOrbitalParams {
  period: number             // seconds
  periapsisAlt: number       // km (above surface)
  apoapsisAlt: number        // km (above surface)
  velocityPerigee: number    // km/s
  velocityApogee: number     // km/s
  raanDrift: number          // deg/day
  argPerigeeDrift: number    // deg/day
  revsPerDay: number
  eclipseFraction: number    // 0-1
  avgEclipseDuration: number // seconds
  maxEclipseDuration: number // seconds
  isSunSync: boolean
  sunSyncLTAN: string        // HH:MM if sun-sync
}

export function computeDerivedParams(elements: OrbitalElements): DerivedOrbitalParams {
  const a = elements.semiMajorAxis
  const e = elements.eccentricity
  const i = elements.inclination

  const period = computeOrbitalPeriod(a)
  const periapsisAlt = a * (1 - e) - R_EARTH_EQUATORIAL
  const apoapsisAlt = a * (1 + e) - R_EARTH_EQUATORIAL
  const avgAlt = (periapsisAlt + apoapsisAlt) / 2

  const velocityPerigee = computeVelocityPerigee(a, e)
  const velocityApogee = computeVelocityApogee(a, e)

  const raanDrift = computeJ2RAANDrift(a, e, i)
  const argPerigeeDrift = computeJ2ArgPerigeeDrift(a, e, i)

  const revsPerDay = computeRevsPerDay(a)

  // Eclipse fraction (approximate for circular orbits)
  const eclipseFraction = computeEclipseFraction(avgAlt)
  const avgEclipseDuration = eclipseFraction * period
  const maxEclipseDuration = avgEclipseDuration * 1.1 // rough estimate

  // Check if sun-synchronous (RAAN drift ~0.9856 deg/day)
  const targetSunSyncDrift = 360.0 / 365.25
  const isSunSync = Math.abs(raanDrift - targetSunSyncDrift) < 0.05

  // Approximate LTAN from RAAN (simplified)
  const ltanHours = ((elements.raan / 15) + 12) % 24
  const ltanH = Math.floor(ltanHours)
  const ltanM = Math.floor((ltanHours - ltanH) * 60)
  const sunSyncLTAN = `${String(ltanH).padStart(2, '0')}:${String(ltanM).padStart(2, '0')}`

  return {
    period,
    periapsisAlt,
    apoapsisAlt,
    velocityPerigee,
    velocityApogee,
    raanDrift,
    argPerigeeDrift,
    revsPerDay,
    eclipseFraction,
    avgEclipseDuration,
    maxEclipseDuration,
    isSunSync,
    sunSyncLTAN,
  }
}
