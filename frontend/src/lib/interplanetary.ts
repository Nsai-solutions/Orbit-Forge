/**
 * Interplanetary transfer analysis
 * Hohmann transfers, Lambert solver, porkchop plots
 */

import {
  MU_SUN, AU_KM, PLANET_DATA, EARTH_ORBITAL_DATA,
} from './beyond-leo-constants'
import { MU_EARTH_KM, R_EARTH_EQUATORIAL, C_LIGHT } from './constants'
import type {
  TargetBody, InterplanetaryParams, InterplanetaryResult, PorkchopPoint,
} from '@/types/beyond-leo'

/**
 * Compute Hohmann transfer between circular coplanar orbits
 * Returns C3, v-infinity at departure and arrival, transfer time
 */
export function computeHohmannInterplanetary(target: TargetBody): {
  c3: number
  vInfDepart: number
  vInfArrive: number
  transferTimeDays: number
} {
  const planet = PLANET_DATA[target]
  const r1 = EARTH_ORBITAL_DATA.semiMajorAxisKm // km (Earth orbit)
  const r2 = planet.semiMajorAxisKm // km (target orbit)

  // Hohmann transfer SMA
  const aTransfer = (r1 + r2) / 2 // km

  // Transfer orbit velocities at departure and arrival (vis-viva)
  const vTransferDep = Math.sqrt(MU_SUN * (2 / r1 - 1 / aTransfer)) // km/s at Earth orbit
  const vTransferArr = Math.sqrt(MU_SUN * (2 / r2 - 1 / aTransfer)) // km/s at target orbit

  // Circular orbital velocities
  const vEarth = Math.sqrt(MU_SUN / r1) // km/s
  const vTarget = Math.sqrt(MU_SUN / r2) // km/s

  // V-infinity at Earth departure
  const vInfDepart = Math.abs(vTransferDep - vEarth) // km/s

  // V-infinity at target arrival
  const vInfArrive = Math.abs(vTarget - vTransferArr) // km/s

  // C3 = V_inf² (characteristic energy)
  const c3 = vInfDepart * vInfDepart // km²/s²

  // Transfer time (half period of transfer ellipse)
  const transferTimeS = Math.PI * Math.sqrt(aTransfer * aTransfer * aTransfer / MU_SUN)
  const transferTimeDays = transferTimeS / 86400

  return { c3, vInfDepart, vInfArrive, transferTimeDays }
}

/**
 * Departure ΔV from parking orbit given v-infinity
 * Hyperbolic departure: v_depart = sqrt(v_inf² + 2μ/r)
 * ΔV = v_depart - v_circular
 */
export function computeDepartureDeltaV(departureAltKm: number, vInfKms: number): number {
  const rPark = R_EARTH_EQUATORIAL + departureAltKm // km
  const vCirc = Math.sqrt(MU_EARTH_KM / rPark) // km/s
  const vDepart = Math.sqrt(vInfKms * vInfKms + 2 * MU_EARTH_KM / rPark) // km/s
  return (vDepart - vCirc) * 1000 // m/s
}

/**
 * Arrival orbit insertion ΔV at target planet — circular orbit
 * Hyperbolic arrival: v_arrival = sqrt(v_inf² + 2μ/r)
 * ΔV = v_arrival - v_circular
 */
export function computeArrivalInsertionDeltaV(
  target: TargetBody,
  arrivalAltKm: number,
  vInfKms: number,
): number {
  const planet = PLANET_DATA[target]
  const rTarget = planet.radiusKm + arrivalAltKm // km
  const vCirc = Math.sqrt(planet.mu / rTarget) // km/s
  const vArrival = Math.sqrt(vInfKms * vInfKms + 2 * planet.mu / rTarget) // km/s
  return (vArrival - vCirc) * 1000 // m/s
}

/**
 * Arrival orbit insertion ΔV — elliptical capture orbit
 * Burns at periapsis to capture into an elliptical orbit with given apoapsis
 * Much lower DV than circular for gas giants
 */
export function computeEllipticalCaptureInsertionDeltaV(
  target: TargetBody,
  periapsisAltKm: number,
  captureApoFactor: number, // apoapsis as multiple of body radius
  vInfKms: number,
): number {
  const planet = PLANET_DATA[target]
  const rPeri = planet.radiusKm + periapsisAltKm  // periapsis radius
  const rApo = planet.radiusKm * captureApoFactor // apoapsis radius
  const aEllip = (rPeri + rApo) / 2               // semi-major axis

  const vHypPeri = Math.sqrt(vInfKms * vInfKms + 2 * planet.mu / rPeri) // hyperbolic periapsis velocity
  const vPeriEllip = Math.sqrt(planet.mu * (2 / rPeri - 1 / aEllip))    // elliptical orbit periapsis velocity

  return (vHypPeri - vPeriEllip) * 1000 // m/s
}

/**
 * One-way communication delay
 */
export function computeCommsDelay(distanceKm: number): number {
  return distanceKm / (C_LIGHT / 1000) // seconds
}

/**
 * Compute planet heliocentric position (simplified circular orbit)
 * Returns position in km in the ecliptic plane
 * Uses mean anomaly from J2000 epoch
 */
export function computePlanetPosition(
  target: TargetBody,
  date: Date,
): { x: number; y: number; z: number } {
  const planet = PLANET_DATA[target]
  const j2000 = new Date('2000-01-01T12:00:00Z')
  const daysSinceJ2000 = (date.getTime() - j2000.getTime()) / 86400000

  // Mean anomaly (simplified — circular orbit assumption)
  const meanMotion = 360 / planet.orbitalPeriodDays // deg/day
  const meanAnomaly = (meanMotion * daysSinceJ2000) % 360
  const angleRad = (meanAnomaly * Math.PI) / 180

  const r = planet.semiMajorAxisKm
  return {
    x: r * Math.cos(angleRad),
    y: 0, // ecliptic plane
    z: r * Math.sin(angleRad),
  }
}

/**
 * Compute Earth heliocentric position
 */
export function computeEarthPosition(date: Date): { x: number; y: number; z: number } {
  const j2000 = new Date('2000-01-01T12:00:00Z')
  const daysSinceJ2000 = (date.getTime() - j2000.getTime()) / 86400000
  const meanMotion = 360 / EARTH_ORBITAL_DATA.orbitalPeriodDays
  const meanAnomaly = (meanMotion * daysSinceJ2000) % 360
  const angleRad = (meanAnomaly * Math.PI) / 180
  const r = EARTH_ORBITAL_DATA.semiMajorAxisKm
  return {
    x: r * Math.cos(angleRad),
    y: 0,
    z: r * Math.sin(angleRad),
  }
}

/**
 * Simplified Lambert solver using universal variable method
 * Solves the two-body boundary value problem:
 * Given r1, r2, and time of flight, find v1, v2
 *
 * Uses Battin's method (simplified implementation)
 * Returns null if no solution found
 */
export function solveLambert(
  r1: { x: number; y: number; z: number },
  r2: { x: number; y: number; z: number },
  tofS: number,
  mu: number,
  shortWay = true,
): { vDepart: { x: number; y: number; z: number }; vArrive: { x: number; y: number; z: number } } | null {
  const r1Mag = Math.sqrt(r1.x * r1.x + r1.y * r1.y + r1.z * r1.z)
  const r2Mag = Math.sqrt(r2.x * r2.x + r2.y * r2.y + r2.z * r2.z)

  // Cross product for transfer angle
  const cross = r1.x * r2.z - r1.z * r2.x // simplified 2D cross (y=0)
  const cosNu = (r1.x * r2.x + r1.y * r2.y + r1.z * r2.z) / (r1Mag * r2Mag)
  const sinNu = shortWay
    ? Math.sqrt(Math.max(0, 1 - cosNu * cosNu)) * (cross >= 0 ? 1 : -1)
    : -Math.sqrt(Math.max(0, 1 - cosNu * cosNu)) * (cross >= 0 ? 1 : -1)

  // Direction-of-motion multiplier: A must be negative when the transfer
  // angle > 180° (cross product negative for prograde short-way transfers)
  const dm = shortWay ? (cross >= 0 ? 1 : -1) : (cross >= 0 ? -1 : 1)
  const A = dm * Math.sqrt(r1Mag * r2Mag * (1 + cosNu))
  if (Math.abs(A) < 1e-10) return null

  // Stumpff functions and universal variable iteration
  // Start at z = 0 (parabolic); the finite-difference derivative converges reliably from here
  let z = 0
  const maxIter = 100
  const tol = 1e-8
  const sqrtMu = Math.sqrt(mu)

  for (let iter = 0; iter < maxIter; iter++) {
    const { c2, c3 } = stumpff(z)

    const y = r1Mag + r2Mag + A * (z * c3 - 1) / Math.sqrt(c2)

    if (y < 0) {
      z += 0.5
      continue
    }

    const x = Math.sqrt(y / c2)
    const tCalc = (x * x * x * c3 + A * Math.sqrt(y)) / sqrtMu

    const err = tCalc - tofS
    if (Math.abs(err) < tol) {
      // Solution found — compute velocities via Lagrange coefficients
      const f = 1 - y / r1Mag
      const gDot = 1 - y / r2Mag
      const g = A * Math.sqrt(y / mu)

      const v1 = {
        x: (r2.x - f * r1.x) / g,
        y: (r2.y - f * r1.y) / g,
        z: (r2.z - f * r1.z) / g,
      }
      const v2 = {
        x: (gDot * r2.x - r1.x) / g,
        y: (gDot * r2.y - r1.y) / g,
        z: (gDot * r2.z - r1.z) / g,
      }

      return { vDepart: v1, vArrive: v2 }
    }

    // dT/dz via finite difference — robust for all z values
    const dz = 1e-4
    const zPlus = z + dz
    const { c2: c2p, c3: c3p } = stumpff(zPlus)
    const yPlus = r1Mag + r2Mag + A * (zPlus * c3p - 1) / Math.sqrt(c2p)
    if (yPlus < 0) {
      z += 0.5
      continue
    }
    const xPlus = Math.sqrt(yPlus / c2p)
    const tPlus = (xPlus * xPlus * xPlus * c3p + A * Math.sqrt(yPlus)) / sqrtMu
    const dTdz = (tPlus - tCalc) / dz

    if (Math.abs(dTdz) < 1e-30) {
      z += 0.1
      continue
    }

    const step = err / dTdz
    // Limit Newton step to prevent wild jumps
    const maxStep = 5
    z -= Math.max(-maxStep, Math.min(step, maxStep))
    // Clamp z to reasonable range for single-revolution transfers
    z = Math.max(-50, Math.min(z, 200))
  }

  return null // failed to converge
}

function stumpff(z: number): { c2: number; c3: number } {
  if (z > 1e-6) {
    const sqrtZ = Math.sqrt(z)
    return {
      c2: (1 - Math.cos(sqrtZ)) / z,
      c3: (sqrtZ - Math.sin(sqrtZ)) / Math.pow(z, 1.5),
    }
  } else if (z < -1e-6) {
    const sqrtNZ = Math.sqrt(-z)
    return {
      c2: (1 - Math.cosh(sqrtNZ)) / z,
      c3: (Math.sinh(sqrtNZ) - sqrtNZ) / Math.pow(-z, 1.5),
    }
  }
  return { c2: 1 / 2, c3: 1 / 6 }
}

/**
 * Compute porkchop plot data grid
 * Returns C3 values for a grid of departure dates × flight times
 */
export function computePorkchopGrid(
  target: TargetBody,
  startDate: Date,
  departureDayRange: number,
  nDepartureSamples: number,
  minFlightDays: number,
  maxFlightDays: number,
  nFlightSamples: number,
): PorkchopPoint[] {
  const points: PorkchopPoint[] = []

  for (let i = 0; i < nDepartureSamples; i++) {
    const depDOY = (i / (nDepartureSamples - 1)) * departureDayRange
    const depDate = new Date(startDate.getTime() + depDOY * 86400000)

    const r1 = computeEarthPosition(depDate)

    for (let j = 0; j < nFlightSamples; j++) {
      const flightDays = minFlightDays + (j / (nFlightSamples - 1)) * (maxFlightDays - minFlightDays)
      const arrDate = new Date(depDate.getTime() + flightDays * 86400000)

      const r2 = computePlanetPosition(target, arrDate)
      const tofS = flightDays * 86400

      const result = solveLambert(r1, r2, tofS, MU_SUN)
      if (result) {
        // V-infinity at Earth
        const vEarth = computeEarthPosition(depDate)
        const vEarthOrb = Math.sqrt(MU_SUN / Math.sqrt(vEarth.x * vEarth.x + vEarth.z * vEarth.z))

        // Earth's velocity direction (perpendicular to radial in ecliptic)
        const rE = Math.sqrt(r1.x * r1.x + r1.z * r1.z)
        const vEx = -vEarthOrb * r1.z / rE
        const vEz = vEarthOrb * r1.x / rE

        const dvx = result.vDepart.x - vEx
        const dvz = result.vDepart.z - vEz
        const vInf = Math.sqrt(dvx * dvx + dvz * dvz)
        const c3 = vInf * vInf

        // Arrival v-infinity
        const rT = Math.sqrt(r2.x * r2.x + r2.z * r2.z)
        const vTOrb = Math.sqrt(MU_SUN / rT)
        const vTx = -vTOrb * r2.z / rT
        const vTz = vTOrb * r2.x / rT
        const avx = result.vArrive.x - vTx
        const avz = result.vArrive.z - vTz
        const vInfArr = Math.sqrt(avx * avx + avz * avz)

        if (c3 < 200 && c3 > 0) { // filter out unreasonable values
          points.push({ departureDOY: depDOY, flightTimeDays: flightDays, c3, vInfArr })
        }
      }
    }
  }

  return points
}

/**
 * Full interplanetary analysis
 */
export function computeInterplanetaryResult(params: InterplanetaryParams): InterplanetaryResult {
  const {
    targetBody, transferType, departureAltKm, arrivalOrbitAltKm,
    departureDateISO, arrivalDateISO,
  } = params

  const planet = PLANET_DATA[targetBody]

  let c3Km2s2: number
  let vInfDepart: number
  let vInfArrive: number
  let transferTimeDays: number

  if (transferType === 'hohmann') {
    const hohmann = computeHohmannInterplanetary(targetBody)
    c3Km2s2 = hohmann.c3
    vInfDepart = hohmann.vInfDepart
    vInfArrive = hohmann.vInfArrive
    transferTimeDays = hohmann.transferTimeDays
  } else {
    // Lambert — use actual dates
    const depDate = new Date(departureDateISO)
    const arrDate = new Date(arrivalDateISO)
    const r1 = computeEarthPosition(depDate)
    const r2 = computePlanetPosition(targetBody, arrDate)
    const tofS = (arrDate.getTime() - depDate.getTime()) / 1000
    transferTimeDays = tofS / 86400

    const result = solveLambert(r1, r2, tofS, MU_SUN)
    if (result) {
      // Compute v-infinity at Earth
      const rE = Math.sqrt(r1.x * r1.x + r1.z * r1.z)
      const vEarthOrb = Math.sqrt(MU_SUN / rE)
      const vEx = -vEarthOrb * r1.z / rE
      const vEz = vEarthOrb * r1.x / rE
      const dvx = result.vDepart.x - vEx
      const dvz = result.vDepart.z - vEz
      vInfDepart = Math.sqrt(dvx * dvx + dvz * dvz)
      c3Km2s2 = vInfDepart * vInfDepart

      // Arrival v-infinity
      const rT = Math.sqrt(r2.x * r2.x + r2.z * r2.z)
      const vTOrb = Math.sqrt(MU_SUN / rT)
      const vTx = -vTOrb * r2.z / rT
      const vTz = vTOrb * r2.x / rT
      const avx = result.vArrive.x - vTx
      const avz = result.vArrive.z - vTz
      vInfArrive = Math.sqrt(avx * avx + avz * avz)
    } else {
      // Lambert failed — fall back to Hohmann
      const hohmann = computeHohmannInterplanetary(targetBody)
      c3Km2s2 = hohmann.c3
      vInfDepart = hohmann.vInfDepart
      vInfArrive = hohmann.vInfArrive
    }
  }

  const departureDeltaVms = computeDepartureDeltaV(departureAltKm, vInfDepart)

  // Compute arrival insertion DV based on orbit type
  const arrivalOrbitType = params.arrivalOrbitType ?? 'circular'
  const captureApoFactor = params.captureApoFactor ?? 1

  const arrivalInsertionDeltaVms = arrivalOrbitType === 'elliptical' && captureApoFactor > 1
    ? computeEllipticalCaptureInsertionDeltaV(targetBody, arrivalOrbitAltKm, captureApoFactor, vInfArrive)
    : computeArrivalInsertionDeltaV(targetBody, arrivalOrbitAltKm, vInfArrive)
  const totalDeltaVms = departureDeltaVms + arrivalInsertionDeltaVms

  // Communications (at opposition: closest approach ≈ |r2 - r1|)
  const commsDistanceKm = Math.abs(planet.semiMajorAxisKm - EARTH_ORBITAL_DATA.semiMajorAxisKm)
  const commsDistanceAU = commsDistanceKm / AU_KM
  const commsDelayS = computeCommsDelay(commsDistanceKm)

  return {
    c3Km2s2,
    departureDeltaVms,
    transferTimeDays,
    arrivalVinfKms: vInfArrive,
    arrivalInsertionDeltaVms,
    totalDeltaVms,
    synodicPeriodDays: planet.synodicPeriodDays,
    commsDelayS,
    commsDistanceAU,
    planetRadiusKm: planet.radiusKm,
    planetSurfaceGravityMs2: planet.surfaceGravityMs2,
    planetEscapeVelocityKms: planet.escapeVelocityKms,
  }
}

/**
 * Generate planetary orbit points for 3D rendering
 * Returns points where 1 unit = 1 AU
 */
export function generatePlanetOrbitPoints(
  target: TargetBody,
  numPoints = 100,
): Array<{ x: number; y: number; z: number }> {
  const planet = PLANET_DATA[target]
  const rAU = planet.semiMajorAxisAU

  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI
    points.push({
      x: rAU * Math.cos(theta),
      y: 0,
      z: rAU * Math.sin(theta),
    })
  }
  return points
}

/**
 * Generate Earth orbit points for 3D rendering
 */
export function generateEarthOrbitPoints(numPoints = 100): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI
    points.push({
      x: Math.cos(theta),
      y: 0,
      z: Math.sin(theta),
    })
  }
  return points
}

/**
 * Generate Hohmann transfer arc for 3D rendering
 * Returns points in AU coordinates
 */
export function generateInterplanetaryTransferArc(
  target: TargetBody,
  numPoints = 80,
): Array<{ x: number; y: number; z: number }> {
  const planet = PLANET_DATA[target]
  const r1AU = 1.0 // Earth at 1 AU
  const r2AU = planet.semiMajorAxisAU

  const aTransferAU = (r1AU + r2AU) / 2
  const eTransfer = Math.abs(r2AU - r1AU) / (r2AU + r1AU)

  // Transfer arc: from Earth to target (half ellipse for Hohmann)
  const isOuter = r2AU > r1AU
  const nuMax = Math.PI // half orbit for Hohmann

  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const nu = (i / numPoints) * nuMax
    const r = aTransferAU * (1 - eTransfer * eTransfer) / (1 + eTransfer * Math.cos(nu))

    // Start from Earth position (angle 0)
    const angle = isOuter ? nu : -nu
    points.push({
      x: r * Math.cos(angle),
      y: 0,
      z: r * Math.sin(angle),
    })
  }
  return points
}

/**
 * Generate heliocentric distance profile for charts
 * Distance from Sun (AU) vs elapsed time (days)
 */
export function generateHeliocentricProfile(
  target: TargetBody,
  transferTimeDays: number,
  numPoints = 60,
): Array<{ day: number; distanceAU: number }> {
  const planet = PLANET_DATA[target]
  const r1 = 1.0 // AU
  const r2 = planet.semiMajorAxisAU

  const points: Array<{ day: number; distanceAU: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const day = t * transferTimeDays
    // Heliocentric distance along transfer orbit
    // Approximation: smooth interpolation from r1 to r2
    const nu = t * Math.PI // true anomaly along transfer
    const aTransfer = (r1 + r2) / 2
    const e = Math.abs(r2 - r1) / (r2 + r1)
    const distanceAU = aTransfer * (1 - e * e) / (1 + e * Math.cos(nu))
    points.push({ day, distanceAU })
  }
  return points
}
