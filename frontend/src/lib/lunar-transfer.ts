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
  targetOrbitAltKm = 100,
  numPoints = 80,
): Array<{ x: number; y: number; z: number }> {
  const rPark = (R_EARTH_EQUATORIAL + departureAltKm) / LUNAR_SCENE_SCALE
  const moonDist = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE
  // End at the Earth-facing edge of the orbit ring, not Moon center
  const altRatio = targetOrbitAltKm / R_MOON
  const orbitR = VISUAL_MOON_R * (1 + Math.max(altRatio * 25, 1.2))
  const endX = moonDist - orbitR
  const semiMinor = moonDist * 0.12
  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const x = rPark + (endX - rPark) * t
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
  closestApproachKm: number // actual CA altitude in km, computed from trajectory
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
  const rPark = (R_EARTH_EQUATORIAL + departureAltKm) / LUNAR_SCENE_SCALE
  const moonX = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE

  const caRatio = closestApproachKm / R_MOON
  const flybyR = VISUAL_MOON_R * (1 + Math.max(caRatio * 20, 0.8))

  // === Single cubic Bézier from Earth to past Moon ===
  // P1.z negative (approach from below E-M line), P2.z positive (depart above)
  // creates visible S-curve deflection. P2.x past moonX ensures far-side pass.
  const P0x = rPark, P0z = 0
  const P1x = moonX * 0.45, P1z = -moonX * 0.15
  const P2x = moonX * 1.05, P2z = moonX * 0.15
  const P3x = moonX + 0.4, P3z = moonX * 0.25

  // Generate all points on one Bézier
  const allPoints: Vec3[] = []
  const moonDists: number[] = []
  let minDist = Infinity
  let minIdx = 0

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const mt = 1 - t
    const x = mt*mt*mt*P0x + 3*mt*mt*t*P1x + 3*mt*t*t*P2x + t*t*t*P3x
    const z = mt*mt*mt*P0z + 3*mt*mt*t*P1z + 3*mt*t*t*P2z + t*t*t*P3z
    const pt: Vec3 = { x, y: 0, z }
    allPoints.push(pt)
    const d = Math.sqrt((x - moonX) ** 2 + z * z)
    moonDists.push(d)
    if (d < minDist) { minDist = d; minIdx = i }
  }

  const closestApproach: Vec3 = { ...allPoints[minIdx] }

  // Split into approach / nearMoon / departure by proximity to Moon
  const nearThreshold = flybyR * 4
  const approach: Vec3[] = []
  const nearMoon: Vec3[] = []
  const departure: Vec3[] = []

  let phase: 'approach' | 'near' | 'depart' = 'approach'
  for (let i = 0; i <= numPoints; i++) {
    const pt = allPoints[i]
    const d = moonDists[i]

    if (phase === 'approach') {
      if (d <= nearThreshold && i > 0) {
        phase = 'near'
        nearMoon.push(pt)
      } else {
        approach.push(pt)
      }
    } else if (phase === 'near') {
      if (d > nearThreshold && i > minIdx) {
        phase = 'depart'
        departure.push(pt)
      } else {
        nearMoon.push(pt)
      }
    } else {
      departure.push(pt)
    }
  }

  // Ensure no empty arrays (fallback: put everything in approach)
  if (nearMoon.length === 0) {
    nearMoon.push(allPoints[minIdx])
  }
  if (departure.length === 0) {
    departure.push(allPoints[allPoints.length - 1])
  }

  const caDistKm = Math.max(0, minDist * LUNAR_SCENE_SCALE - R_MOON)
  return { approach, nearMoon, departure, closestApproach, closestApproachKm: caDistKm, earthReturn: null }
}

/**
 * Generate free-return figure-8 trajectory with phase-segmented output.
 * Uses LUNAR_SCENE_SCALE for positions; original parametric shape for correct figure-8.
 */
export function generateFreeReturnTrajectory(
  departureAltKm: number,
  numPoints = 160,
): PhasedTrajectory {
  const rPark = (R_EARTH_EQUATORIAL + departureAltKm) / LUNAR_SCENE_SCALE
  const moonX = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE
  const caRatio = 150 / R_MOON
  const swingbyR = VISUAL_MOON_R * (1 + Math.max(caRatio * 20, 0.8))

  const approach: Vec3[] = []
  const nearMoon: Vec3[] = []
  const departure: Vec3[] = []

  // Bulge: how far the trajectory curves away from the E-M line
  const bulge = moonX * 0.18

  // === Phase 1: Outbound (Earth → Moon vicinity) ===
  // z = bulge * sin(1.5π * t): starts at 0, peaks +bulge at t≈0.33, crosses 0 at t≈0.67, ends at -bulge
  const outboundN = Math.floor(numPoints * 0.37)
  for (let i = 0; i <= outboundN; i++) {
    const t = i / outboundN
    const x = rPark + (moonX - rPark) * t
    const z = bulge * Math.sin(1.5 * Math.PI * t)
    approach.push({ x, y: 0, z })
  }

  // === Phase 2: Swing-by around far side of Moon ===
  // Connects outbound endpoint (z ≈ -bulge) to return startpoint (z ≈ +bulge)
  // Must go BEHIND the Moon (past moonX) — the loop extends beyond lunar distance
  const swingN = Math.floor(numPoints * 0.15)
  const outEnd = approach[approach.length - 1]

  // Start angle: from Moon center to outbound endpoint
  const startAngle = Math.atan2(outEnd.z, outEnd.x - moonX)
  // End angle: mirror across x-axis (return departs from +z side)
  const endAngle = -startAngle

  // We need to sweep through the FAR side of Moon (angle = 0 from Moon = +x direction)
  // startAngle should be negative (outbound arrives below E-M line, z < 0)
  // endAngle should be positive (return departs above E-M line, z > 0)
  // So we sweep counterclockwise: negative angle → 0 (far side) → positive angle
  let totalSweep = endAngle - startAngle
  // If sweep is negative, add 2π to go the long way (counterclockwise through far side)
  if (totalSweep < 0) totalSweep += 2 * Math.PI
  // If sweep is greater than 1.5π, we're going the wrong way (through near side)
  if (totalSweep > Math.PI * 1.5) totalSweep -= 2 * Math.PI

  nearMoon.push({ ...outEnd })
  let closestApproach: Vec3 | null = null
  let minDist = Infinity

  // Constant radius = distance of outbound endpoint from Moon center
  // No interpolation, no dip — every point at the same distance
  const swingRadius = Math.sqrt((outEnd.x - moonX) ** 2 + outEnd.z ** 2)

  for (let i = 1; i <= swingN; i++) {
    const t = i / swingN
    const angle = startAngle + t * totalSweep

    const pt: Vec3 = {
      x: moonX + swingRadius * Math.cos(angle),
      y: 0,
      z: swingRadius * Math.sin(angle),
    }
    nearMoon.push(pt)
    const dist = Math.sqrt((pt.x - moonX) ** 2 + pt.z ** 2)
    if (dist < minDist) {
      minDist = dist
      closestApproach = { ...pt }
    }
  }

  // Validation: flag if any swing-by point is on the Earth-facing side of Moon
  for (const pt of nearMoon) {
    if (pt.x < moonX) {
      console.warn('SWING-BY DIP DETECTED: point.x < moonX', pt)
    }
  }

  // === Phase 3: Return (Moon vicinity → Earth) ===
  // z = -bulge * sin(1.5π * (1-t)): starts at +bulge, crosses 0 at t≈0.33, ends at 0
  const returnN = numPoints - outboundN - swingN
  const swingEnd = nearMoon[nearMoon.length - 1]
  departure.push({ ...swingEnd })

  const earthX = 0.02
  const earthZ = -0.01

  for (let i = 1; i <= returnN; i++) {
    const t = i / returnN
    const x = swingEnd.x + (earthX - swingEnd.x) * t
    // Mirror of outbound: z = -bulge * sin(1.5π * (1-t))
    const pureZ = -bulge * Math.sin(1.5 * Math.PI * (1 - t))
    // Blend from swing-by endpoint over first 10%
    const blend = Math.min(t * 10, 1)
    const z = (1 - blend) * swingEnd.z + blend * pureZ
    departure.push({ x, y: 0, z })
  }

  const earthReturn = departure[departure.length - 1]
  const caDistKm = closestApproach
    ? Math.max(0, Math.sqrt((closestApproach.x - moonX) ** 2 + closestApproach.z ** 2) * LUNAR_SCENE_SCALE - R_MOON)
    : 0
  return { approach, nearMoon, departure, closestApproach, closestApproachKm: caDistKm, earthReturn }
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
