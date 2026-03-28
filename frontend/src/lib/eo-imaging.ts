/**
 * EO Mission Planning — imaging opportunity computation and storage timeline
 */

import { DEG2RAD, RAD2DEG, R_EARTH_EQUATORIAL } from './constants'
import { OrbitalElements, eciToEcef, ecefToGeodetic } from './coordinate-transforms'
import { getPositionAtTime } from './pass-prediction'
import type { SatellitePass } from './pass-prediction'
import { dateToGMST } from './time-utils'
import { computeEOAnalysis } from './payload-eo'
import type { EOConfig, SharedPayloadConfig } from '@/types/payload'
import type { ImagingTarget } from '@/stores/eo-planning-slice'

// ─── Types ───

export interface ImagingOpportunity {
  targetId: string
  targetName: string
  startTime: Date
  endTime: Date
  durationSec: number
  offNadirDeg: number    // minimum off-nadir during window
  gsdAtTarget: number    // meters at the off-nadir angle
  dataVolumeMB: number
  sunElevDeg: number     // approximate sun elevation at target
  viable: boolean        // sun elevation > minSunElev
}

export interface StorageEvent {
  time: Date
  type: 'imaging' | 'downlink'
  deltaMB: number        // positive = fill, negative = drain
  cumulativeMB: number
  label: string
}

// ─── Haversine distance ───

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG2RAD
  const dLon = (lon2 - lon1) * DEG2RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH_EQUATORIAL * Math.asin(Math.sqrt(a))
}

// ─── Approximate sun elevation at a surface point ───

function approxSunElevation(lat: number, lon: number, date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  )
  // Solar declination (approximate)
  const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * DEG2RAD)

  // Hour angle
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60
  const solarNoon = 12 - lon / 15
  const hourAngle = (utcHours - solarNoon) * 15

  // Elevation
  const sinElev =
    Math.sin(lat * DEG2RAD) * Math.sin(declination * DEG2RAD) +
    Math.cos(lat * DEG2RAD) * Math.cos(declination * DEG2RAD) * Math.cos(hourAngle * DEG2RAD)

  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * RAD2DEG
}

// ─── Imaging Opportunity Computation ───

export function computeImagingOpportunities(
  elements: OrbitalElements,
  epoch: Date,
  targets: ImagingTarget[],
  eoConfig: EOConfig,
  sharedConfig: SharedPayloadConfig,
  altitudeKm: number,
  inclinationDeg: number,
  durationDays: number,
  stepSec = 30,
): ImagingOpportunity[] {
  const activeTargets = targets.filter((t) => t.active)
  if (activeTargets.length === 0) return []

  const eoAnalysis = computeEOAnalysis(eoConfig, sharedConfig, altitudeKm, inclinationDeg)
  const halfSwathKm = eoAnalysis.swathWidth / 2

  // Maximum access radius: off-nadir steering + half swath
  const maxOffNadirRad = eoConfig.maxOffNadir * DEG2RAD
  const steeringReachKm = altitudeKm * Math.tan(maxOffNadirRad)
  const accessRadiusKm = steeringReachKm + halfSwathKm

  const totalSteps = Math.ceil((durationDays * 86400) / stepSec)
  const epochMs = epoch.getTime()

  // Data rate in MB/s from Mbps
  const dataRateMBps = sharedConfig.dataRate / 8

  // GSD at off-nadir helper
  const focalM = eoConfig.focalLength / 1000
  const pixelM = eoConfig.pixelSize * 1e-6
  const H = altitudeKm * 1000

  function gsdAtOffNadir(offNadirDeg: number): number {
    const rad = offNadirDeg * DEG2RAD
    const slant = H / Math.cos(rad)
    return (pixelM * slant) / focalM / Math.cos(rad)
  }

  // Track open access windows per target
  interface OpenWindow {
    startTime: number // ms
    minDistKm: number
    closestStepMs: number
  }
  const openWindows = new Map<string, OpenWindow>()
  const opportunities: ImagingOpportunity[] = []

  for (let step = 0; step <= totalSteps; step++) {
    const dtSec = step * stepSec
    const tMs = epochMs + dtSec * 1000
    const date = new Date(tMs)
    const gmst = dateToGMST(date)

    // Get satellite subsatellite point
    const posEci = getPositionAtTime(elements, epoch, dtSec)
    const posEcef = eciToEcef(posEci, gmst)
    const geo = ecefToGeodetic(posEcef)

    for (const target of activeTargets) {
      const distKm = haversineKm(geo.lat, geo.lon, target.lat, target.lon)
      const inAccess = distKm <= accessRadiusKm

      const windowKey = target.id
      const openWindow = openWindows.get(windowKey)

      if (inAccess && !openWindow) {
        // Start new window
        openWindows.set(windowKey, {
          startTime: tMs,
          minDistKm: distKm,
          closestStepMs: tMs,
        })
      } else if (inAccess && openWindow) {
        // Update if closer
        if (distKm < openWindow.minDistKm) {
          openWindow.minDistKm = distKm
          openWindow.closestStepMs = tMs
        }
      } else if (!inAccess && openWindow) {
        // Close window — create opportunity
        const startDate = new Date(openWindow.startTime)
        const endDate = date
        const durSec = (tMs - openWindow.startTime) / 1000

        // Off-nadir angle from minimum distance
        const offNadirDeg = Math.atan2(openWindow.minDistKm, altitudeKm) * RAD2DEG

        // Only record if reasonable duration and within off-nadir limit
        if (durSec >= 5 && offNadirDeg <= eoConfig.maxOffNadir) {
          const midTime = new Date(openWindow.closestStepMs)
          const sunElev = approxSunElevation(target.lat, target.lon, midTime)

          opportunities.push({
            targetId: target.id,
            targetName: target.name,
            startTime: startDate,
            endTime: endDate,
            durationSec: durSec,
            offNadirDeg,
            gsdAtTarget: gsdAtOffNadir(offNadirDeg),
            dataVolumeMB: dataRateMBps * Math.min(durSec, 60), // cap imaging to 60s per pass
            sunElevDeg: sunElev,
            viable: sunElev >= eoConfig.minSunElev,
          })
        }

        openWindows.delete(windowKey)
      }
    }
  }

  // Sort by start time
  opportunities.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  return opportunities
}

// ─── Storage Timeline ───

export function computeStorageTimeline(
  imagingOpps: ImagingOpportunity[],
  downlinkPasses: SatellitePass[],
  storageCapacityGB: number,
): StorageEvent[] {
  const capMB = storageCapacityGB * 1024

  // Build event list
  const events: StorageEvent[] = []

  // Imaging events (viable only)
  for (const opp of imagingOpps) {
    if (!opp.viable) continue
    events.push({
      time: opp.startTime,
      type: 'imaging',
      deltaMB: opp.dataVolumeMB,
      cumulativeMB: 0, // computed below
      label: `Image ${opp.targetName}`,
    })
  }

  // Downlink events
  for (const pass of downlinkPasses) {
    if (!pass.dataVolumeMB || pass.dataVolumeMB <= 0) continue
    events.push({
      time: pass.aos,
      type: 'downlink',
      deltaMB: -pass.dataVolumeMB,
      cumulativeMB: 0,
      label: `Downlink via ${pass.station}`,
    })
  }

  // Sort by time
  events.sort((a, b) => a.time.getTime() - b.time.getTime())

  // Walk forward computing cumulative
  let cumMB = 0
  for (const ev of events) {
    cumMB += ev.deltaMB
    cumMB = Math.max(0, Math.min(cumMB, capMB))
    ev.cumulativeMB = cumMB
  }

  return events
}
