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

/** Distance from a scene-space point to the Moon centre */
function distToMoonScene(pt: Vec3): number {
  return Math.sqrt((pt.x - MOON_X_SCENE) ** 2 + pt.z ** 2)
}

/** Bisection: find ν on the transfer ellipse where distance to Moon = MOON_SOI_KM.
 *  Uses law of cosines: d² = r² + 2·r·aMoon·cos(ν) + aMoon². */
function findSOIEntry(p: number, e: number): number {
  let nuLo = 0
  let nuHi = Math.PI
  for (let i = 0; i < 50; i++) {
    const nuMid = (nuLo + nuHi) / 2
    const r = keplerRadius(nuMid, p, e)
    const d2 = r * r + 2 * r * MOON_SEMI_MAJOR_AXIS * Math.cos(nuMid) + MOON_SEMI_MAJOR_AXIS ** 2
    if (d2 > MOON_SOI_KM ** 2) nuLo = nuMid
    else nuHi = nuMid
  }
  return (nuLo + nuHi) / 2
}

/** Rotate Moon-centred hyperbola coordinates by θ_rot and translate to scene space */
function hyperbolaToScene(xH: number, zH: number, thetaRot: number): Vec3 {
  return {
    x: (xH * Math.cos(thetaRot) - zH * Math.sin(thetaRot)) / LUNAR_SCENE_SCALE + MOON_X_SCENE,
    y: 0,
    z: (xH * Math.sin(thetaRot) + zH * Math.cos(thetaRot)) / LUNAR_SCENE_SCALE,
  }
}

/**
 * Generate lunar transfer arc for 3D rendering.
 * Keplerian transfer ellipse from parking orbit to lunar distance.
 * Earth at origin, Moon at ~0.961 on the x-axis.
 */
export function generateLunarTransferArc(
  departureAltKm: number,
  _targetOrbitAltKm = 100,
  numPoints = 80,
): Array<{ x: number; y: number; z: number }> {
  const { p, e } = computeTransferElements(departureAltKm)
  // Stop when the arc reaches close to the Moon's visual orbit ring
  const stopDistScene = VISUAL_MOON_R * 2.5
  const nuEnd = Math.PI
  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i <= numPoints; i++) {
    const nu = (i / numPoints) * nuEnd
    const r = keplerRadius(nu, p, e)
    const pt = transferToScene(nu, r, Math.PI)
    points.push(pt)
    // Check if we've reached close enough to the Moon
    const distFromMoon = Math.sqrt((pt.x - MOON_X_SCENE) ** 2 + pt.z ** 2)
    if (distFromMoon <= stopDistScene && i > numPoints * 0.5) break
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
 * Patched conics: transfer ellipse approach → hyperbolic lunar encounter → departure.
 */
export function generateFlybyPath(
  departureAltKm: number,
  closestApproachKm = 200,
  numPoints = 120,
): PhasedTrajectory {
  // ─── STEP 1: Debug constants ───
  console.log('[DEBUG] MOON_X_SCENE =', MOON_X_SCENE)
  console.log('[DEBUG] LUNAR_SCENE_SCALE =', LUNAR_SCENE_SCALE)
  console.log('[DEBUG] VISUAL_MOON_R =', VISUAL_MOON_R)

  // ─── Transfer ellipse parameters ───
  const { sma, e, p } = computeTransferElements(departureAltKm)
  const nuHandoff = findSOIEntry(p, e)
  console.log('[FLYBY] Transfer ellipse: sma=', sma, 'e=', e, 'p=', p)
  console.log('[FLYBY] nuHandoff (deg)=', nuHandoff * 180 / Math.PI)

  // ─── Segment A: Transfer ellipse (Earth → SOI boundary) ───
  const approachN = Math.floor(numPoints * 0.4)
  const approach: Vec3[] = []
  for (let i = 0; i <= approachN; i++) {
    const nu = (i / approachN) * nuHandoff
    const r = keplerRadius(nu, p, e)
    approach.push(transferToScene(nu, r, Math.PI))
  }

  const ellipseEnd = approach[approach.length - 1]
  console.log('[FLYBY] Ellipse endpoint (scene): x=', ellipseEnd.x, 'z=', ellipseEnd.z)
  console.log('[FLYBY] Moon position (scene): x=', MOON_X_SCENE)
  console.log('[FLYBY] Ellipse endpoint dist from Moon (scene)=',
    Math.sqrt((ellipseEnd.x - MOON_X_SCENE) ** 2 + ellipseEnd.z ** 2))

  // ─── Hyperbolic encounter parameters ───
  const vArrival = Math.sqrt(MU_EARTH_KM * (2 / MOON_SEMI_MAJOR_AXIS - 1 / sma))
  const vMoon = Math.sqrt(MU_EARTH_KM / MOON_SEMI_MAJOR_AXIS)
  const vInf = Math.max(Math.abs(vMoon - vArrival), 0.01)

  const rPeri = R_MOON + closestApproachKm
  const aHyp = MU_MOON / (vInf * vInf)
  const eHyp = 1 + rPeri / aHyp
  const pHyp = aHyp * (eHyp * eHyp - 1)
  const nuMax = Math.acos(-1 / eHyp)
  console.log('[FLYBY] vInf=', vInf, 'a_hyp=', aHyp, 'e_hyp=', eHyp)
  console.log('[FLYBY] rPeri (km)=', rPeri, 'deflection (deg)=', 2 * Math.asin(1 / eHyp) * 180 / Math.PI)
  console.log('[FLYBY] nuMax (deg)=', nuMax * 180 / Math.PI)

  // ─── Position alignment: rotate hyperbola so SOI entry matches ellipse endpoint ───
  // Direction from Moon center to the ellipse endpoint (where spacecraft enters SOI)
  const dx = ellipseEnd.x - MOON_X_SCENE
  const dz = ellipseEnd.z  // Moon is at z=0
  const arrivalAngle = Math.atan2(dz, dx)  // angle of arrival direction from Moon

  // Incoming asymptote angle in the unrotated hyperbola perifocal frame
  const incomingAsymAngle = Math.PI - nuMax

  // Rotate so incoming asymptote aligns with arrival direction
  // +π flips periapsis to the far side of the Moon (away from Earth)
  const thetaRot = arrivalAngle - incomingAsymAngle + Math.PI
  console.log('[FLYBY] NEW thetaRot (deg)=', thetaRot * 180 / Math.PI)

  // ─── STEP 2: Debug periapsis point through hyperbolaToScene ───
  const xH_peri = rPeri  // local x before rotation (km) — at ν=0, cos(0)=1
  const zH_peri = 0      // local z before rotation (km) — at ν=0, sin(0)=0

  // After rotation by thetaRot:
  const xRot_peri = xH_peri * Math.cos(thetaRot) - zH_peri * Math.sin(thetaRot)
  const zRot_peri = xH_peri * Math.sin(thetaRot) + zH_peri * Math.cos(thetaRot)
  console.log('[DEBUG] Periapsis rotated (km): xRot=', xRot_peri, 'zRot=', zRot_peri)

  // What hyperbolaToScene SHOULD produce for this point:
  const expected_x = MOON_X_SCENE + xRot_peri / LUNAR_SCENE_SCALE
  const expected_z = zRot_peri / LUNAR_SCENE_SCALE
  console.log('[DEBUG] Expected periapsis scene coords: x=', expected_x, 'z=', expected_z)
  console.log('[DEBUG] Expected dist from Moon (scene)=', Math.sqrt((expected_x - MOON_X_SCENE) ** 2 + expected_z ** 2))

  // What hyperbolaToScene ACTUALLY produces:
  const actualPt = hyperbolaToScene(xH_peri, zH_peri, thetaRot)
  console.log('[DEBUG] Actual periapsis from hyperbolaToScene: x=', actualPt.x, 'z=', actualPt.z)
  console.log('[DEBUG] Actual dist from Moon (scene)=', Math.sqrt((actualPt.x - MOON_X_SCENE) ** 2 + actualPt.z ** 2))

  // ─── STEP 4: Check nuSOI and radius at SOI entry ───
  const cosNuSOI = Math.max(-1, Math.min(1, (pHyp / MOON_SOI_KM - 1) / eHyp))
  const nuSOI = Math.acos(cosNuSOI)
  const rAtSOI = pHyp / (1 + eHyp * Math.cos(nuSOI))
  console.log('[DEBUG] nuSOI (deg)=', nuSOI * 180 / Math.PI)
  console.log('[DEBUG] Hyperbola radius at SOI entry (km)=', rAtSOI, 'expected ~66000')

  // ─── Segment B: Incoming hyperbola (ν = −nuSOI → 0 periapsis) → nearMoon ───
  const nearN = Math.floor(numPoints * 0.3)
  const nearMoon: Vec3[] = []
  for (let i = 0; i <= nearN; i++) {
    const nu = -nuSOI + (i / nearN) * nuSOI  // −nuSOI → 0
    const rH = pHyp / (1 + eHyp * Math.cos(nu))
    nearMoon.push(hyperbolaToScene(rH * Math.cos(nu), rH * Math.sin(nu), thetaRot))
  }

  // Closest approach at periapsis (ν = 0)
  const rCA = pHyp / (1 + eHyp) // = rPeri
  const closestApproach = hyperbolaToScene(rCA, 0, thetaRot)

  // ─── Segment C: Outgoing hyperbola (ν = 0 → +nuSOI) → departure ───
  const departN = numPoints - approachN - nearN
  const departure: Vec3[] = []
  for (let i = 0; i <= departN; i++) {
    const nu = (i / departN) * nuSOI  // 0 → +nuSOI
    const rH = pHyp / (1 + eHyp * Math.cos(nu))
    departure.push(hyperbolaToScene(rH * Math.cos(nu), rH * Math.sin(nu), thetaRot))
  }

  // ─── Bridge the SOI gap: arc along SOI sphere from ellipse exit to hyperbola entry ───
  const hypStart = nearMoon[0]
  const ellipseAngle = Math.atan2(ellipseEnd.z, ellipseEnd.x - MOON_X_SCENE)
  const hypStartAngle = Math.atan2(hypStart.z, hypStart.x - MOON_X_SCENE)
  const soiScene = MOON_SOI_KM / LUNAR_SCENE_SCALE
  let angleDiff = hypStartAngle - ellipseAngle
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
  for (let i = 1; i <= 10; i++) {
    const t = i / 11
    const angle = ellipseAngle + t * angleDiff
    approach.push({
      x: MOON_X_SCENE + soiScene * Math.cos(angle),
      y: 0,
      z: soiScene * Math.sin(angle),
    })
  }

  // ─── Compute CA from periapsis point (no offset — hyperbola is correctly positioned) ───
  const caDistScene = Math.sqrt(
    (closestApproach.x - MOON_X_SCENE) ** 2 + closestApproach.z ** 2
  )
  const computedCAKm = Math.max(0, caDistScene * LUNAR_SCENE_SCALE - R_MOON)
  console.log('[FLYBY] Input CA (km)=', closestApproachKm, 'Computed CA (km)=', computedCAKm)
  console.log('[FLYBY] CA point (scene): x=', closestApproach.x, 'z=', closestApproach.z,
    'dist from Moon=', caDistScene)

  return {
    approach,
    nearMoon,
    departure,
    closestApproach,
    closestApproachKm: computedCAKm,
    earthReturn: null,
  }
}

/**
 * Generate free-return figure-8 trajectory with phase-segmented output.
 * Patched conics: outbound ellipse → hyperbolic swing-by → return ellipse (rotated by deflection).
 */
export function generateFreeReturnTrajectory(
  departureAltKm: number,
  numPoints = 160,
): PhasedTrajectory {
  const closestApproachKm = 250 // typical free-return CA altitude

  // ─── Transfer ellipse parameters ───
  const { sma, e, p } = computeTransferElements(departureAltKm)
  const nuHandoff = findSOIEntry(p, e)
  console.log('[FREE-RET] Transfer ellipse: sma=', sma, 'e=', e, 'nuHandoff (deg)=', nuHandoff * 180 / Math.PI)

  // ─── Segment 1: Outbound transfer ellipse (Earth → SOI) ───
  const outboundN = Math.floor(numPoints * 0.35)
  const approach: Vec3[] = []
  for (let i = 0; i <= outboundN; i++) {
    const nu = (i / outboundN) * nuHandoff
    const r = keplerRadius(nu, p, e)
    approach.push(transferToScene(nu, r, Math.PI))
  }

  const ellipseEnd = approach[approach.length - 1]
  console.log('[FREE-RET] Ellipse endpoint (scene): x=', ellipseEnd.x, 'z=', ellipseEnd.z)

  // ─── Hyperbolic encounter parameters ───
  const vArrival = Math.sqrt(MU_EARTH_KM * (2 / MOON_SEMI_MAJOR_AXIS - 1 / sma))
  const vMoon = Math.sqrt(MU_EARTH_KM / MOON_SEMI_MAJOR_AXIS)
  const vInf = Math.max(Math.abs(vMoon - vArrival), 0.01)

  const rPeri = R_MOON + closestApproachKm
  const aHyp = MU_MOON / (vInf * vInf)
  const eHyp = 1 + rPeri / aHyp
  const pHyp = aHyp * (eHyp * eHyp - 1)
  const nuMax = Math.acos(-1 / eHyp)
  const deflection = 2 * Math.asin(1 / eHyp)
  console.log('[FREE-RET] vInf=', vInf, 'e_hyp=', eHyp, 'deflection (deg)=', deflection * 180 / Math.PI)

  // ─── Position alignment: rotate hyperbola so SOI entry matches ellipse endpoint ───
  const dx = ellipseEnd.x - MOON_X_SCENE
  const dz = ellipseEnd.z
  const arrivalAngle = Math.atan2(dz, dx)
  const incomingAsymAngle = Math.PI - nuMax
  // +π flips periapsis to the far side of the Moon (away from Earth)
  const thetaRot = arrivalAngle - incomingAsymAngle + Math.PI
  console.log('[FREE-RET] NEW thetaRot (deg)=', thetaRot * 180 / Math.PI)

  // ─── Hyperbola ν-range at SOI boundary ───
  const cosNuSOI = Math.max(-1, Math.min(1, (pHyp / MOON_SOI_KM - 1) / eHyp))
  const nuSOI = Math.acos(cosNuSOI)

  // ─── Segment 2: Hyperbolic swing-by (full arc −nuSOI → +nuSOI) ───
  const swingN = Math.floor(numPoints * 0.2)
  const nearMoon: Vec3[] = []
  for (let i = 0; i <= swingN; i++) {
    const nu = -nuSOI + (i / swingN) * 2 * nuSOI  // −nuSOI → +nuSOI
    const rH = pHyp / (1 + eHyp * Math.cos(nu))
    nearMoon.push(hyperbolaToScene(rH * Math.cos(nu), rH * Math.sin(nu), thetaRot))
  }

  // Closest approach at periapsis (ν = 0)
  const rCA = pHyp / (1 + eHyp)
  const closestApproach = hyperbolaToScene(rCA, 0, thetaRot)

  // ─── Bridge handoff 1: arc along SOI sphere from ellipse exit to hyperbola entry ───
  const hypStart = nearMoon[0]
  const ellipseAngle = Math.atan2(ellipseEnd.z, ellipseEnd.x - MOON_X_SCENE)
  const hypStartAngle = Math.atan2(hypStart.z, hypStart.x - MOON_X_SCENE)
  const soiScene = MOON_SOI_KM / LUNAR_SCENE_SCALE
  let angleDiff1 = hypStartAngle - ellipseAngle
  if (angleDiff1 > Math.PI) angleDiff1 -= 2 * Math.PI
  if (angleDiff1 < -Math.PI) angleDiff1 += 2 * Math.PI
  for (let i = 1; i <= 10; i++) {
    const t = i / 11
    const angle = ellipseAngle + t * angleDiff1
    approach.push({
      x: MOON_X_SCENE + soiScene * Math.cos(angle),
      y: 0,
      z: soiScene * Math.sin(angle),
    })
  }

  // ─── Segment 3: Return transfer ellipse (SOI → Earth) ───
  // Same orbital elements, apse line rotated by deflection angle → figure-8
  // After +π flip on thetaRot, the deflection bends the other way
  // so returnOmega = deflection (≡ Math.PI + deflection + Math.PI)
  const returnOmega = deflection
  const returnN = numPoints - outboundN - swingN

  // Find SOI exit on the return ellipse (where distance to Moon = MOON_SOI_KM)
  let nuRetLo = 0
  let nuRetHi = Math.PI
  for (let iter = 0; iter < 50; iter++) {
    const nuMid = (nuRetLo + nuRetHi) / 2
    const r = keplerRadius(nuMid, p, e)
    const pt = transferToScene(nuMid, r, returnOmega)
    const dKm = distToMoonScene(pt) * LUNAR_SCENE_SCALE
    if (dKm < MOON_SOI_KM) nuRetHi = nuMid
    else nuRetLo = nuMid
  }
  const nuReturnHandoff = (nuRetLo + nuRetHi) / 2

  const departure: Vec3[] = []
  for (let i = 0; i <= returnN; i++) {
    // ν sweeps from nuReturnHandoff (near Moon) down to 0 (near Earth)
    const nu = nuReturnHandoff * (1 - i / returnN)
    const r = keplerRadius(nu, p, e)
    departure.push(transferToScene(nu, r, returnOmega))
  }

  // ─── Bridge handoff 2: arc along SOI sphere from hyperbola exit to return ellipse entry ───
  const hypEnd = nearMoon[nearMoon.length - 1]
  const returnStart = departure[0]
  const hypEndAngle = Math.atan2(hypEnd.z, hypEnd.x - MOON_X_SCENE)
  const returnStartAngle = Math.atan2(returnStart.z, returnStart.x - MOON_X_SCENE)
  const soiScene2 = MOON_SOI_KM / LUNAR_SCENE_SCALE
  let angleDiff2 = returnStartAngle - hypEndAngle
  if (angleDiff2 > Math.PI) angleDiff2 -= 2 * Math.PI
  if (angleDiff2 < -Math.PI) angleDiff2 += 2 * Math.PI
  for (let i = 1; i <= 10; i++) {
    const t = i / 11
    const angle = hypEndAngle + t * angleDiff2
    nearMoon.push({
      x: MOON_X_SCENE + soiScene2 * Math.cos(angle),
      y: 0,
      z: soiScene2 * Math.sin(angle),
    })
  }

  // ─── Compute CA from periapsis point (no offset — hyperbola is correctly positioned) ───
  const caDistScene = Math.sqrt(
    (closestApproach.x - MOON_X_SCENE) ** 2 + closestApproach.z ** 2
  )
  const computedCAKm = Math.max(0, caDistScene * LUNAR_SCENE_SCALE - R_MOON)
  console.log('[FREE-RET] Input CA (km)=', closestApproachKm, 'Computed CA (km)=', computedCAKm)
  console.log('[FREE-RET] CA point (scene): x=', closestApproach.x, 'z=', closestApproach.z,
    'dist from Moon=', caDistScene)

  const earthReturn = departure[departure.length - 1]

  return {
    approach,
    nearMoon,
    departure,
    closestApproach,
    closestApproachKm: computedCAKm,
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
