import { R_EARTH_EQUATORIAL, SOLAR_FLUX } from './constants'
import type { CubeSatSize } from '@/types/mission'

// ─── Constants ───

const STEFAN_BOLTZMANN = 5.670374419e-8  // W/(m^2 K^4)
const EARTH_IR = 240                      // W/m^2 (Earth infrared emission)
const EARTH_ALBEDO = 0.3                  // Average Earth albedo factor

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
 * F = 1 - sqrt(1 - (Re/(Re+h))^2)
 */
export function computeEarthViewFactor(altitudeKm: number): number {
  const ratio = R_EARTH_EQUATORIAL / (R_EARTH_EQUATORIAL + altitudeKm)
  return 1 - Math.sqrt(1 - ratio * ratio)
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
  }
  return areas[size] || areas['3U']
}

/**
 * Sun-facing area (projected cross-section) for a CubeSat
 */
export function cubeSatSunFacingArea(size: CubeSatSize): number {
  const areas: Record<CubeSatSize, number> = {
    '1U': 0.01,       // 10x10 cm
    '1.5U': 0.01,
    '2U': 0.01,
    '3U': 0.01,       // 10x10 cm face
    '6U': 0.02,       // 20x10 cm face
    '12U': 0.04,      // 20x20 cm face
  }
  return areas[size] || areas['3U']
}

/**
 * Earth-facing area (nadir face)
 */
export function cubeSatEarthFacingArea(size: CubeSatSize): number {
  return cubeSatSunFacingArea(size) // Same projected area
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

  // Equilibrium temperature: T = (Q / (epsilon * sigma * A))^(1/4)
  const effectiveRadiatingArea = material.emissivity * STEFAN_BOLTZMANN * totalSurfaceArea
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

  // Start with hot-case steady state temperature
  const hotCase = computeSteadyStateTemp(material, altitudeKm, true, internalPowerW, sunArea, earthArea, totalArea)
  let currentTempK = hotCase.temperatureK

  const points: ThermalProfilePoint[] = []

  for (let i = 0; i < steps; i++) {
    const posDeg = (i / steps) * 360
    const timeMin = (i / steps) * periodMin
    const inSunlight = posDeg < eclipseStart || posDeg > eclipseEnd

    const viewFactor = computeEarthViewFactor(altitudeKm)

    // Heat inputs
    const solarFluxW = inSunlight ? material.absorptivity * SOLAR_FLUX * sunArea : 0
    const earthIrFluxW = material.emissivity * EARTH_IR * viewFactor * earthArea
    const albedoFluxW = inSunlight ? material.absorptivity * SOLAR_FLUX * EARTH_ALBEDO * viewFactor * earthArea : 0
    const totalInputW = solarFluxW + earthIrFluxW + albedoFluxW + internalPowerW

    // Radiative cooling
    const radiatedW = material.emissivity * STEFAN_BOLTZMANN * totalArea * Math.pow(currentTempK, 4)

    // Net heat flow
    const netPowerW = totalInputW - radiatedW

    // Update temperature: dT = Q * dt / C
    if (thermalMass > 0) {
      currentTempK += (netPowerW * dt) / thermalMass
    }

    // Clamp to physical bounds
    currentTempK = Math.max(3, currentTempK) // Can't go below ~3K

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
  const hotCase = computeSteadyStateTemp(material, altitudeKm, true, internalPowerW, sunArea, earthArea, totalArea)
  // Cold case: eclipse
  const coldCase = computeSteadyStateTemp(material, altitudeKm, false, internalPowerW * 0.5, sunArea, earthArea, totalArea)

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
