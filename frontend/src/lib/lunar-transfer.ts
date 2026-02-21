/**
 * Lunar transfer mission analysis
 * TLI/LOI computation, transfer time, propellant mass, phase angles
 */

import {
  MU_MOON, R_MOON, MOON_SEMI_MAJOR_AXIS, MOON_ORBITAL_PERIOD_S,
} from './beyond-leo-constants'
import { MU_EARTH_KM, R_EARTH_EQUATORIAL, C_LIGHT } from './constants'
import type { LunarParams, LunarResult, LunarTransferType } from '@/types/beyond-leo'

const G0 = 9.80665e-3 // km/s² standard gravity (for Tsiolkovsky with Isp in seconds)

/**
 * TLI ΔV from circular parking orbit to transfer ellipse with apogee at lunar distance
 * Uses vis-viva equation
 */
export function computeTLIDeltaV(departureAltKm: number): number {
  const rPark = R_EARTH_EQUATORIAL + departureAltKm // km
  const rMoon = MOON_SEMI_MAJOR_AXIS // km — apogee of transfer ellipse

  // Circular velocity at parking orbit
  const vCirc = Math.sqrt(MU_EARTH_KM / rPark) // km/s

  // Transfer ellipse SMA
  const sma = (rPark + rMoon) / 2

  // Velocity at perigee of transfer ellipse (vis-viva)
  const vTransfer = Math.sqrt(MU_EARTH_KM * (2 / rPark - 1 / sma)) // km/s

  return (vTransfer - vCirc) * 1000 // m/s
}

/**
 * LOI ΔV to circularize into lunar orbit from transfer ellipse
 * Simplified: uses hyperbolic excess at Moon's sphere of influence
 */
export function computeLOIDeltaV(targetAltKm: number): number {
  const rTarget = R_MOON + targetAltKm // km — target lunar orbit radius
  const rPark = R_EARTH_EQUATORIAL + 400 // km — assumed LEO for approach velocity calc

  // Velocity at apogee of transfer ellipse (at Moon's distance from Earth)
  const sma = (rPark + MOON_SEMI_MAJOR_AXIS) / 2
  const vArrival = Math.sqrt(MU_EARTH_KM * (2 / MOON_SEMI_MAJOR_AXIS - 1 / sma)) // km/s

  // Moon's orbital velocity around Earth
  const vMoon = Math.sqrt(MU_EARTH_KM / MOON_SEMI_MAJOR_AXIS) // km/s

  // Relative velocity (v-infinity at Moon) — simplified
  const vInf = Math.abs(vMoon - vArrival) // km/s

  // Hyperbolic approach at Moon → circularize
  const vHyp = Math.sqrt(vInf * vInf + 2 * MU_MOON / rTarget) // km/s at periapsis
  const vCircLunar = Math.sqrt(MU_MOON / rTarget) // km/s circular at target altitude

  return (vHyp - vCircLunar) * 1000 // m/s
}

/**
 * Transfer time based on transfer type
 */
export function computeLunarTransferTime(transferType: LunarTransferType): number {
  switch (transferType) {
    case 'hohmann': return 4.5 // days — Hohmann-like transfer
    case 'low-energy': return 100 // days — WSB/ballistic capture
    case 'gravity-assist': return 14 // days — lunar gravity assist
    default: return 4.5
  }
}

/**
 * Required Earth-Moon phase angle at departure for a Hohmann-like transfer
 */
export function computeLunarPhaseAngle(transferTimeDays: number): number {
  // Moon moves ~13.18°/day in its orbit
  const moonAngularRate = 360 / (MOON_ORBITAL_PERIOD_S / 86400) // deg/day
  // Phase angle = 180° - (angular rate × transfer time)
  // The Moon needs to be ahead by the amount it moves during transfer
  const phaseAngle = 180 - moonAngularRate * transferTimeDays
  return ((phaseAngle % 360) + 360) % 360 // normalize to 0-360
}

/**
 * Propellant mass via Tsiolkovsky rocket equation
 * ΔV = Isp × g₀ × ln(m_wet / m_dry)
 * m_prop = m_dry × (exp(ΔV / (Isp × g₀)) - 1)
 */
export function computePropellantMass(
  totalDeltaVms: number,
  dryMassKg: number,
  ispS: number,
): number {
  const deltaVKms = totalDeltaVms / 1000 // convert m/s to km/s
  const vExhaust = ispS * G0 // km/s
  const massRatio = Math.exp(deltaVKms / vExhaust)
  return dryMassKg * (massRatio - 1)
}

/**
 * Full lunar transfer analysis
 */
export function computeLunarResult(params: LunarParams): LunarResult {
  const {
    missionType, targetOrbitAltKm, transferType,
    departureAltKm, spacecraftMassKg, ispS,
  } = params

  const tliDeltaVms = computeTLIDeltaV(departureAltKm)
  const transferTimeDays = computeLunarTransferTime(transferType)

  let loiDeltaVms: number
  let lunarOrbitPeriodMin: number
  let freeReturnPeriodDays: number

  switch (missionType) {
    case 'orbit':
      loiDeltaVms = computeLOIDeltaV(targetOrbitAltKm)
      lunarOrbitPeriodMin = (2 * Math.PI * Math.sqrt(
        Math.pow(R_MOON + targetOrbitAltKm, 3) / MU_MOON
      )) / 60 // seconds to minutes
      freeReturnPeriodDays = 0
      break

    case 'flyby':
      loiDeltaVms = 0 // no insertion for flyby
      lunarOrbitPeriodMin = 0
      freeReturnPeriodDays = 0
      break

    case 'landing':
      // Landing requires LOI + deorbit + descent
      loiDeltaVms = computeLOIDeltaV(targetOrbitAltKm)
      // Deorbit from low orbit + powered descent: ~1.7 km/s additional
      loiDeltaVms += 1700
      lunarOrbitPeriodMin = 0
      freeReturnPeriodDays = 0
      break

    case 'free-return':
      loiDeltaVms = 0 // no insertion — free-return trajectory
      lunarOrbitPeriodMin = 0
      // Free-return period: roughly 6-8 days total
      freeReturnPeriodDays = transferTimeDays * 2 + 1
      break

    default:
      loiDeltaVms = computeLOIDeltaV(targetOrbitAltKm)
      lunarOrbitPeriodMin = 120
      freeReturnPeriodDays = 0
  }

  const totalDeltaVms = tliDeltaVms + loiDeltaVms
  const propellantRequiredKg = computePropellantMass(totalDeltaVms, spacecraftMassKg, ispS)
  const phaseAngleDeg = computeLunarPhaseAngle(transferTimeDays)
  const commDelayS = MOON_SEMI_MAJOR_AXIS / (C_LIGHT / 1000) // ~1.28 s

  return {
    tliDeltaVms,
    transferTimeDays,
    loiDeltaVms,
    totalDeltaVms,
    lunarOrbitPeriodMin,
    propellantRequiredKg,
    phaseAngleDeg,
    commDelayS,
    freeReturnPeriodDays,
  }
}

/** Scene scale matching LunarScene.tsx — 1 unit ≈ 400,000 km */
const LUNAR_SCENE_SCALE = 400000

/** Visual Moon radius in scene units — matches the enlarged Moon sphere in LunarScene.
 *  The physical radius (R_MOON/400000 = 0.00434) is too small to see,
 *  so LunarScene enlarges it to 0.012 minimum. All near-Moon arcs must
 *  stay outside this visual radius to avoid clipping through the sphere. */
const VISUAL_MOON_R = Math.max(R_MOON / LUNAR_SCENE_SCALE, 0.012)

/**
 * Generate lunar transfer arc for 3D rendering.
 * Uses LUNAR_SCENE_SCALE so coordinates match LunarScene.tsx exactly.
 * Earth at origin, Moon at 384400/400000 ≈ 0.961 on the x-axis.
 *
 * Shape: half-ellipse from parking orbit to Moon distance, curving below
 * the Earth-Moon line. This approximates a Hohmann transfer arc.
 */
export function generateLunarTransferArc(
  departureAltKm: number,
  numPoints = 80,
): Array<{ x: number; y: number; z: number }> {
  const rPark = (R_EARTH_EQUATORIAL + departureAltKm) / LUNAR_SCENE_SCALE
  const moonDist = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE
  const semiMinor = moonDist * 0.12
  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const x = rPark + (moonDist - rPark) * t
    const z = -semiMinor * Math.sin(t * Math.PI)
    points.push({ x, y: 0, z })
  }
  return points
}

type Vec3 = { x: number; y: number; z: number }

/** Phase-segmented trajectory for color-coded rendering */
export interface PhasedTrajectory {
  approach: Vec3[]
  nearMoon: Vec3[]
  departure: Vec3[]
  closestApproach: Vec3 | null
  earthReturn: Vec3 | null // free-return re-entry point
}

/**
 * Generate flyby trajectory with phase-segmented output for color-coded rendering.
 * Uses LUNAR_SCENE_SCALE for positions; visual Moon radius ensures the arc
 * stays outside the enlarged Moon sphere.
 */
export function generateFlybyPath(
  departureAltKm: number,
  closestApproachKm = 200,
  numPoints = 120,
): PhasedTrajectory {
  const moonX = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE
  const caRatio = closestApproachKm / R_MOON
  const flybyR = VISUAL_MOON_R * (1 + Math.max(caRatio * 20, 0.8))
  const approach: Vec3[] = []
  const nearMoon: Vec3[] = []
  const departure: Vec3[] = []

  const approachN = Math.floor(numPoints * 0.5)
  const approachEndX = moonX - flybyR * 2
  const approachCurve = moonX * 0.08
  for (let i = 0; i <= approachN; i++) {
    const t = i / approachN
    approach.push({ x: t * approachEndX, y: 0, z: -approachCurve * Math.sin(t * Math.PI * 0.5) })
  }

  const flybyN = Math.floor(numPoints * 0.25)
  const arcStartAngle = Math.PI * 0.85
  const arcEndAngle = -Math.PI * 0.15
  let closestApproach: Vec3 | null = null
  let minDistFromMoon = Infinity
  nearMoon.push({ ...approach[approach.length - 1] })
  for (let i = 0; i <= flybyN; i++) {
    const t = i / flybyN
    const angle = arcStartAngle + t * (arcEndAngle - arcStartAngle)
    const periapsisFactor = 1 + 1.5 * Math.pow(2 * Math.abs(t - 0.5), 2)
    const dist = flybyR * periapsisFactor
    const pt: Vec3 = { x: moonX + dist * Math.cos(angle), y: 0, z: dist * Math.sin(angle) }
    nearMoon.push(pt)
    if (dist < minDistFromMoon) { minDistFromMoon = dist; closestApproach = { ...pt } }
  }

  const departN = numPoints - approachN - flybyN
  const lastFlyby = nearMoon[nearMoon.length - 1]
  departure.push({ ...lastFlyby })
  const prevPt = nearMoon[nearMoon.length - 2]
  const dirX = lastFlyby.x - prevPt.x
  const dirZ = lastFlyby.z - prevPt.z
  const dirMag = Math.sqrt(dirX * dirX + dirZ * dirZ)
  const normDirX = dirX / dirMag
  const normDirZ = dirZ / dirMag
  for (let i = 1; i <= departN; i++) {
    const t = i / departN
    const dist = t * moonX * 0.5
    departure.push({ x: lastFlyby.x + dist * normDirX, y: 0, z: lastFlyby.z + dist * normDirZ })
  }

  return { approach, nearMoon, departure, closestApproach, earthReturn: null }
}

/**
 * Generate free-return figure-8 trajectory with phase-segmented output.
 * Uses LUNAR_SCENE_SCALE for positions; original parametric shape for correct figure-8.
 */
export function generateFreeReturnTrajectory(
  departureAltKm: number,
  numPoints = 160,
): PhasedTrajectory {
  const moonX = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE
  const caRatio = 150 / R_MOON
  const swingbyR = VISUAL_MOON_R * (1 + Math.max(caRatio * 20, 0.8))
  const approach: Vec3[] = []
  const nearMoon: Vec3[] = []
  const departure: Vec3[] = []
  const loopHeight = moonX * 0.25

  // Pre-compute swing arc endpoints for seamless phase continuity.
  // periFactor at t=0 and t=1 equals 3 (|t-0.5|=0.5 → 1+2*(2*0.5)²=3).
  const swingStartAngle = Math.PI * 0.7
  const swingEndAngle = -Math.PI * 0.7
  const endDist = swingbyR * 3
  const swingStartPt: Vec3 = {
    x: moonX + endDist * Math.cos(swingStartAngle), y: 0,
    z: endDist * Math.sin(swingStartAngle),
  }
  const swingEndPt: Vec3 = {
    x: moonX + endDist * Math.cos(swingEndAngle), y: 0,
    z: endDist * Math.sin(swingEndAngle),
  }

  // ── Outbound: Earth (0,0) → swingStartPt, bulging ABOVE (+z) ──
  const outN = Math.floor(numPoints * 0.38)
  for (let i = 0; i <= outN; i++) {
    const t = i / outN
    const x = t * swingStartPt.x
    const z = swingStartPt.z * t + loopHeight * Math.sin(t * Math.PI)
    approach.push({ x, y: 0, z })
  }

  // ── Swing arc: around far side of Moon ──
  const swingN = Math.floor(numPoints * 0.14)
  nearMoon.push({ ...approach[approach.length - 1] })
  let closestApproach: Vec3 | null = null
  let minDist = Infinity
  for (let i = 1; i <= swingN; i++) {
    const t = i / swingN
    const angle = swingStartAngle + t * (swingEndAngle - swingStartAngle)
    const periFactor = 1 + 2.0 * Math.pow(2 * Math.abs(t - 0.5), 2)
    const dist = swingbyR * periFactor
    const pt: Vec3 = { x: moonX + dist * Math.cos(angle), y: 0, z: dist * Math.sin(angle) }
    nearMoon.push(pt)
    if (dist < minDist) { minDist = dist; closestApproach = { ...pt } }
  }

  // ── Return: swingEndPt → Earth (0,0), bulging BELOW (−z) ──
  const retN = numPoints - outN - swingN
  departure.push({ ...nearMoon[nearMoon.length - 1] })
  for (let i = 1; i <= retN; i++) {
    const t = i / retN
    const x = swingEndPt.x * (1 - t)
    const z = swingEndPt.z * (1 - t) - loopHeight * Math.sin(t * Math.PI)
    departure.push({ x, y: 0, z })
  }

  const earthReturn = departure[departure.length - 1]
  return { approach, nearMoon, departure, closestApproach, earthReturn }
}

/**
 * Generate descent path from lunar orbit to Moon surface for landing missions.
 * Uses LUNAR_SCENE_SCALE so coordinates match LunarScene.tsx exactly.
 */
export function generateDescentPath(
  targetOrbitAltKm: number,
  numPoints = 40,
): Vec3[] {
  const moonX = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE
  const moonR = R_MOON / LUNAR_SCENE_SCALE
  const orbitR = (R_MOON + targetOrbitAltKm) / LUNAR_SCENE_SCALE

  const points: Vec3[] = []

  // Deorbit + descent: spiral from orbit radius down to surface
  // 1.5 revolutions while descending
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const angle = t * Math.PI * 3
    const r = orbitR - t * (orbitR - moonR)
    points.push({
      x: moonX + r * Math.cos(angle),
      y: 0,
      z: r * Math.sin(angle),
    })
  }

  return points
}

/**
 * Get the landing marker position — end of the descent spiral on the Moon's surface
 */
export function getLandingMarkerPosition(targetOrbitAltKm: number): Vec3 {
  const pts = generateDescentPath(targetOrbitAltKm)
  return pts[pts.length - 1]
}

/**
 * Generate altitude profile for charts
 * Distance from Earth center (km) vs time (days)
 */
export function generateAltitudeProfile(
  params: LunarParams,
  numPoints = 60,
): Array<{ day: number; distanceKm: number }> {
  const result = computeLunarResult(params)
  const parkAlt = R_EARTH_EQUATORIAL + params.departureAltKm
  const totalDays = result.transferTimeDays

  const points: Array<{ day: number; distanceKm: number }> = []

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const day = t * totalDays

    // Transfer follows approximately: r(t) = a(1 - e×cos(E))
    // Simplify as smooth S-curve from LEO to Moon distance
    const progress = 0.5 - 0.5 * Math.cos(t * Math.PI)
    const distanceKm = parkAlt + progress * (MOON_SEMI_MAJOR_AXIS - parkAlt)

    points.push({ day, distanceKm })
  }
  return points
}
