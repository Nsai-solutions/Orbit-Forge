import { DEG2RAD, RAD2DEG, R_EARTH_EQUATORIAL, MU_EARTH_KM } from './constants'
import { OrbitalElements, keplerianToCartesian, eciToEcefThreeJS } from './coordinate-transforms'
import { dateToGMST } from './time-utils'
import type { Vec3 } from '@/types'

/**
 * Walker constellation types
 */
export type WalkerType = 'delta' | 'star'

/**
 * Walker constellation parameters
 * T: total number of satellites
 * P: number of orbital planes
 * F: phasing parameter (0 to P-1)
 */
export interface WalkerParams {
  type: WalkerType
  totalSats: number    // T
  planes: number       // P
  phasing: number      // F
  altitude: number     // km above surface
  inclination: number  // degrees
  raan0: number        // RAAN of first plane (degrees)
  syncWithOrbit: boolean // When true, altitude & inclination inherit from orbit tab
}

export const DEFAULT_WALKER: WalkerParams = {
  type: 'delta',
  totalSats: 24,
  planes: 6,
  phasing: 1,
  altitude: 550,
  inclination: 53,
  raan0: 0,
  syncWithOrbit: true,
}

/**
 * Generate orbital elements for each satellite in a Walker constellation
 */
export interface ConstellationSatellite {
  id: number
  plane: number
  indexInPlane: number
  elements: OrbitalElements
}

export function generateWalkerConstellation(params: WalkerParams): ConstellationSatellite[] {
  const { totalSats, planes, phasing, altitude, inclination, raan0, type } = params
  const satsPerPlane = Math.floor(totalSats / planes)
  const semiMajorAxis = R_EARTH_EQUATORIAL + altitude

  // RAAN spacing between planes
  const raanSpacing = type === 'delta' ? 360 / planes : 180 / planes

  // In-plane spacing between satellites
  const inPlaneSpacing = 360 / satsPerPlane

  // Phase offset between adjacent planes
  const phaseOffset = (phasing * 360) / totalSats

  const satellites: ConstellationSatellite[] = []
  let id = 0

  for (let p = 0; p < planes; p++) {
    const planeRaan = (raan0 + p * raanSpacing) % 360

    for (let s = 0; s < satsPerPlane; s++) {
      const trueAnomaly = (s * inPlaneSpacing + p * phaseOffset) % 360

      satellites.push({
        id: id++,
        plane: p,
        indexInPlane: s,
        elements: {
          semiMajorAxis,
          eccentricity: 0,
          inclination,
          raan: planeRaan,
          argOfPerigee: 0,
          trueAnomaly,
        },
      })
    }
  }

  return satellites
}

/**
 * Generate 3D positions for all constellation satellites (ECEF-aligned)
 */
export function getConstellationPositions(satellites: ConstellationSatellite[], epoch: Date = new Date()): Vec3[] {
  const gmst = dateToGMST(epoch)
  return satellites.map((sat) => {
    const { position } = keplerianToCartesian(sat.elements, MU_EARTH_KM)
    return eciToEcefThreeJS(position, gmst)
  })
}

/**
 * Generate orbit lines for each plane in the constellation (ECEF-aligned)
 */
export function getConstellationOrbits(
  params: WalkerParams,
  pointsPerOrbit = 90,
  epoch: Date = new Date(),
): Vec3[][] {
  const semiMajorAxis = R_EARTH_EQUATORIAL + params.altitude
  const raanSpacing = params.type === 'delta' ? 360 / params.planes : 180 / params.planes
  const gmst = dateToGMST(epoch)

  const orbits: Vec3[][] = []

  for (let p = 0; p < params.planes; p++) {
    const planeRaan = (params.raan0 + p * raanSpacing) % 360
    const points: Vec3[] = []

    for (let i = 0; i <= pointsPerOrbit; i++) {
      const nu = (i / pointsPerOrbit) * 360
      const elements: OrbitalElements = {
        semiMajorAxis,
        eccentricity: 0,
        inclination: params.inclination,
        raan: planeRaan,
        argOfPerigee: 0,
        trueAnomaly: nu,
      }
      const { position } = keplerianToCartesian(elements, MU_EARTH_KM)
      points.push(eciToEcefThreeJS(position, gmst))
    }
    orbits.push(points)
  }

  return orbits
}

/**
 * Constellation summary metrics
 */
export interface ConstellationMetrics {
  totalMass: number       // kg
  totalSatellites: number
  planesCount: number
  satsPerPlane: number
  orbitalPeriodMin: number
  coverageLatBand: { min: number; max: number }
}

export function computeConstellationMetrics(
  params: WalkerParams,
  satMassKg: number,
): ConstellationMetrics {
  const a = R_EARTH_EQUATORIAL + params.altitude
  const periodSec = 2 * Math.PI * Math.sqrt(a * a * a / MU_EARTH_KM)

  return {
    totalMass: params.totalSats * satMassKg,
    totalSatellites: params.totalSats,
    planesCount: params.planes,
    satsPerPlane: Math.floor(params.totalSats / params.planes),
    orbitalPeriodMin: periodSec / 60,
    coverageLatBand: {
      min: -params.inclination,
      max: params.inclination,
    },
  }
}
