import { R_EARTH_EQUATORIAL, C_LIGHT, K_BOLTZMANN, DEG2RAD } from './constants'
import type { FrequencyBand } from '@/types/mission'

/**
 * Center frequencies for each band (Hz)
 */
const BAND_FREQUENCIES: Record<FrequencyBand, number> = {
  UHF: 437e6,        // 437 MHz (amateur/cubesat UHF)
  'S-band': 2.2e9,   // 2.2 GHz
  'X-band': 8.2e9,   // 8.2 GHz
  'Ka-band': 26.5e9, // 26.5 GHz
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
function wToDbw(watts: number): number {
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
    points.push({
      elevationDeg: el,
      linkMarginDb: result.linkMarginDb,
      ebN0Db: result.ebN0Db,
      slantRangeKm: result.slantRangeKm,
      fsplDb: result.fsplDb,
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
