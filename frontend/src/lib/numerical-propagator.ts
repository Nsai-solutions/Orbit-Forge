/**
 * High-fidelity numerical orbit propagator for LEO satellites.
 *
 * Uses RK4 integration with selectable perturbation models:
 *   - J2-J6 zonal harmonics
 *   - Atmospheric drag (exponential model)
 *   - Solar radiation pressure (cylindrical shadow)
 *   - Third-body Sun and Moon gravity
 *
 * Standalone physics module — no UI dependencies.
 */

import {
  MU_EARTH_KM, R_EARTH_EQUATORIAL, J2, OMEGA_EARTH,
  DEG2RAD, RAD2DEG, getAtmosphericDensity,
} from './constants'
import { MU_MOON, MU_SUN, AU_KM } from './beyond-leo-constants'
import { dateToJulianCenturies } from './time-utils'
import { keplerianToCartesian } from './coordinate-transforms'
import type { OrbitalElements } from '@/types/orbit'
import type { Vec3 } from '@/types'

// ─── Higher-order zonal harmonic coefficients ───
const J3 = -2.53266e-6
const J4 = -1.61988e-6
const J5 = -2.27e-7
const J6 = 5.407e-7

// Solar radiation pressure at 1 AU (N/m^2)
const P_SRP = 4.56e-6

// ─── Types ───

export interface StateVector {
  x: number; y: number; z: number     // position km (ECI)
  vx: number; vy: number; vz: number  // velocity km/s (ECI)
}

export interface TrajectoryPoint {
  t: number          // ms since Unix epoch
  state: StateVector
}

export interface PerturbationConfig {
  j2: boolean
  j3j6: boolean
  drag: boolean
  srp: boolean
  thirdBodyMoon: boolean
  thirdBodySun: boolean
}

export interface SpacecraftProps {
  cd: number    // drag coefficient (typ. 2.2)
  cr: number    // SRP reflectivity coefficient (typ. 1.2)
  area: number  // cross-section area m^2
  mass: number  // kg
}

export type PropagationMode = 'keplerian' | 'numerical-j2' | 'numerical-full'

// ─── Vector helpers ───

function vecMag(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

function vecDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function vecCross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

// ─── Acceleration functions (all return km/s^2 in ECI) ───

/** Two-body central gravity: a = -mu * r / |r|^3 */
function accelCentralBody(x: number, y: number, z: number, rMag: number): Vec3 {
  const rMag3 = rMag * rMag * rMag
  return {
    x: -MU_EARTH_KM * x / rMag3,
    y: -MU_EARTH_KM * y / rMag3,
    z: -MU_EARTH_KM * z / rMag3,
  }
}

/**
 * J2 zonal harmonic acceleration (Vallado formulation).
 * This is the dominant perturbation — accounts for ~99% of Earth oblateness effect.
 */
function accelJ2(x: number, y: number, z: number, rMag: number): Vec3 {
  const Re = R_EARTH_EQUATORIAL
  const rMag2 = rMag * rMag
  const rMag5 = rMag2 * rMag2 * rMag
  const z2r2 = (z * z) / rMag2
  const coeff = -1.5 * J2 * MU_EARTH_KM * Re * Re / rMag5
  return {
    x: coeff * x * (1 - 5 * z2r2),
    y: coeff * y * (1 - 5 * z2r2),
    z: coeff * z * (3 - 5 * z2r2),
  }
}

/**
 * J3-J6 zonal harmonic accelerations.
 * Standard Cartesian formulations from Vallado & Montenbruck-Gill.
 */
function accelJ3toJ6(x: number, y: number, z: number, rMag: number): Vec3 {
  const Re = R_EARTH_EQUATORIAL
  const rMag2 = rMag * rMag
  const zr = z / rMag
  const zr2 = zr * zr
  let ax = 0, ay = 0, az = 0

  // J3
  {
    const Re3 = Re * Re * Re
    const r7 = rMag2 * rMag2 * rMag2 * rMag
    const coeff = -0.5 * J3 * MU_EARTH_KM * Re3 / r7
    const fxy = 5 * (7 * zr2 * zr - 3 * zr)
    const fz = 3 - 42 * zr2 + 35 * zr2 * zr2
    ax += coeff * x * fxy
    ay += coeff * y * fxy
    az += coeff * z * fz + coeff * rMag * (6 * zr2 - 3)  // corrected z component
  }

  // J4
  {
    const Re4 = Re * Re * Re * Re
    const r9 = rMag2 * rMag2 * rMag2 * rMag2 * rMag
    const coeff = (5.0 / 8.0) * J4 * MU_EARTH_KM * Re4 / r9
    const fxy = 3 - 42 * zr2 + 63 * zr2 * zr2
    const fz = 15 - 70 * zr2 + 63 * zr2 * zr2
    ax += coeff * x * fxy
    ay += coeff * y * fxy
    az += coeff * z * fz
  }

  // J5
  {
    const Re5 = Re * Re * Re * Re * Re
    const r11 = rMag2 * rMag2 * rMag2 * rMag2 * rMag2 * rMag
    const coeff = (1.0 / 8.0) * J5 * MU_EARTH_KM * Re5 / r11
    const fxy = zr * (315 * zr2 * zr2 - 210 * zr2 + 15)
    const fz = 315 * zr2 * zr2 - 420 * zr2 + 105
    ax += coeff * x * fxy
    ay += coeff * y * fxy
    az += coeff * z * fz * zr + coeff * rMag * (-1) * (15 * zr2 - 210 * zr2 * zr2 + 315 * zr2 * zr2 * zr2 - 1)
  }

  // J6
  {
    const Re6 = Re * Re * Re * Re * Re * Re
    const r13 = rMag2 * rMag2 * rMag2 * rMag2 * rMag2 * rMag2 * rMag
    const coeff = -(1.0 / 16.0) * J6 * MU_EARTH_KM * Re6 / r13
    const fxy = 35 - 945 * zr2 + 3465 * zr2 * zr2 - 3003 * zr2 * zr2 * zr2
    const fz = 245 - 2205 * zr2 + 4851 * zr2 * zr2 - 3003 * zr2 * zr2 * zr2
    ax += coeff * x * fxy
    ay += coeff * y * fxy
    az += coeff * z * fz
  }

  return { x: ax, y: ay, z: az }
}

/**
 * Atmospheric drag acceleration.
 * Uses exponential density model (existing getAtmosphericDensity),
 * accounts for atmospheric co-rotation with Earth.
 */
function accelDrag(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  rMag: number, sc: SpacecraftProps,
): Vec3 {
  const altKm = rMag - R_EARTH_EQUATORIAL
  if (altKm > 1000 || altKm < 0) return { x: 0, y: 0, z: 0 }

  const rho = getAtmosphericDensity(altKm)
  if (rho <= 0) return { x: 0, y: 0, z: 0 }

  // Velocity relative to rotating atmosphere
  // v_atm = omega x r = [-omega*y, omega*x, 0]
  const vRelX = vx + OMEGA_EARTH * y
  const vRelY = vy - OMEGA_EARTH * x
  const vRelZ = vz
  const vRelMag = Math.sqrt(vRelX * vRelX + vRelY * vRelY + vRelZ * vRelZ)
  if (vRelMag < 1e-12) return { x: 0, y: 0, z: 0 }

  // a_drag = -0.5 * Cd * (A/m) * rho * |v_rel|^2 * v_hat
  // rho: kg/m^3, A: m^2, m: kg, v_rel: km/s
  // |v_rel|^2 in (km/s)^2 = 1e6 m^2/s^2
  // Result in m/s^2, divide by 1000 for km/s^2
  // => factor = -0.5 * Cd * (A/m) * rho * |v_rel_km| * 1e3
  const factor = -0.5 * sc.cd * (sc.area / sc.mass) * rho * vRelMag * 1e3
  return {
    x: factor * vRelX,
    y: factor * vRelY,
    z: factor * vRelZ,
  }
}

/**
 * Solar radiation pressure acceleration with cylindrical shadow model.
 */
function accelSRP(
  x: number, y: number, z: number,
  sunPos: Vec3, sc: SpacecraftProps,
): Vec3 {
  // Vector from satellite to Sun
  const dx = sunPos.x - x
  const dy = sunPos.y - y
  const dz = sunPos.z - z
  const dMag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const sunDirX = dx / dMag
  const sunDirY = dy / dMag
  const sunDirZ = dz / dMag

  // Shadow check: cylindrical model
  // Project satellite position onto Sun direction
  const dot = x * sunDirX + y * sunDirY + z * sunDirZ
  if (dot < 0) {
    // Satellite is on the opposite side of Earth from the Sun
    const rMag2 = x * x + y * y + z * z
    const perpDistSq = rMag2 - dot * dot
    if (perpDistSq < R_EARTH_EQUATORIAL * R_EARTH_EQUATORIAL) {
      return { x: 0, y: 0, z: 0 } // in shadow
    }
  }

  // SRP acceleration: a = -Cr * P * (A/m) * (AU/dist)^2 * sunDir
  // P in N/m^2, A/m in m^2/kg => m/s^2 => /1000 for km/s^2
  const scale = (AU_KM / dMag) * (AU_KM / dMag)
  const factor = -sc.cr * P_SRP * (sc.area / sc.mass) * scale / 1000
  return {
    x: factor * sunDirX,
    y: factor * sunDirY,
    z: factor * sunDirZ,
  }
}

/**
 * Third-body gravitational perturbation (direct + indirect).
 */
function accelThirdBody(
  x: number, y: number, z: number,
  bodyPos: Vec3, muBody: number,
): Vec3 {
  // Vector from satellite to body
  const dx = bodyPos.x - x
  const dy = bodyPos.y - y
  const dz = bodyPos.z - z
  const dMag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const dMag3 = dMag * dMag * dMag

  // Vector from Earth center to body
  const bMag = vecMag(bodyPos)
  const bMag3 = bMag * bMag * bMag

  return {
    x: muBody * (dx / dMag3 - bodyPos.x / bMag3),
    y: muBody * (dy / dMag3 - bodyPos.y / bMag3),
    z: muBody * (dz / dMag3 - bodyPos.z / bMag3),
  }
}

// ─── Ephemeris (low-precision analytical) ───

/**
 * Approximate Sun position in ECI (km). ~1 degree accuracy.
 */
export function computeSunPositionECI(date: Date): Vec3 {
  const T = dateToJulianCenturies(date)
  const L0 = (280.46646 + 36000.76983 * T) % 360
  const M = (357.52911 + 35999.05029 * T) % 360
  const Mrad = M * DEG2RAD
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mrad)
    + 0.019993 * Math.sin(2 * Mrad)
  const sunLon = (L0 + C) * DEG2RAD
  const eps = (23.439291 - 0.0130042 * T) * DEG2RAD
  // Distance from Earth (approximate, varies ~3%)
  const dist = (1.00014 - 0.01671 * Math.cos(Mrad) - 0.00014 * Math.cos(2 * Mrad)) * AU_KM
  return {
    x: dist * Math.cos(sunLon),
    y: dist * Math.cos(eps) * Math.sin(sunLon),
    z: dist * Math.sin(eps) * Math.sin(sunLon),
  }
}

/**
 * Approximate Moon position in ECI (km). ~1-2 degree accuracy.
 * Simplified Brown's lunar theory.
 */
export function computeMoonPositionECI(date: Date): Vec3 {
  const T = dateToJulianCenturies(date)
  // Mean longitude (deg)
  const L0 = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360
  // Mean anomaly (deg)
  const M = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360
  // Argument of latitude (deg)
  const F = ((93.2720 + 483202.0175 * T) % 360 + 360) % 360

  const Mrad = M * DEG2RAD
  const Frad = F * DEG2RAD

  // Ecliptic longitude (simplified)
  const lonRad = (L0 + 6.289 * Math.sin(Mrad)) * DEG2RAD
  // Ecliptic latitude (simplified)
  const latRad = 5.128 * Math.sin(Frad) * DEG2RAD
  // Distance (km)
  const dist = 385001 - 20905 * Math.cos(Mrad)

  // Obliquity of ecliptic
  const eps = (23.439291 - 0.0130042 * T) * DEG2RAD

  // Ecliptic to ECI
  const cosLat = Math.cos(latRad)
  const sinLat = Math.sin(latRad)
  const cosLon = Math.cos(lonRad)
  const sinLon = Math.sin(lonRad)
  const cosEps = Math.cos(eps)
  const sinEps = Math.sin(eps)

  const xEcl = dist * cosLat * cosLon
  const yEcl = dist * cosLat * sinLon
  const zEcl = dist * sinLat

  return {
    x: xEcl,
    y: yEcl * cosEps - zEcl * sinEps,
    z: yEcl * sinEps + zEcl * cosEps,
  }
}

// ─── Total acceleration dispatcher ───

/**
 * Compute total acceleration at a given state and time.
 * Sums all enabled perturbation forces.
 * sunPos/moonPos are passed in to avoid recomputing per RK4 sub-step.
 */
function totalAcceleration(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  config: PerturbationConfig,
  sc: SpacecraftProps,
  sunPos: Vec3 | null,
  moonPos: Vec3 | null,
): Vec3 {
  const rMag = Math.sqrt(x * x + y * y + z * z)

  // Central body (always on)
  let ax = -MU_EARTH_KM * x / (rMag * rMag * rMag)
  let ay = -MU_EARTH_KM * y / (rMag * rMag * rMag)
  let az = -MU_EARTH_KM * z / (rMag * rMag * rMag)

  if (config.j2) {
    const a = accelJ2(x, y, z, rMag)
    ax += a.x; ay += a.y; az += a.z
  }

  if (config.j3j6) {
    const a = accelJ3toJ6(x, y, z, rMag)
    ax += a.x; ay += a.y; az += a.z
  }

  if (config.drag) {
    const a = accelDrag(x, y, z, vx, vy, vz, rMag, sc)
    ax += a.x; ay += a.y; az += a.z
  }

  if (config.srp && sunPos) {
    const a = accelSRP(x, y, z, sunPos, sc)
    ax += a.x; ay += a.y; az += a.z
  }

  if (config.thirdBodyMoon && moonPos) {
    const a = accelThirdBody(x, y, z, moonPos, MU_MOON)
    ax += a.x; ay += a.y; az += a.z
  }

  if (config.thirdBodySun && sunPos) {
    const a = accelThirdBody(x, y, z, sunPos, MU_SUN)
    ax += a.x; ay += a.y; az += a.z
  }

  return { x: ax, y: ay, z: az }
}

// ─── RK4 Integrator (3D) ───

/**
 * Single RK4 step for 6-component state vector [x,y,z,vx,vy,vz].
 * Sun/Moon positions computed once per step and reused across sub-evaluations.
 */
function rk4Step3D(
  state: StateVector,
  tMs: number,
  dtSec: number,
  config: PerturbationConfig,
  sc: SpacecraftProps,
): StateVector {
  // Compute Sun/Moon positions once per step (they barely move in 30s)
  const date = new Date(tMs)
  const sunPos = (config.srp || config.thirdBodySun) ? computeSunPositionECI(date) : null
  const moonPos = config.thirdBodyMoon ? computeMoonPositionECI(date) : null

  function deriv(sx: number, sy: number, sz: number, svx: number, svy: number, svz: number) {
    const a = totalAcceleration(sx, sy, sz, svx, svy, svz, config, sc, sunPos, moonPos)
    return { dx: svx, dy: svy, dz: svz, dvx: a.x, dvy: a.y, dvz: a.z }
  }

  const dt = dtSec
  const k1 = deriv(state.x, state.y, state.z, state.vx, state.vy, state.vz)

  const k2 = deriv(
    state.x + k1.dx * dt / 2, state.y + k1.dy * dt / 2, state.z + k1.dz * dt / 2,
    state.vx + k1.dvx * dt / 2, state.vy + k1.dvy * dt / 2, state.vz + k1.dvz * dt / 2,
  )

  const k3 = deriv(
    state.x + k2.dx * dt / 2, state.y + k2.dy * dt / 2, state.z + k2.dz * dt / 2,
    state.vx + k2.dvx * dt / 2, state.vy + k2.dvy * dt / 2, state.vz + k2.dvz * dt / 2,
  )

  const k4 = deriv(
    state.x + k3.dx * dt, state.y + k3.dy * dt, state.z + k3.dz * dt,
    state.vx + k3.dvx * dt, state.vy + k3.dvy * dt, state.vz + k3.dvz * dt,
  )

  return {
    x:  state.x  + dt / 6 * (k1.dx  + 2 * k2.dx  + 2 * k3.dx  + k4.dx),
    y:  state.y  + dt / 6 * (k1.dy  + 2 * k2.dy  + 2 * k3.dy  + k4.dy),
    z:  state.z  + dt / 6 * (k1.dz  + 2 * k2.dz  + 2 * k3.dz  + k4.dz),
    vx: state.vx + dt / 6 * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
    vy: state.vy + dt / 6 * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy),
    vz: state.vz + dt / 6 * (k1.dvz + 2 * k2.dvz + 2 * k3.dvz + k4.dvz),
  }
}

// ─── Main propagation entry point ───

/**
 * Propagate an orbit numerically from Keplerian elements.
 * Returns timestamped trajectory points for interpolation.
 */
export function propagateNumerical(
  elements: OrbitalElements,
  epochMs: number,
  numOrbits: number,
  dtSec: number,
  config: PerturbationConfig,
  sc: SpacecraftProps,
): TrajectoryPoint[] {
  // Convert elements to state vector using existing utility
  const { position, velocity } = keplerianToCartesian(elements, MU_EARTH_KM)
  let state: StateVector = {
    x: position.x, y: position.y, z: position.z,
    vx: velocity.x, vy: velocity.y, vz: velocity.z,
  }

  // Compute orbital period for the requested number of orbits
  const period = 2 * Math.PI * Math.sqrt(
    Math.pow(elements.semiMajorAxis, 3) / MU_EARTH_KM
  )
  const totalTimeSec = period * numOrbits
  const numSteps = Math.ceil(totalTimeSec / dtSec)

  // Cap at 50000 points to prevent browser freeze
  const maxSteps = 50000
  const effectiveDt = numSteps > maxSteps
    ? totalTimeSec / maxSteps
    : dtSec
  const effectiveNumSteps = numSteps > maxSteps ? maxSteps : numSteps

  const trajectory: TrajectoryPoint[] = [{ t: epochMs, state: { ...state } }]

  let tMs = epochMs
  for (let i = 0; i < effectiveNumSteps; i++) {
    state = rk4Step3D(state, tMs, effectiveDt, config, sc)
    tMs += effectiveDt * 1000
    trajectory.push({ t: tMs, state: { ...state } })
  }

  return trajectory
}

// ─── Trajectory interpolation ───

/**
 * Interpolate position at arbitrary time from pre-propagated trajectory.
 * Uses binary search + linear interpolation between bracketing points.
 */
export function interpolateTrajectory(
  trajectory: TrajectoryPoint[],
  tMs: number,
): StateVector | null {
  if (trajectory.length === 0) return null
  if (tMs <= trajectory[0].t) return trajectory[0].state
  if (tMs >= trajectory[trajectory.length - 1].t) return trajectory[trajectory.length - 1].state

  // Binary search for bracketing interval
  let lo = 0, hi = trajectory.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (trajectory[mid].t <= tMs) lo = mid
    else hi = mid
  }

  const p0 = trajectory[lo]
  const p1 = trajectory[hi]
  const frac = (tMs - p0.t) / (p1.t - p0.t)

  return {
    x:  p0.state.x  + frac * (p1.state.x  - p0.state.x),
    y:  p0.state.y  + frac * (p1.state.y  - p0.state.y),
    z:  p0.state.z  + frac * (p1.state.z  - p0.state.z),
    vx: p0.state.vx + frac * (p1.state.vx - p0.state.vx),
    vy: p0.state.vy + frac * (p1.state.vy - p0.state.vy),
    vz: p0.state.vz + frac * (p1.state.vz - p0.state.vz),
  }
}

// ─── Cartesian to Keplerian conversion (inverse) ───

/**
 * Convert ECI state vector to Keplerian orbital elements.
 */
export function cartesianToKeplerian(state: StateVector, mu: number = MU_EARTH_KM): OrbitalElements {
  const r: Vec3 = { x: state.x, y: state.y, z: state.z }
  const v: Vec3 = { x: state.vx, y: state.vy, z: state.vz }
  const rMag = vecMag(r)
  const vMag = vecMag(v)

  // Angular momentum vector
  const h = vecCross(r, v)
  const hMag = vecMag(h)

  // Node vector: n = k x h
  const n: Vec3 = { x: -h.y, y: h.x, z: 0 }
  const nMag = vecMag(n)

  // Eccentricity vector: e = (v x h)/mu - r/|r|
  const vCrossH = vecCross(v, h)
  const eVec: Vec3 = {
    x: vCrossH.x / mu - r.x / rMag,
    y: vCrossH.y / mu - r.y / rMag,
    z: vCrossH.z / mu - r.z / rMag,
  }
  const e = vecMag(eVec)

  // Semi-major axis from vis-viva
  const energy = 0.5 * vMag * vMag - mu / rMag
  const a = -mu / (2 * energy)

  // Inclination
  const inc = Math.acos(Math.max(-1, Math.min(1, h.z / hMag)))

  // RAAN
  let raan = 0
  if (nMag > 1e-12) {
    raan = Math.acos(Math.max(-1, Math.min(1, n.x / nMag)))
    if (n.y < 0) raan = 2 * Math.PI - raan
  }

  // Argument of perigee
  let argP = 0
  if (nMag > 1e-12 && e > 1e-12) {
    argP = Math.acos(Math.max(-1, Math.min(1, vecDot(n, eVec) / (nMag * e))))
    if (eVec.z < 0) argP = 2 * Math.PI - argP
  }

  // True anomaly
  let nu = 0
  if (e > 1e-12) {
    nu = Math.acos(Math.max(-1, Math.min(1, vecDot(eVec, r) / (e * rMag))))
    if (vecDot(r, v) < 0) nu = 2 * Math.PI - nu
  }

  return {
    semiMajorAxis: a,
    eccentricity: e,
    inclination: inc * RAD2DEG,
    raan: raan * RAD2DEG,
    argOfPerigee: argP * RAD2DEG,
    trueAnomaly: nu * RAD2DEG,
  }
}

// ─── Config helper ───

/** Build perturbation config from propagation mode */
export function configForMode(mode: PropagationMode, custom?: Partial<PerturbationConfig>): PerturbationConfig {
  switch (mode) {
    case 'keplerian':
      return { j2: false, j3j6: false, drag: false, srp: false, thirdBodyMoon: false, thirdBodySun: false }
    case 'numerical-j2':
      return { j2: true, j3j6: false, drag: false, srp: false, thirdBodyMoon: false, thirdBodySun: false, ...custom }
    case 'numerical-full':
      return { j2: true, j3j6: true, drag: true, srp: true, thirdBodyMoon: true, thirdBodySun: true, ...custom }
  }
}
