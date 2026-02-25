/**
 * Constants for Beyond-LEO mission design
 * Lunar, solar, and planetary parameters
 */

import type { TargetBody } from '@/types/beyond-leo'

// ─── Lunar ───
export const MU_MOON = 4902.800066              // km³/s²
export const R_MOON = 1737.4                    // km (mean radius)
export const MOON_SEMI_MAJOR_AXIS = 384400      // km (Earth-Moon mean distance)
export const MOON_MASS_KG = 7.342e22
export const MOON_ORBITAL_PERIOD_S = 2360591.5  // 27.322 days in seconds

// ─── Solar ───
export const MU_SUN = 1.32712440018e11          // km³/s²
export const R_SUN = 695700                     // km
export const AU_KM = 1.495978707e8              // 1 AU in km

// ─── CR3BP mass ratios ───
export const MU_CR3BP_SE = 3.0404e-6            // Sun-Earth μ = m_earth/(m_sun + m_earth)
export const MU_CR3BP_EM = 0.01215              // Earth-Moon μ = m_moon/(m_earth + m_moon)

// ─── L-point distances from secondary body (km) ───
// Sun-Earth system (distances from Earth)
export const SE_L1_DIST_KM = 1.491e6            // ~1.491 million km sunward of Earth
export const SE_L2_DIST_KM = 1.501e6            // ~1.501 million km anti-sunward of Earth
export const SE_L3_DIST_KM = AU_KM * 2          // opposite side of Sun from Earth
export const SE_L4_DIST_KM = AU_KM              // 60° ahead in Earth's orbit
export const SE_L5_DIST_KM = AU_KM              // 60° behind in Earth's orbit

// Earth-Moon system (distances from Moon)
export const EM_L1_DIST_KM = 58000              // ~58,000 km Earthward of Moon
export const EM_L2_DIST_KM = 64500              // ~64,500 km beyond Moon
export const EM_L3_DIST_KM = 381700             // opposite side of Earth from Moon
export const EM_L4_DIST_KM = MOON_SEMI_MAJOR_AXIS // 60° ahead in Moon's orbit
export const EM_L5_DIST_KM = MOON_SEMI_MAJOR_AXIS // 60° behind in Moon's orbit

// ─── Characteristic halo orbit periods (days) ───
export const SE_L1_HALO_PERIOD_DAYS = 177.86
export const SE_L2_HALO_PERIOD_DAYS = 179.1
export const SE_L3_HALO_PERIOD_DAYS = 365.25    // ~1 year (similar to Earth orbital period)
export const EM_L1_HALO_PERIOD_DAYS = 14.0
export const EM_L2_HALO_PERIOD_DAYS = 14.77
export const EM_L3_HALO_PERIOD_DAYS = 27.3      // ~lunar orbital period
export const EM_L4_HALO_PERIOD_DAYS = 27.3
export const EM_L5_HALO_PERIOD_DAYS = 27.3

// ─── Station-keeping budgets (m/s/yr) — based on published mission data ───
// L1/L2/L3: unstable equilibria requiring active SK
// L4/L5: stable equilibria (triangular Lagrange points)
export const SK_BUDGETS: Record<string, number> = {
  'SE-L1': 2.5,     // SOHO: ~2 m/s/yr
  'SE-L2': 3.0,     // JWST: ~2-4 m/s/yr, Gaia: ~3 m/s/yr
  'SE-L3': 10.0,    // No missions, estimate
  'SE-L4': 0,       // Stable
  'SE-L5': 0,       // Stable
  'EM-L1': 20.0,    // Higher due to solar perturbations
  'EM-L2': 25.0,    // ARTEMIS-style halo, ~25 m/s/yr
  'EM-L3': 30.0,    // No missions, estimate
  'EM-L4': 0,       // Stable
  'EM-L5': 0,       // Stable
}

// ─── Planetary data ───

export interface PlanetData {
  name: string
  semiMajorAxisAU: number
  semiMajorAxisKm: number
  orbitalPeriodDays: number
  mu: number                    // km³/s²
  radiusKm: number
  massKg: number
  escapeVelocityKms: number
  surfaceGravityMs2: number
  atmosphereType: 'none' | 'thin' | 'moderate' | 'thick'
  synodicPeriodDays: number
  meanLongitudeAtJ2000Deg: number // mean longitude at J2000 epoch (degrees)
  eccentricity: number                  // orbital eccentricity
  longitudeOfPerihelionDeg: number      // longitude of perihelion at J2000 (degrees)
  color: string                 // hex color for 3D rendering
}

export const PLANET_DATA: Record<TargetBody, PlanetData> = {
  mercury: {
    name: 'Mercury',
    semiMajorAxisAU: 0.387,
    semiMajorAxisKm: 5.791e7,
    orbitalPeriodDays: 87.97,
    mu: 2.2032e4,
    radiusKm: 2439.7,
    massKg: 3.301e23,
    escapeVelocityKms: 4.25,
    surfaceGravityMs2: 3.70,
    atmosphereType: 'none',
    synodicPeriodDays: 115.88,
    meanLongitudeAtJ2000Deg: 252.251,
    eccentricity: 0.20563,
    longitudeOfPerihelionDeg: 77.456,
    color: '#A0522D',
  },
  venus: {
    name: 'Venus',
    semiMajorAxisAU: 0.723,
    semiMajorAxisKm: 1.082e8,
    orbitalPeriodDays: 224.70,
    mu: 3.2486e5,
    radiusKm: 6051.8,
    massKg: 4.867e24,
    escapeVelocityKms: 10.36,
    surfaceGravityMs2: 8.87,
    atmosphereType: 'thick',
    synodicPeriodDays: 583.92,
    meanLongitudeAtJ2000Deg: 181.980,
    eccentricity: 0.00677,
    longitudeOfPerihelionDeg: 131.534,
    color: '#DEB887',
  },
  mars: {
    name: 'Mars',
    semiMajorAxisAU: 1.524,
    semiMajorAxisKm: 2.279e8,
    orbitalPeriodDays: 686.97,
    mu: 4.2828e4,
    radiusKm: 3389.5,
    massKg: 6.39e23,
    escapeVelocityKms: 5.03,
    surfaceGravityMs2: 3.71,
    atmosphereType: 'thin',
    synodicPeriodDays: 779.96,
    meanLongitudeAtJ2000Deg: 355.433,
    eccentricity: 0.09340,
    longitudeOfPerihelionDeg: 336.060,
    color: '#CD5C5C',
  },
  jupiter: {
    name: 'Jupiter',
    semiMajorAxisAU: 5.203,
    semiMajorAxisKm: 7.783e8,
    orbitalPeriodDays: 4332.59,
    mu: 1.26687e8,
    radiusKm: 71492,
    massKg: 1.898e27,
    escapeVelocityKms: 59.5,
    surfaceGravityMs2: 24.79,
    atmosphereType: 'thick',
    synodicPeriodDays: 398.88,
    meanLongitudeAtJ2000Deg: 34.351,
    eccentricity: 0.04839,
    longitudeOfPerihelionDeg: 14.331,
    color: '#DAA06D',
  },
  saturn: {
    name: 'Saturn',
    semiMajorAxisAU: 9.537,
    semiMajorAxisKm: 1.432e9,
    orbitalPeriodDays: 10759.22,
    mu: 3.7931e7,
    radiusKm: 60268,
    massKg: 5.683e26,
    escapeVelocityKms: 35.5,
    surfaceGravityMs2: 10.44,
    atmosphereType: 'thick',
    synodicPeriodDays: 378.09,
    meanLongitudeAtJ2000Deg: 50.077,
    eccentricity: 0.05415,
    longitudeOfPerihelionDeg: 93.057,
    color: '#F4C542',
  },
  uranus: {
    name: 'Uranus',
    semiMajorAxisAU: 19.191,
    semiMajorAxisKm: 2.871e9,
    orbitalPeriodDays: 30688.5,
    mu: 5.7940e6,
    radiusKm: 25559,
    massKg: 8.681e25,
    escapeVelocityKms: 21.3,
    surfaceGravityMs2: 8.69,
    atmosphereType: 'thick',
    synodicPeriodDays: 369.66,
    meanLongitudeAtJ2000Deg: 314.055,
    eccentricity: 0.04717,
    longitudeOfPerihelionDeg: 173.005,
    color: '#87CEEB',
  },
  neptune: {
    name: 'Neptune',
    semiMajorAxisAU: 30.069,
    semiMajorAxisKm: 4.495e9,
    orbitalPeriodDays: 60182.0,
    mu: 6.8351e6,
    radiusKm: 24764,
    massKg: 1.024e26,
    escapeVelocityKms: 23.5,
    surfaceGravityMs2: 11.15,
    atmosphereType: 'thick',
    synodicPeriodDays: 367.49,
    meanLongitudeAtJ2000Deg: 304.349,
    eccentricity: 0.00859,
    longitudeOfPerihelionDeg: 48.124,
    color: '#4169E1',
  },
  ceres: {
    name: 'Ceres',
    semiMajorAxisAU: 2.767,
    semiMajorAxisKm: 4.140e8,
    orbitalPeriodDays: 1681.63,
    mu: 62.6284,
    radiusKm: 473,
    massKg: 9.383e20,
    escapeVelocityKms: 0.51,
    surfaceGravityMs2: 0.28,
    atmosphereType: 'none',
    synodicPeriodDays: 466.62,
    meanLongitudeAtJ2000Deg: 231.3,
    eccentricity: 0.0758,
    longitudeOfPerihelionDeg: 73.6,
    color: '#808080',
  },
  vesta: {
    name: 'Vesta',
    semiMajorAxisAU: 2.362,
    semiMajorAxisKm: 3.533e8,
    orbitalPeriodDays: 1325.75,
    mu: 17.288,
    radiusKm: 265,
    massKg: 2.59e20,
    escapeVelocityKms: 0.36,
    surfaceGravityMs2: 0.25,
    atmosphereType: 'none',
    synodicPeriodDays: 577.26,
    meanLongitudeAtJ2000Deg: 275.4,
    eccentricity: 0.0887,
    longitudeOfPerihelionDeg: 150.7,
    color: '#A9A9A9',
  },
}

// Earth reference for interplanetary calculations
export const EARTH_ORBITAL_DATA = {
  semiMajorAxisAU: 1.0,
  semiMajorAxisKm: AU_KM,
  orbitalPeriodDays: 365.25,
  mu: 3.986004418e5, // km³/s²
  radiusKm: 6371.0,
  meanLongitudeAtJ2000Deg: 100.464,
  eccentricity: 0.01671,
  longitudeOfPerihelionDeg: 102.937,
}
