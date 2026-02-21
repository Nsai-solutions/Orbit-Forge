import { DEG2RAD, RAD2DEG, R_EARTH_EQUATORIAL, OMEGA_EARTH } from './constants'
import type { Vec3 } from '@/types'

export interface OrbitalElements {
  semiMajorAxis: number    // km
  eccentricity: number     // dimensionless
  inclination: number      // degrees
  raan: number             // Right Ascension of Ascending Node (degrees)
  argOfPerigee: number     // degrees
  trueAnomaly: number      // degrees
}

export interface GeodeticCoord {
  lat: number  // degrees
  lon: number  // degrees
  alt: number  // km
}

/**
 * Convert Keplerian orbital elements to ECI Cartesian position and velocity
 * Uses standard transformation from orbital mechanics
 */
export function keplerianToCartesian(
  elements: OrbitalElements,
  mu: number // km^3/s^2
): { position: Vec3; velocity: Vec3 } {
  const a = elements.semiMajorAxis
  const e = elements.eccentricity
  const i = elements.inclination * DEG2RAD
  const omega = elements.raan * DEG2RAD
  const w = elements.argOfPerigee * DEG2RAD
  const nu = elements.trueAnomaly * DEG2RAD

  // Semi-latus rectum
  const p = a * (1 - e * e)

  // Distance
  const r = p / (1 + e * Math.cos(nu))

  // Position in perifocal frame (PQW)
  const rPQW: Vec3 = {
    x: r * Math.cos(nu),
    y: r * Math.sin(nu),
    z: 0,
  }

  // Velocity in perifocal frame
  const sqrtMuP = Math.sqrt(mu / p)
  const vPQW: Vec3 = {
    x: -sqrtMuP * Math.sin(nu),
    y: sqrtMuP * (e + Math.cos(nu)),
    z: 0,
  }

  // Rotation matrix elements (PQW to ECI)
  const cosO = Math.cos(omega)
  const sinO = Math.sin(omega)
  const cosI = Math.cos(i)
  const sinI = Math.sin(i)
  const cosW = Math.cos(w)
  const sinW = Math.sin(w)

  // Transform to ECI
  const position: Vec3 = {
    x: (cosO * cosW - sinO * sinW * cosI) * rPQW.x + (-cosO * sinW - sinO * cosW * cosI) * rPQW.y,
    y: (sinO * cosW + cosO * sinW * cosI) * rPQW.x + (-sinO * sinW + cosO * cosW * cosI) * rPQW.y,
    z: (sinW * sinI) * rPQW.x + (cosW * sinI) * rPQW.y,
  }

  const velocity: Vec3 = {
    x: (cosO * cosW - sinO * sinW * cosI) * vPQW.x + (-cosO * sinW - sinO * cosW * cosI) * vPQW.y,
    y: (sinO * cosW + cosO * sinW * cosI) * vPQW.x + (-sinO * sinW + cosO * cosW * cosI) * vPQW.y,
    z: (sinW * sinI) * vPQW.x + (cosW * sinI) * vPQW.y,
  }

  return { position, velocity }
}

/**
 * Convert ECI to ECEF using Greenwich Mean Sidereal Time
 */
export function eciToEcef(eci: Vec3, gmst: number): Vec3 {
  const cosG = Math.cos(gmst)
  const sinG = Math.sin(gmst)

  return {
    x: cosG * eci.x + sinG * eci.y,
    y: -sinG * eci.x + cosG * eci.y,
    z: eci.z,
  }
}

/**
 * Convert ECEF to geodetic coordinates (WGS84 approximation)
 */
export function ecefToGeodetic(ecef: Vec3): GeodeticCoord {
  const x = ecef.x
  const y = ecef.y
  const z = ecef.z

  const r = Math.sqrt(x * x + y * y + z * z)
  const lon = Math.atan2(y, x) * RAD2DEG
  const lat = Math.asin(z / r) * RAD2DEG
  const alt = r - R_EARTH_EQUATORIAL

  return { lat, lon, alt }
}

/**
 * Convert geodetic coordinates to ECEF
 */
export function geodeticToEcef(coord: GeodeticCoord): Vec3 {
  const lat = coord.lat * DEG2RAD
  const lon = coord.lon * DEG2RAD
  const r = R_EARTH_EQUATORIAL + coord.alt

  return {
    x: r * Math.cos(lat) * Math.cos(lon),
    y: r * Math.cos(lat) * Math.sin(lon),
    z: r * Math.sin(lat),
  }
}

/**
 * Convert geodetic to Three.js coordinates on unit sphere
 * Note: Three.js uses Y-up, so we map:
 *   x = cos(lat) * cos(lon)
 *   y = sin(lat)
 *   z = -cos(lat) * sin(lon)
 */
export function geodeticToThreeJS(lat: number, lon: number, radius = 1): Vec3 {
  const latRad = lat * DEG2RAD
  const lonRad = lon * DEG2RAD

  return {
    x: radius * Math.cos(latRad) * Math.cos(lonRad),
    y: radius * Math.sin(latRad),
    z: -radius * Math.cos(latRad) * Math.sin(lonRad),
  }
}

/**
 * Convert ECI position to Three.js coordinates (unit: Earth radii)
 * ECI: x=vernal equinox, y=90deg east, z=north pole
 * Three.js: x=right, y=up, z=toward camera
 * NOTE: This produces ECI-aligned positions. For Earth-fixed rendering,
 * use eciToEcefThreeJS instead.
 */
export function eciToThreeJS(eci: Vec3, earthRadii = true): Vec3 {
  const scale = earthRadii ? 1 / R_EARTH_EQUATORIAL : 1
  return {
    x: eci.x * scale,
    y: eci.z * scale,
    z: -eci.y * scale,
  }
}

/**
 * Convert ECI position to ECEF-aligned Three.js coordinates.
 * Applies GMST rotation so the result is consistent with the Earth globe
 * texture, ground stations, and ground tracks (all in ECEF frame).
 */
export function eciToEcefThreeJS(eci: Vec3, gmst: number): Vec3 {
  const ecef = eciToEcef(eci, gmst)
  const scale = 1 / R_EARTH_EQUATORIAL
  return {
    x: ecef.x * scale,
    y: ecef.z * scale,
    z: -ecef.y * scale,
  }
}
