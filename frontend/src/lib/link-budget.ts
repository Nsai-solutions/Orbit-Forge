import { R_EARTH_EQUATORIAL, C_LIGHT, K_BOLTZMANN, DEG2RAD } from './constants'
import type { FrequencyBand } from '@/types/mission'

/**
 * Center frequencies for each band (Hz)
 */
export const BAND_FREQUENCIES: Record<FrequencyBand, number> = {
  UHF: 437e6,        // 437 MHz (amateur/cubesat UHF)
  'S-band': 2.2e9,   // 2.2 GHz
  'X-band': 8.2e9,   // 8.2 GHz
  'Ka-band': 26.5e9, // 26.5 GHz
}

// ─── Communications Configuration ───

export type Modulation = 'BPSK' | 'QPSK' | '8PSK'

/** Required Eb/N0 (dB) for each modulation at ~1e-5 BER with margin */
export const MODULATION_EBN0: Record<Modulation, number> = {
  BPSK: 10,
  QPSK: 12,
  '8PSK': 14,
}

/** Default system noise temperatures by frequency band */
export const BAND_NOISE_TEMPS: Record<FrequencyBand, number> = {
  UHF: 290,
  'S-band': 150,
  'X-band': 75,
  'Ka-band': 75,
}

export interface CommConfig {
  // Satellite transmitter
  frequencyMHz: number
  frequencyBand: FrequencyBand
  txPowerW: number
  satAntennaGainDbi: number

  // Ground station receiver
  gsAntennaGainDbi: number
  gsNoiseTempK: number
  minOperationalElDeg: number

  // Data link
  dataRateKbps: number
  modulation: Modulation
  rainFadeDb: number
}

export const DEFAULT_COMM_CONFIG: CommConfig = {
  frequencyMHz: 437,
  frequencyBand: 'UHF',
  txPowerW: 2,
  satAntennaGainDbi: 2,
  gsAntennaGainDbi: 12,
  gsNoiseTempK: 290,
  minOperationalElDeg: 10,
  dataRateKbps: 9.6,
  modulation: 'BPSK',
  rainFadeDb: 0,
}

export interface CommPreset {
  label: string
  config: CommConfig
}

export const COMM_PRESETS: CommPreset[] = [
  {
    label: 'CubeSat UHF',
    config: {
      frequencyMHz: 437, frequencyBand: 'UHF', txPowerW: 2, satAntennaGainDbi: 2,
      gsAntennaGainDbi: 12, gsNoiseTempK: 290, minOperationalElDeg: 10,
      dataRateKbps: 9.6, modulation: 'BPSK', rainFadeDb: 0,
    },
  },
  {
    label: 'CubeSat S-band',
    config: {
      frequencyMHz: 2200, frequencyBand: 'S-band', txPowerW: 5, satAntennaGainDbi: 6,
      gsAntennaGainDbi: 20, gsNoiseTempK: 150, minOperationalElDeg: 10,
      dataRateKbps: 1000, modulation: 'QPSK', rainFadeDb: 0,
    },
  },
  {
    label: 'SmallSat X-band',
    config: {
      frequencyMHz: 8200, frequencyBand: 'X-band', txPowerW: 10, satAntennaGainDbi: 18,
      gsAntennaGainDbi: 34, gsNoiseTempK: 75, minOperationalElDeg: 10,
      dataRateKbps: 50000, modulation: 'QPSK', rainFadeDb: 2,
    },
  },
  {
    label: 'LEO Broadband',
    config: {
      frequencyMHz: 12000, frequencyBand: 'Ka-band', txPowerW: 20, satAntennaGainDbi: 30,
      gsAntennaGainDbi: 38, gsNoiseTempK: 75, minOperationalElDeg: 10,
      dataRateKbps: 100000, modulation: '8PSK', rainFadeDb: 3,
    },
  },
]

// ─── Atmospheric Loss Model (ITU-R P.676 simplified) ───

/**
 * Compute elevation-dependent atmospheric loss in dB.
 * Based on zenith attenuation scaled by airmass (1/sin(el)).
 */
export function atmosphericLoss(frequencyMHz: number, elevationDeg: number): number {
  const elevRad = Math.max(elevationDeg, 5) * DEG2RAD
  const airmass = Math.min(1 / Math.sin(elevRad), 10) // clamp for low el

  let zenithLoss: number
  if (frequencyMHz < 1000) {
    zenithLoss = 0.5   // UHF
  } else if (frequencyMHz < 4000) {
    zenithLoss = 1.0   // S-band
  } else if (frequencyMHz < 12000) {
    zenithLoss = 2.0   // X-band
  } else if (frequencyMHz < 20000) {
    zenithLoss = 3.5   // Ku-band
  } else {
    zenithLoss = 5.0   // Ka-band and above
  }

  return zenithLoss * airmass
}

// ─── Waterfall Chart Data ───

export interface WaterfallStep {
  label: string
  value: number     // dB
  cumulative: number // running total
  isGain: boolean
}

/**
 * Compute waterfall chart data for a link budget at a given elevation.
 */
export function computeWaterfallSteps(
  comm: CommConfig,
  altitudeKm: number,
  elevationDeg: number,
): WaterfallStep[] {
  const freqHz = comm.frequencyMHz * 1e6
  const dist = slantRange(altitudeKm, elevationDeg)
  const txPowerDbw = wToDbw(comm.txPowerW)
  const fspl = freeSpacePathLoss(dist, freqHz)
  const atmLoss = atmosphericLoss(comm.frequencyMHz, elevationDeg)
  const requiredEbN0 = MODULATION_EBN0[comm.modulation]

  // C/N0 computation
  const eirp = txPowerDbw + comm.satAntennaGainDbi
  const gOverT = comm.gsAntennaGainDbi - 10 * Math.log10(comm.gsNoiseTempK)
  const cn0 = eirp - fspl - atmLoss - comm.rainFadeDb + gOverT + 228.6 // 228.6 = -10*log10(k_B)
  const requiredCn0 = requiredEbN0 + 10 * Math.log10(comm.dataRateKbps * 1000)
  const margin = cn0 - requiredCn0

  const steps: WaterfallStep[] = []
  let cum = 0

  // Tx Power
  cum = txPowerDbw
  steps.push({ label: 'Tx Power', value: txPowerDbw, cumulative: cum, isGain: true })

  // Sat Antenna Gain
  cum += comm.satAntennaGainDbi
  steps.push({ label: 'Sat Antenna', value: comm.satAntennaGainDbi, cumulative: cum, isGain: true })

  // FSPL
  cum -= fspl
  steps.push({ label: 'FSPL', value: -fspl, cumulative: cum, isGain: false })

  // Atmospheric Loss
  cum -= atmLoss
  steps.push({ label: 'Atm Loss', value: -atmLoss, cumulative: cum, isGain: false })

  // Rain Fade
  if (comm.rainFadeDb > 0) {
    cum -= comm.rainFadeDb
    steps.push({ label: 'Rain Fade', value: -comm.rainFadeDb, cumulative: cum, isGain: false })
  }

  // GS Antenna Gain
  cum += comm.gsAntennaGainDbi
  steps.push({ label: 'GS Antenna', value: comm.gsAntennaGainDbi, cumulative: cum, isGain: true })

  // Final: show margin relative to required C/N0
  steps.push({ label: 'Link Margin', value: margin, cumulative: margin, isGain: margin >= 0 })

  return steps
}

// ─── Per-Pass Link Budget from CommConfig ───

export interface PassLinkResult {
  linkMarginDb: number
  cn0Dbhz: number
  maxDataRateKbps: number
  fsplDb: number
  slantRangeKm: number
  atmosphericLossDb: number
  dataVolumeMB: number
  marginStatus: 'nominal' | 'warning' | 'critical'
}

/**
 * Compute link budget for a single pass using CommConfig.
 */
export function computePassLinkBudget(
  comm: CommConfig,
  altitudeKm: number,
  maxElevationDeg: number,
  durationSec: number,
): PassLinkResult {
  const freqHz = comm.frequencyMHz * 1e6
  const dist = slantRange(altitudeKm, maxElevationDeg)
  const fspl = freeSpacePathLoss(dist, freqHz)
  const atmLoss = atmosphericLoss(comm.frequencyMHz, maxElevationDeg)
  const txPowerDbw = wToDbw(comm.txPowerW)

  const eirp = txPowerDbw + comm.satAntennaGainDbi
  const gOverT = comm.gsAntennaGainDbi - 10 * Math.log10(comm.gsNoiseTempK)
  const cn0 = eirp - fspl - atmLoss - comm.rainFadeDb + gOverT + 228.6

  const requiredEbN0 = MODULATION_EBN0[comm.modulation]
  const requiredCn0 = requiredEbN0 + 10 * Math.log10(comm.dataRateKbps * 1000)
  const margin = cn0 - requiredCn0

  // Max achievable data rate
  const maxBps = Math.pow(10, (cn0 - requiredEbN0) / 10)
  const maxDataRateKbps = maxBps / 1000

  // Data volume: effective duration minus 15s overhead
  const effectiveSec = Math.max(0, durationSec - 15)
  const dataBits = comm.dataRateKbps * 1000 * effectiveSec
  const dataVolumeMB = dataBits / 8 / (1024 * 1024)

  const marginStatus: PassLinkResult['marginStatus'] =
    margin >= 3 ? 'nominal' : margin >= 0 ? 'warning' : 'critical'

  return {
    linkMarginDb: margin,
    cn0Dbhz: cn0,
    maxDataRateKbps,
    fsplDb: fspl,
    slantRangeKm: dist,
    atmosphericLossDb: atmLoss,
    dataVolumeMB: margin >= 0 ? dataVolumeMB : 0,
    marginStatus,
  }
}

export interface LinkBudgetParams {
  // Transmitter (spacecraft)
  txPowerW: number          // Transmit power in watts
  txAntennaGainDbi: number  // Transmit antenna gain in dBi
  frequencyBand: FrequencyBand

  // Receiver (ground station)
  rxAntennaGainDbi: number  // Ground antenna gain in dBi (default ~12 for small dish)
  systemNoiseTempK: number  // System noise temperature in Kelvin (default ~400)

  // Link parameters
  dataRateKbps: number      // Data rate in kbps
  requiredEbN0Db: number    // Required Eb/N0 for BER (default ~9.6 for BPSK 1e-5)

  // Losses
  atmosphericLossDb: number // Atmospheric absorption (default 0.5)
  rainLossDb: number        // Rain attenuation (default 0)
  pointingLossDb: number    // Pointing/polarization loss (default 1)
  miscLossDb: number        // Implementation/misc loss (default 2)
}

export interface LinkBudgetResult {
  eirpDbw: number           // Effective Isotropic Radiated Power
  fsplDb: number            // Free Space Path Loss
  totalLossDb: number       // All losses combined
  rxPowerDbw: number        // Received power
  noiseFloorDbw: number     // Noise floor (kTB)
  cnDb: number              // Carrier to noise ratio
  ebN0Db: number            // Energy per bit to noise spectral density
  linkMarginDb: number      // Margin above required Eb/N0
  slantRangeKm: number      // Distance to satellite
  frequencyHz: number       // Center frequency used
  marginStatus: 'nominal' | 'warning' | 'critical'
}

/**
 * Convert watts to dBW
 */
export function wToDbw(watts: number): number {
  return 10 * Math.log10(Math.max(watts, 1e-30))
}

/**
 * Compute slant range from ground station to satellite
 * Uses Earth geometry: R_e = Earth radius, h = altitude, el = elevation angle
 */
export function slantRange(altitudeKm: number, elevationDeg: number): number {
  const Re = R_EARTH_EQUATORIAL
  const h = altitudeKm
  const el = elevationDeg * DEG2RAD

  // From trigonometry of Earth geometry:
  // d = -Re*sin(el) + sqrt((Re*sin(el))^2 + 2*Re*h + h^2)
  const sinEl = Math.sin(el)
  return -Re * sinEl + Math.sqrt(Re * Re * sinEl * sinEl + 2 * Re * h + h * h)
}

/**
 * Compute Free Space Path Loss in dB
 * FSPL = 20*log10(4*pi*d*f/c)
 */
export function freeSpacePathLoss(distanceKm: number, frequencyHz: number): number {
  const distanceM = distanceKm * 1000
  return 20 * Math.log10((4 * Math.PI * distanceM * frequencyHz) / C_LIGHT)
}

/**
 * Compute full link budget at a given elevation angle
 */
export function computeLinkBudget(
  params: LinkBudgetParams,
  altitudeKm: number,
  elevationDeg: number,
): LinkBudgetResult {
  const frequencyHz = BAND_FREQUENCIES[params.frequencyBand]
  const distKm = slantRange(altitudeKm, elevationDeg)

  // EIRP = Tx Power (dBW) + Tx Antenna Gain (dBi)
  const txPowerDbw = wToDbw(params.txPowerW)
  const eirpDbw = txPowerDbw + params.txAntennaGainDbi

  // Free space path loss
  const fsplDb = freeSpacePathLoss(distKm, frequencyHz)

  // Total losses
  const totalLossDb = fsplDb + params.atmosphericLossDb + params.rainLossDb + params.pointingLossDb + params.miscLossDb

  // Received power = EIRP - total losses + Rx antenna gain
  const rxPowerDbw = eirpDbw - totalLossDb + params.rxAntennaGainDbi

  // Noise floor: N = k * T * B
  // B = data rate in bits/sec
  const dataRateBps = params.dataRateKbps * 1000
  const noiseFloorDbw = wToDbw(K_BOLTZMANN * params.systemNoiseTempK * dataRateBps)

  // C/N ratio
  const cnDb = rxPowerDbw - noiseFloorDbw

  // Eb/N0 = C/N (since we used data rate as bandwidth, Eb/N0 ~ C/N for BPSK)
  const ebN0Db = cnDb

  // Link margin
  const linkMarginDb = ebN0Db - params.requiredEbN0Db

  const marginStatus: LinkBudgetResult['marginStatus'] =
    linkMarginDb >= 3 ? 'nominal' :
    linkMarginDb >= 0 ? 'warning' : 'critical'

  return {
    eirpDbw,
    fsplDb,
    totalLossDb,
    rxPowerDbw,
    noiseFloorDbw,
    cnDb,
    ebN0Db,
    linkMarginDb,
    slantRangeKm: distKm,
    frequencyHz,
    marginStatus,
  }
}

/**
 * Compute link margin profile across elevation angles (for charting)
 */
export interface LinkMarginPoint {
  elevationDeg: number
  linkMarginDb: number
  ebN0Db: number
  slantRangeKm: number
  fsplDb: number
  maxDataRateKbps: number  // max achievable data rate at this elevation
}

export function computeLinkMarginProfile(
  params: LinkBudgetParams,
  altitudeKm: number,
  minEl: number = 5,
  maxEl: number = 90,
  step: number = 1,
): LinkMarginPoint[] {
  const points: LinkMarginPoint[] = []

  for (let el = minEl; el <= maxEl; el += step) {
    const result = computeLinkBudget(params, altitudeKm, el)

    // Max achievable data rate: the rate where Eb/N0 exactly equals required Eb/N0
    // Eb/N0 = C/N = (EIRP - losses + Rx gain) - (k*T*B) where B = data rate
    // At the limit: available C/N0 = EIRP - losses + RxGain - 10*log10(k*T)
    // Max data rate = 10^((available_CN0 - required_EbN0) / 10) in bps
    const frequencyHz = BAND_FREQUENCIES[params.frequencyBand]
    const distKm = slantRange(altitudeKm, el)
    const txPowerDbw = 10 * Math.log10(Math.max(params.txPowerW, 1e-30))
    const eirpDbw = txPowerDbw + params.txAntennaGainDbi
    const fspl = freeSpacePathLoss(distKm, frequencyHz)
    const totalLoss = fspl + params.atmosphericLossDb + params.rainLossDb + params.pointingLossDb + params.miscLossDb
    const cn0Dbhz = eirpDbw - totalLoss + params.rxAntennaGainDbi - 10 * Math.log10(K_BOLTZMANN * params.systemNoiseTempK)
    const maxBps = Math.pow(10, (cn0Dbhz - params.requiredEbN0Db) / 10)
    const maxDataRateKbps = maxBps / 1000

    points.push({
      elevationDeg: el,
      linkMarginDb: result.linkMarginDb,
      ebN0Db: result.ebN0Db,
      slantRangeKm: result.slantRangeKm,
      fsplDb: result.fsplDb,
      maxDataRateKbps,
    })
  }

  return points
}

/**
 * Get default link budget params from spacecraft config
 */
export function getDefaultLinkParams(spacecraft: {
  transmitPower: number
  antennaGain: number
  frequencyBand: FrequencyBand
  dataRate: number
}): LinkBudgetParams {
  return {
    txPowerW: spacecraft.transmitPower,
    txAntennaGainDbi: spacecraft.antennaGain,
    frequencyBand: spacecraft.frequencyBand,
    dataRateKbps: spacecraft.dataRate,
    rxAntennaGainDbi: 12,
    systemNoiseTempK: 400,
    requiredEbN0Db: 9.6,
    atmosphericLossDb: 0.5,
    rainLossDb: 0,
    pointingLossDb: 1,
    miscLossDb: 2,
  }
}
