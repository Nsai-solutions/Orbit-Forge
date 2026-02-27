import { R_EARTH_EQUATORIAL, SOLAR_FLUX } from './constants'
import type { CubeSatSize } from '@/types/mission'

// ─── Constants ───

const STEFAN_BOLTZMANN = 5.670374419e-8  // W/(m^2 K^4)
const EARTH_IR = 240                      // W/m^2 (Earth infrared emission)
const EARTH_ALBEDO = 0.3                  // Average Earth albedo factor

// Radiation efficiency: not all surface area radiates freely
// (solar panels, components, mounting hardware block radiation)
const RADIATION_EFFICIENCY = 0.65

// ─── Surface Material Presets ───

export interface SurfaceMaterial {
  name: string
  absorptivity: number  // Solar absorptivity (alpha)
  emissivity: number    // IR emissivity (epsilon)
}

export const SURFACE_MATERIALS: Record<string, SurfaceMaterial> = {
  'black-anodized': { name: 'Black Anodized Aluminum', absorptivity: 0.86, emissivity: 0.86 },
  'solar-cells': { name: 'Solar Cells', absorptivity: 0.75, emissivity: 0.82 },
  'white-paint': { name: 'White Paint', absorptivity: 0.20, emissivity: 0.90 },
  'bare-aluminum': { name: 'Bare Aluminum', absorptivity: 0.15, emissivity: 0.05 },
  'gold-foil': { name: 'Gold Foil', absorptivity: 0.25, emissivity: 0.04 },
  'mli': { name: 'MLI Blanket', absorptivity: 0.10, emissivity: 0.03 },
}

export const DEFAULT_MATERIAL = 'black-anodized'

// ─── Geometry Helpers ───

/**
 * Compute Earth view factor from orbital altitude
 * Standard flat-plate-to-sphere: F = sin^2(rho) = (Re/r)^2
 * where rho is the Earth half-angle subtended at the spacecraft
 */
export function computeEarthViewFactor(altitudeKm: number): number {
  const ratio = R_EARTH_EQUATORIAL / (R_EARTH_EQUATORIAL + altitudeKm)
  return ratio * ratio
}

/**
 * Total surface area of a CubeSat for radiation
 */
export function cubeSatSurfaceArea(size: CubeSatSize): number {
  const areas: Record<CubeSatSize, number> = {
    '1U': 6 * 0.01,              // 6 faces * 10x10 cm
    '1.5U': 2 * 0.01 + 4 * 0.015,
    '2U': 2 * 0.01 + 4 * 0.02,
    '3U': 2 * 0.01 + 4 * 0.03,   // 2*(10x10) + 4*(10x30)
    '6U': 2 * 0.02 + 2 * 0.06 + 2 * 0.03,
    '12U': 2 * 0.04 + 2 * 0.06 + 2 * 0.06,
    'SmallSat': 3.0,              // ~1m cube approx
    'Custom': 2 * 0.01 + 4 * 0.03,
  }
  return areas[size] || areas['3U']
}

/**
 * Sun-facing area (projected cross-section) for a CubeSat.
 * Uses the largest face (long face) since the sun typically illuminates
 * a long side for nadir-pointing spacecraft.
 */
export function cubeSatSunFacingArea(size: CubeSatSize): number {
  const areas: Record<CubeSatSize, number> = {
    '1U': 0.01,       // 10x10 cm (cube, all faces equal)
    '1.5U': 0.015,    // 10x15 cm long face
    '2U': 0.02,       // 10x20 cm long face
    '3U': 0.03,       // 10x30 cm long face
    '6U': 0.06,       // 20x30 cm long face
    '12U': 0.06,      // 20x30 cm face
    'SmallSat': 0.5,   // user should adjust
    'Custom': 0.03,
  }
  return areas[size] || areas['3U']
}

/**
 * Earth-facing area — Earth subtends a large angle at LEO so it
 * illuminates roughly the same effective area as the sun-facing side.
 */
export function cubeSatEarthFacingArea(size: CubeSatSize): number {
  return cubeSatSunFacingArea(size)
}

// ─── Thermal Computations ───

export interface SteadyStateResult {
  temperatureK: number
  temperatureC: number
  solarFluxW: number
  earthIrFluxW: number
  albedoFluxW: number
  internalFluxW: number
  totalAbsorbedW: number
  radiatedW: number
}

/**
 * Compute steady-state equilibrium temperature using Stefan-Boltzmann equation
 *
 * Energy balance: Q_absorbed = Q_radiated
 * Q_solar + Q_earth_IR + Q_albedo + Q_internal = epsilon * sigma * A_total * T^4
 */
export function computeSteadyStateTemp(
  material: SurfaceMaterial,
  altitudeKm: number,
  inSunlight: boolean,
  internalPowerW: number,
  sunFacingArea: number,
  earthFacingArea: number,
  totalSurfaceArea: number,
): SteadyStateResult {
  const viewFactor = computeEarthViewFactor(altitudeKm)

  // Solar heat flux (only in sunlight)
  const solarFluxW = inSunlight
    ? material.absorptivity * SOLAR_FLUX * sunFacingArea
    : 0

  // Earth IR heat flux
  const earthIrFluxW = material.emissivity * EARTH_IR * viewFactor * earthFacingArea

  // Albedo heat flux (only in sunlight)
  const albedoFluxW = inSunlight
    ? material.absorptivity * SOLAR_FLUX * EARTH_ALBEDO * viewFactor * earthFacingArea
    : 0

  // Internal heat dissipation
  const internalFluxW = internalPowerW

  // Total absorbed power
  const totalAbsorbedW = solarFluxW + earthIrFluxW + albedoFluxW + internalFluxW

  // Equilibrium temperature: T = (Q / (epsilon * sigma * A_eff))^(1/4)
  // Apply radiation efficiency to account for panels/components blocking radiation
  const effectiveRadArea = totalSurfaceArea * RADIATION_EFFICIENCY
  const effectiveRadiatingArea = material.emissivity * STEFAN_BOLTZMANN * effectiveRadArea
  const temperatureK = effectiveRadiatingArea > 0
    ? Math.pow(totalAbsorbedW / effectiveRadiatingArea, 0.25)
    : 0

  return {
    temperatureK,
    temperatureC: temperatureK - 273.15,
    solarFluxW,
    earthIrFluxW,
    albedoFluxW,
    internalFluxW,
    totalAbsorbedW,
    radiatedW: totalAbsorbedW, // At equilibrium, radiated = absorbed
  }
}

// ─── Orbital Thermal Profile ───

export interface ThermalProfilePoint {
  positionDeg: number    // Orbital position (0-360)
  timeMin: number        // Time in minutes from start
  temperatureC: number   // Temperature in Celsius
  inSunlight: boolean
  solarFluxW: number
  earthIrFluxW: number
  albedoFluxW: number
}

/**
 * Compute temperature profile over one orbit with simplified thermal inertia
 * Uses a time-stepping approach with thermal mass approximation
 */
export function computeThermalProfile(
  material: SurfaceMaterial,
  altitudeKm: number,
  eclipseFraction: number,
  internalPowerW: number,
  size: CubeSatSize,
  massKg: number,
  steps: number = 360,
): ThermalProfilePoint[] {
  const sunArea = cubeSatSunFacingArea(size)
  const earthArea = cubeSatEarthFacingArea(size)
  const totalArea = cubeSatSurfaceArea(size)

  // Orbital period
  const r = (R_EARTH_EQUATORIAL + altitudeKm) * 1000 // meters
  const periodSec = 2 * Math.PI * Math.sqrt(r * r * r / 3.986004418e14)
  const periodMin = periodSec / 60

  // Thermal mass: C = m * c_p (aluminum specific heat ~900 J/kg/K)
  const specificHeat = 900 // J/(kg*K)
  const thermalMass = massKg * specificHeat // J/K

  const dt = periodSec / steps // time step in seconds

  // Eclipse geometry: eclipse centered at 180 degrees
  const eclipseHalfAngle = eclipseFraction * 180 // degrees
  const eclipseStart = 180 - eclipseHalfAngle
  const eclipseEnd = 180 + eclipseHalfAngle

  // Effective radiating area (accounting for panels/components)
  const effectiveRadArea = totalArea * RADIATION_EFFICIENCY
  const viewFactor = computeEarthViewFactor(altitudeKm)

  // Start with hot-case steady state temperature
  const hotCase = computeSteadyStateTemp(material, altitudeKm, true, internalPowerW, sunArea, earthArea, totalArea)
  let currentTempK = hotCase.temperatureK

  // Run 5 orbits to reach periodic steady state, only keep the last orbit
  const totalOrbits = 5
  const points: ThermalProfilePoint[] = []

  for (let orbit = 0; orbit < totalOrbits; orbit++) {
    for (let i = 0; i < steps; i++) {
      const posDeg = (i / steps) * 360
      const timeMin = (i / steps) * periodMin
      const inSunlight = posDeg < eclipseStart || posDeg > eclipseEnd

      // Heat inputs
      const solarFluxW = inSunlight ? material.absorptivity * SOLAR_FLUX * sunArea : 0
      const earthIrFluxW = material.emissivity * EARTH_IR * viewFactor * earthArea
      const albedoFluxW = inSunlight ? material.absorptivity * SOLAR_FLUX * EARTH_ALBEDO * viewFactor * earthArea : 0
      const totalInputW = solarFluxW + earthIrFluxW + albedoFluxW + internalPowerW

      // Radiative cooling (uses effective radiating area)
      const radiatedW = material.emissivity * STEFAN_BOLTZMANN * effectiveRadArea * Math.pow(currentTempK, 4)

      // Net heat flow
      const netPowerW = totalInputW - radiatedW

      // Update temperature: dT = Q * dt / C
      if (thermalMass > 0) {
        currentTempK += (netPowerW * dt) / thermalMass
      }

      // Clamp to physical bounds
      currentTempK = Math.max(3, currentTempK)

      // Only record points from the last orbit
      if (orbit === totalOrbits - 1) {
        points.push({
          positionDeg: posDeg,
          timeMin,
          temperatureC: currentTempK - 273.15,
          inSunlight,
          solarFluxW,
          earthIrFluxW,
          albedoFluxW,
        })
      }
    }
  }

  return points
}

// ─── Summary ───

export interface ThermalSummary {
  hotCaseC: number
  coldCaseC: number
  hotCaseStatus: 'nominal' | 'warning' | 'critical'
  coldCaseStatus: 'nominal' | 'warning' | 'critical'
  recommendation: string
}

export function computeThermalSummary(
  material: SurfaceMaterial,
  altitudeKm: number,
  eclipseFraction: number,
  internalPowerW: number,
  size: CubeSatSize,
): ThermalSummary {
  const sunArea = cubeSatSunFacingArea(size)
  const earthArea = cubeSatEarthFacingArea(size)
  const totalArea = cubeSatSurfaceArea(size)

  // Hot case: full sunlight
  // Note: RADIATION_EFFICIENCY is applied inside computeSteadyStateTemp, so pass totalArea
  const hotCase = computeSteadyStateTemp(material, altitudeKm, true, internalPowerW, sunArea, earthArea, totalArea)
  // Cold case: eclipse with reduced internal power
  const coldCase = computeSteadyStateTemp(material, altitudeKm, false, internalPowerW * 0.3, sunArea, earthArea, totalArea)

  const hotCaseStatus: ThermalSummary['hotCaseStatus'] =
    hotCase.temperatureC > 60 ? 'critical' :
    hotCase.temperatureC > 50 ? 'warning' : 'nominal'

  const coldCaseStatus: ThermalSummary['coldCaseStatus'] =
    coldCase.temperatureC < -20 ? 'critical' :
    coldCase.temperatureC < -10 ? 'warning' : 'nominal'

  const recommendations: string[] = []
  if (coldCase.temperatureC < -10) recommendations.push('Consider heater or MLI for cold survival')
  if (hotCase.temperatureC > 50) recommendations.push('Consider radiator or white paint coating')
  if (recommendations.length === 0) recommendations.push('Thermal environment within typical CubeSat limits')

  return {
    hotCaseC: hotCase.temperatureC,
    coldCaseC: coldCase.temperatureC,
    hotCaseStatus,
    coldCaseStatus,
    recommendation: recommendations.join('. '),
  }
}
