// ─── Beyond-LEO Mission Design Types ───

export type BeyondLeoMode = 'lagrange' | 'lunar' | 'interplanetary'

// ─── Lagrange ───

export type LagrangeSystem = 'SE' | 'EM'
export type LagrangePoint = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
export type LagrangeOrbitType = 'halo' | 'lissajous' | 'lyapunov'
export type LagrangeTransferType = 'direct' | 'low-energy'

export interface LagrangeParams {
  system: LagrangeSystem
  point: LagrangePoint
  orbitType: LagrangeOrbitType
  amplitudeKm: number           // halo/lissajous amplitude (km)
  departureAltKm: number        // parking orbit altitude (km)
  transferType: LagrangeTransferType
  missionLifetimeYears: number
  stationKeepingBudgetMs: number // m/s/yr user estimate
}

export interface LagrangeResult {
  pointDistanceKm: number       // distance from secondary body (km)
  pointDistanceAU: number       // for SE system
  transferDeltaVms: number      // departure burn (m/s)
  transferTimeDays: number      // transit duration
  insertionDeltaVms: number     // orbit insertion (m/s)
  totalDeltaVms: number
  haloPeriodDays: number
  commsDistanceKm: number       // Earth-to-spacecraft (km)
  commsDelayS: number           // one-way light time (s)
  stabilityClass: 'stable' | 'unstable'
  annualStationKeepingMs: number // m/s/yr (computed)
  missionTotalDeltaVms: number  // full mission budget incl SK
}

// ─── Lunar ───

export type LunarMissionType = 'orbit' | 'flyby' | 'landing' | 'free-return'
export type LunarTransferType = 'hohmann' | 'low-energy' | 'gravity-assist'

export interface LunarParams {
  missionType: LunarMissionType
  targetOrbitAltKm: number
  targetOrbitIncDeg: number
  transferType: LunarTransferType
  departureAltKm: number
  spacecraftMassKg: number
  ispS: number
  propellantMassKg: number
  closestApproachAltKm: number
}

export interface LunarResult {
  tliDeltaVms: number           // Trans-Lunar Injection (m/s)
  transferTimeDays: number
  loiDeltaVms: number           // Lunar Orbit Insertion (m/s)
  totalDeltaVms: number
  lunarOrbitPeriodMin: number
  propellantRequiredKg: number  // Tsiolkovsky
  phaseAngleDeg: number
  commDelayS: number            // ~1.28 s
  freeReturnPeriodDays: number  // if free-return trajectory
}

// ─── Interplanetary ───

export type TargetBody =
  'mercury' | 'venus' | 'mars' | 'jupiter' |
  'saturn' | 'uranus' | 'neptune' | 'ceres' | 'vesta'

export type InterplanetaryMissionType = 'flyby' | 'orbiter' | 'lander'
export type InterplanetaryTransferType = 'hohmann' | 'lambert'
export type ArrivalOrbitType = 'circular' | 'elliptical'

export interface InterplanetaryParams {
  targetBody: TargetBody
  missionType: InterplanetaryMissionType
  transferType: InterplanetaryTransferType
  departureAltKm: number
  arrivalOrbitAltKm: number
  arrivalOrbitType: ArrivalOrbitType
  captureApoFactor: number // apoapsis as multiple of body radius (e.g., 20 = 20 Rj)
  departureDateISO: string
  arrivalDateISO: string
  spacecraftMassKg: number
}

export interface InterplanetaryResult {
  c3Km2s2: number               // characteristic energy (km²/s²)
  departureDeltaVms: number     // from parking orbit (m/s)
  transferTimeDays: number
  arrivalVinfKms: number        // arrival v-infinity (km/s)
  arrivalInsertionDeltaVms: number
  totalDeltaVms: number
  synodicPeriodDays: number
  commsDelayS: number           // one-way light time (s)
  commsDistanceAU: number
  // Planetary pass-through
  planetRadiusKm: number
  planetSurfaceGravityMs2: number
  planetEscapeVelocityKms: number
}

export interface PorkchopPoint {
  departureDOY: number          // day offset from start
  flightTimeDays: number
  c3: number                    // km²/s²
  vInfArr: number               // km/s
}

// ─── Store shape ───

export interface BeyondLeoState {
  mode: BeyondLeoMode
  lagrangeParams: LagrangeParams
  lunarParams: LunarParams
  interplanetaryParams: InterplanetaryParams
}

// ─── Defaults ───

export const DEFAULT_LAGRANGE_PARAMS: LagrangeParams = {
  system: 'SE',
  point: 'L2',
  orbitType: 'halo',
  amplitudeKm: 500000,
  departureAltKm: 400,
  transferType: 'direct',
  missionLifetimeYears: 5,
  stationKeepingBudgetMs: 30,
}

export const DEFAULT_LUNAR_PARAMS: LunarParams = {
  missionType: 'orbit',
  targetOrbitAltKm: 100,
  targetOrbitIncDeg: 90,
  transferType: 'hohmann',
  departureAltKm: 400,
  spacecraftMassKg: 500,
  ispS: 450,
  propellantMassKg: 100,
  closestApproachAltKm: 250,
}

/** Per-body default arrival orbit configs */
export const BODY_ARRIVAL_DEFAULTS: Record<TargetBody, {
  altKm: number
  orbitType: ArrivalOrbitType
  apoFactor: number
}> = {
  mercury:  { altKm: 200,  orbitType: 'circular',    apoFactor: 1 },
  venus:    { altKm: 300,  orbitType: 'circular',    apoFactor: 1 },
  mars:     { altKm: 300,  orbitType: 'circular',    apoFactor: 1 },
  jupiter:  { altKm: 2000, orbitType: 'elliptical',  apoFactor: 20 },
  saturn:   { altKm: 2000, orbitType: 'elliptical',  apoFactor: 20 },
  uranus:   { altKm: 1000, orbitType: 'elliptical',  apoFactor: 15 },
  neptune:  { altKm: 1000, orbitType: 'elliptical',  apoFactor: 15 },
  ceres:    { altKm: 100,  orbitType: 'circular',    apoFactor: 1 },
  vesta:    { altKm: 100,  orbitType: 'circular',    apoFactor: 1 },
}

export const DEFAULT_INTERPLANETARY_PARAMS: InterplanetaryParams = {
  targetBody: 'mars',
  missionType: 'orbiter',
  transferType: 'hohmann',
  departureAltKm: 400,
  arrivalOrbitAltKm: 300,
  arrivalOrbitType: 'circular',
  captureApoFactor: 1,
  departureDateISO: '2026-07-01T00:00:00.000Z',
  arrivalDateISO: '2027-01-15T00:00:00.000Z',
  spacecraftMassKg: 500,
}

export const DEFAULT_BEYOND_LEO_STATE: BeyondLeoState = {
  mode: 'lagrange',
  lagrangeParams: DEFAULT_LAGRANGE_PARAMS,
  lunarParams: DEFAULT_LUNAR_PARAMS,
  interplanetaryParams: DEFAULT_INTERPLANETARY_PARAMS,
}
