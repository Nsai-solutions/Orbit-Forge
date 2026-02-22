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

/* ── Patched-conic helpers (private) ────────────────────────────── */

/** Moon Hill-sphere radius (km) — boundary between Earth-dominated and Moon-dominated gravity */
const MOON_SOI_KM = 66000

/** Moon x-position in scene units */
const MOON_X_SCENE = MOON_SEMI_MAJOR_AXIS / LUNAR_SCENE_SCALE

/** Conic equation: orbital radius at true anomaly ν */
function keplerRadius(nu: number, p: number, e: number): number {
  return p / (1 + e * Math.cos(nu))
}

/** Transfer ellipse orbital elements from departure altitude */
function computeTransferElements(departureAltKm: number) {
  const rPark = R_EARTH_EQUATORIAL + departureAltKm
  const sma = (rPark + MOON_SEMI_MAJOR_AXIS) / 2
  const e = 1 - rPark / sma
  const p = sma * (1 - e * e)
  return { rPark, sma, e, p }
}

/** Perifocal-to-scene coordinate transform with argument of perigee rotation.
 *  omegaRot = π places perigee at −x (near Earth) and apogee at +x (toward Moon). */
function transferToScene(nu: number, r: number, omegaRot: number): Vec3 {
  const xP = r * Math.cos(nu)
  const zP = r * Math.sin(nu)
  return {
    x: (xP * Math.cos(omegaRot) - zP * Math.sin(omegaRot)) / LUNAR_SCENE_SCALE,
    y: 0,
    z: (xP * Math.sin(omegaRot) + zP * Math.cos(omegaRot)) / LUNAR_SCENE_SCALE,
  }
}

/** Rotate Moon-centred hyperbola coordinates by θ_rot and translate to scene space. */
function hyperbolaToScene(xH: number, zH: number, thetaRot: number): Vec3 {
  const xRot = xH * Math.cos(thetaRot) - zH * Math.sin(thetaRot)
  const zRot = xH * Math.sin(thetaRot) + zH * Math.cos(thetaRot)
  return {
    x: MOON_X_SCENE + xRot / LUNAR_SCENE_SCALE,
    y: 0,
    z: zRot / LUNAR_SCENE_SCALE,
  }
}

/* ── RK4 numerical propagator ────────────────────────────────── */

/** Visual Moon radius in scene units (matches LunarScene.tsx) */
const VISUAL_MOON_R = Math.max(R_MOON / LUNAR_SCENE_SCALE, 0.012)

/** Gravitational acceleration from Earth + Moon at position (x, z) in km */
function accel(x: number, z: number): { ax: number; az: number } {
  const rE = Math.sqrt(x * x + z * z)
  const rM = Math.sqrt((x - MOON_SEMI_MAJOR_AXIS) ** 2 + z * z)
  return {
    ax: -MU_EARTH_KM * x / (rE ** 3) - MU_MOON * (x - MOON_SEMI_MAJOR_AXIS) / (rM ** 3),
    az: -MU_EARTH_KM * z / (rE ** 3) - MU_MOON * z / (rM ** 3),
  }
}

/** Single RK4 integration step */
function rk4Step(
  x: number, z: number, vx: number, vz: number, dt: number
): { x: number; z: number; vx: number; vz: number } {
  function deriv(x: number, z: number, vx: number, vz: number) {
    const a = accel(x, z)
    return { dx: vx, dz: vz, dvx: a.ax, dvz: a.az }
  }
  const k1 = deriv(x, z, vx, vz)
  const k2 = deriv(x + k1.dx * dt / 2, z + k1.dz * dt / 2,
                    vx + k1.dvx * dt / 2, vz + k1.dvz * dt / 2)
  const k3 = deriv(x + k2.dx * dt / 2, z + k2.dz * dt / 2,
                    vx + k2.dvx * dt / 2, vz + k2.dvz * dt / 2)
  const k4 = deriv(x + k3.dx * dt, z + k3.dz * dt,
                    vx + k3.dvx * dt, vz + k3.dvz * dt)
  return {
    x:  x  + dt / 6 * (k1.dx  + 2 * k2.dx  + 2 * k3.dx  + k4.dx),
    z:  z  + dt / 6 * (k1.dz  + 2 * k2.dz  + 2 * k3.dz  + k4.dz),
    vx: vx + dt / 6 * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
    vz: vz + dt / 6 * (k1.dvz + 2 * k2.dvz + 2 * k3.dvz + k4.dvz),
  }
}

/**
 * Propagate a trajectory from LEO departure under Earth+Moon gravity.
 * Returns scene-coordinate points sampled at regular intervals.
 * Tracks closest approach at every integration step for accuracy.
 */
function propagateTrajectory(
  departureAltKm: number,
  vzAdjust: number,
  maxDays: number,
  dt = 30,
  sampleInterval = 200,
  stopOnEarthReturn = false,
): { points: Vec3[]; closestApproachKm: number; closestApproachIdx: number; closestApproachPoint: Vec3 } {
  const r0 = R_EARTH_EQUATORIAL + departureAltKm
  const sma = (r0 + MOON_SEMI_MAJOR_AXIS) / 2
  const vTLI = Math.sqrt(MU_EARTH_KM * (2 / r0 - 1 / sma))

  // Start at perigee: position (-r0, 0), velocity (0, -(vTLI + adjust))
  // This launches clockwise with apogee toward +x (Moon direction)
  let x = -r0, z = 0
  let vx = 0, vz = -(vTLI + vzAdjust)

  const points: Vec3[] = []
  let closestMoonDist = Infinity
  let closestApproachIdx = 0
  let closestApproachPoint: Vec3 = { x: 0, y: 0, z: 0 }

  const maxSteps = Math.floor(maxDays * 86400 / dt)
  for (let step = 0; step <= maxSteps; step++) {
    const rMoon = Math.sqrt((x - MOON_SEMI_MAJOR_AXIS) ** 2 + z * z)

    // Track closest approach at EVERY step (not just sample points)
    if (rMoon < closestMoonDist) {
      closestMoonDist = rMoon
      closestApproachPoint = { x: x / LUNAR_SCENE_SCALE, y: 0, z: z / LUNAR_SCENE_SCALE }
      closestApproachIdx = points.length
    }

    // Record output point at sample interval
    if (step % sampleInterval === 0) {
      points.push({ x: x / LUNAR_SCENE_SCALE, y: 0, z: z / LUNAR_SCENE_SCALE })
    }

    if (rMoon < R_MOON || Math.sqrt(x * x + z * z) < R_EARTH_EQUATORIAL) break

    // Stop on Earth return (for free-return trajectories)
    if (stopOnEarthReturn && step > maxSteps / 3) {
      const rEarth = Math.sqrt(x * x + z * z)
      if (rEarth < (R_EARTH_EQUATORIAL + departureAltKm * 3)) break
    }

    const next = rk4Step(x, z, vx, vz, dt)
    x = next.x; z = next.z; vx = next.vx; vz = next.vz
  }

  return {
    points,
    closestApproachKm: Math.max(0, closestMoonDist - R_MOON),
    closestApproachIdx: Math.min(closestApproachIdx, points.length - 1),
    closestApproachPoint,
  }
}

/**
 * Find the velocity adjustment that achieves a target closest approach.
 * Uses bisection search on the vz offset from Hohmann velocity.
 * More negative vzAdj = faster TLI = closer approach to Moon.
 * Monotonic region: [0, -0.003] km/s where CA decreases smoothly from ~2384 km to ~0.
 */
function findVzForCA(departureAltKm: number, targetCAKm: number, maxDays: number): number {
  // Monotonic region only: 0 (Hohmann, ~2384 km CA) to -3 m/s (very close/crash)
  // Beyond -3 m/s the spacecraft overshoots the Moon and CA increases again (non-monotonic)
  let lo = 0        // far side — Hohmann, CA ≈ 2384 km
  let hi = -0.003   // close side — ~3 m/s faster, near-crash

  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2
    // Large sampleInterval — we only need closestApproachKm, not trajectory points
    const result = propagateTrajectory(departureAltKm, mid, maxDays, 30, 10000)
    if (result.closestApproachKm < targetCAKm) {
      // Too close or crash → need less speed → move toward 0 (slower)
      hi = mid
    } else {
      // Too far → need more speed → move toward -0.003 (faster)
      lo = mid
    }
  }
  return (lo + hi) / 2
}

/**
 * Generate lunar transfer arc for 3D rendering.
 * RK4 numerical propagation under Earth+Moon gravity.
 * Earth at origin, Moon at ~0.961 on the x-axis.
 */
export function generateLunarTransferArc(
  departureAltKm: number,
  targetOrbitAltKm = 100,
  numPoints = 120,
): Vec3[] {
  // Propagate with Hohmann velocity (no CA targeting needed — just reach Moon)
  const result = propagateTrajectory(departureAltKm, 0, 5, 30,
    Math.max(1, Math.floor(5 * 86400 / 30 / numPoints)))

  // Stop when within the visual orbit ring radius
  // Must match LunarScene.tsx formula: orbitR = visualMoonR * (1 + max(altRatio * 25, 1.2))
  const altRatio = targetOrbitAltKm / R_MOON
  const orbitRingScene = VISUAL_MOON_R * (1 + Math.max(altRatio * 25, 1.2))
  const stopDist = orbitRingScene * 1.05  // stop just outside the ring

  let endIdx = result.points.length
  for (let i = Math.floor(result.points.length / 2); i < result.points.length; i++) {
    const dx = result.points[i].x - MOON_X_SCENE
    const dz = result.points[i].z
    if (Math.sqrt(dx * dx + dz * dz) < stopDist) {
      endIdx = i + 1
      break
    }
  }
  return result.points.slice(0, endIdx)
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
 * RK4 numerical propagation under Earth+Moon gravity — one continuous curve.
 */
export function generateFlybyPath(
  departureAltKm: number,
  closestApproachKm = 200,
  numPoints = 120,
): PhasedTrajectory {
  // Find velocity that gives target CA
  const vzAdj = findVzForCA(departureAltKm, closestApproachKm, 7)

  // Propagate full trajectory
  const sampleEvery = Math.max(1, Math.floor(7 * 86400 / 30 / (numPoints * 1.5)))
  const result = propagateTrajectory(departureAltKm, vzAdj, 7, 30, sampleEvery)
  const pts = result.points
  const caIdx = result.closestApproachIdx

  // Split into 3 phases based on Moon distance
  // Phase 1 (approach): start → enters Moon SOI (66,000 km)
  // Phase 2 (nearMoon): within SOI
  // Phase 3 (departure): exits SOI → end
  const soiScene = MOON_SOI_KM / LUNAR_SCENE_SCALE

  let soiEntryIdx = 0
  let soiExitIdx = pts.length - 1

  for (let i = 0; i < caIdx; i++) {
    const d = Math.sqrt((pts[i].x - MOON_X_SCENE) ** 2 + pts[i].z ** 2)
    if (d < soiScene) { soiEntryIdx = i; break }
  }
  for (let i = pts.length - 1; i > caIdx; i--) {
    const d = Math.sqrt((pts[i].x - MOON_X_SCENE) ** 2 + pts[i].z ** 2)
    if (d < soiScene) { soiExitIdx = i; break }
  }

  return {
    approach: pts.slice(0, soiEntryIdx + 1),
    nearMoon: pts.slice(soiEntryIdx, soiExitIdx + 1),
    departure: pts.slice(soiExitIdx),
    closestApproach: result.closestApproachPoint,
    closestApproachKm: result.closestApproachKm,
    earthReturn: null,
  }
}

/**
 * Generate free-return figure-8 trajectory with phase-segmented output.
 * RK4 numerical propagation — one continuous curve that returns to Earth.
 */
export function generateFreeReturnTrajectory(
  departureAltKm: number,
  numPoints = 160,
): PhasedTrajectory {
  const closestApproachKm = 250

  // Find velocity for 250 km CA
  const vzAdj = findVzForCA(departureAltKm, closestApproachKm, 12)

  // Propagate for ~12 days (enough for return), stop when returning near Earth
  const sampleEvery = Math.max(1, Math.floor(12 * 86400 / 30 / (numPoints * 1.5)))
  const result = propagateTrajectory(departureAltKm, vzAdj, 12, 30, sampleEvery, true)
  const pts = result.points
  const caIdx = result.closestApproachIdx

  // Split phases
  const soiScene = MOON_SOI_KM / LUNAR_SCENE_SCALE

  let soiEntryIdx = 0
  let soiExitIdx = pts.length - 1

  for (let i = 0; i < caIdx; i++) {
    const d = Math.sqrt((pts[i].x - MOON_X_SCENE) ** 2 + pts[i].z ** 2)
    if (d < soiScene) { soiEntryIdx = i; break }
  }
  for (let i = pts.length - 1; i > caIdx; i--) {
    const d = Math.sqrt((pts[i].x - MOON_X_SCENE) ** 2 + pts[i].z ** 2)
    if (d < soiScene) { soiExitIdx = i; break }
  }

  // For free-return: the departure is everything after SOI exit (return to Earth)
  const earthReturn = pts[pts.length - 1]

  return {
    approach: pts.slice(0, soiEntryIdx + 1),
    nearMoon: pts.slice(soiEntryIdx, soiExitIdx + 1),
    departure: pts.slice(soiExitIdx),
    closestApproach: result.closestApproachPoint,
    closestApproachKm: result.closestApproachKm,
    earthReturn,
  }
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
