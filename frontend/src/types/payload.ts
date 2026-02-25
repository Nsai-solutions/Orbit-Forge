// ─── Payload Types ───

export type PayloadType = 'earth-observation' | 'sar' | 'satcom'

// Shared across all payload types
export interface SharedPayloadConfig {
  name: string
  mass: number              // kg
  powerPeak: number         // W
  powerAvg: number          // W
  dutyCycle: number         // 0–1
  dataRate: number          // Mbps raw sensor output
  storageCapacity: number   // GB onboard storage
  tempMin: number           // °C operating range
  tempMax: number           // °C operating range
}

// ─── Earth Observation ───

export interface EOConfig {
  focalLength: number       // mm
  apertureDia: number       // mm
  pixelSize: number         // μm
  detectorWidth: number     // pixels
  detectorHeight: number    // pixels (1 for pushbroom TDI)
  spectralBands: number     // number of bands
  quantBits: number         // bits per pixel
  sunElevation: number      // degrees — sun elevation for SNR analysis
  minSunElev: number        // degrees — min sun elevation for imaging
  maxOffNadir: number       // degrees — max off-nadir pointing
  targetLat: number | null  // optional target latitude
  targetLon: number | null  // optional target longitude
}

// ─── SAR ───

export type SARFreqBand = 'X' | 'C' | 'L' | 'S'
export type SARImagingMode = 'stripmap' | 'spotlight' | 'scansar'

export interface SARConfig {
  freqBand: SARFreqBand
  frequency: number         // GHz
  antennaLength: number     // m
  antennaWidth: number      // m
  peakTxPower: number       // W
  prf: number               // Hz — pulse repetition frequency
  pulseBandwidth: number    // MHz
  lookAngle: number         // degrees from nadir
  numLooks: number          // number of looks for speckle reduction
  imagingMode: SARImagingMode
}

// ─── SATCOM ───

export type SATCOMFreqBand = 'UHF' | 'S' | 'X' | 'Ku' | 'Ka'
export type Modulation = 'BPSK' | 'QPSK' | '8PSK' | '16APSK'

export interface SATCOMConfig {
  freqBand: SATCOMFreqBand
  uplinkFreq: number        // GHz
  downlinkFreq: number      // GHz
  satAntennaDia: number     // m — satellite antenna diameter
  satTxPower: number        // W
  satNoiseTemp: number      // K
  gsAntennaDia: number      // m — ground station antenna
  gsTxPower: number         // W
  gsNoiseTemp: number       // K
  requiredEbN0: number      // dB
  modulation: Modulation
  codingRate: number        // e.g. 0.5, 0.75, 0.875
  rainMargin: number        // dB
  atmosphericLoss: number   // dB
}

// ─── Full Payload State ───

export interface PayloadState {
  payloadType: PayloadType
  shared: SharedPayloadConfig
  eo: EOConfig
  sar: SARConfig
  satcom: SATCOMConfig
}

// ─── Defaults ───

export const DEFAULT_SHARED: SharedPayloadConfig = {
  name: 'Payload',
  mass: 5,
  powerPeak: 30,
  powerAvg: 15,
  dutyCycle: 0.3,
  dataRate: 100,
  storageCapacity: 64,
  tempMin: -20,
  tempMax: 50,
}

export const DEFAULT_EO: EOConfig = {
  focalLength: 500,
  apertureDia: 100,
  pixelSize: 5.5,
  detectorWidth: 8192,
  detectorHeight: 1,
  spectralBands: 4,
  quantBits: 12,
  sunElevation: 45,
  minSunElev: 20,
  maxOffNadir: 30,
  targetLat: null,
  targetLon: null,
}

export const DEFAULT_SAR: SARConfig = {
  freqBand: 'X',
  frequency: 9.65,
  antennaLength: 3.0,
  antennaWidth: 0.7,
  peakTxPower: 500,
  prf: 6000,
  pulseBandwidth: 150,
  lookAngle: 35,
  numLooks: 4,
  imagingMode: 'stripmap',
}

export const DEFAULT_SATCOM: SATCOMConfig = {
  freqBand: 'UHF',
  uplinkFreq: 0.4,
  downlinkFreq: 0.437,
  satAntennaDia: 0.1,
  satTxPower: 2,
  satNoiseTemp: 600,
  gsAntennaDia: 2.4,
  gsTxPower: 10,
  gsNoiseTemp: 200,
  requiredEbN0: 10,
  modulation: 'QPSK',
  codingRate: 0.5,
  rainMargin: 0,
  atmosphericLoss: 1.0,
}

// ─── Presets ───

export interface PayloadPreset {
  label: string
  shared: Partial<SharedPayloadConfig>
  config: Partial<EOConfig> | Partial<SARConfig> | Partial<SATCOMConfig>
  orbit?: { altitudeKm: number; inclinationDeg: number }
}

export const EO_PRESETS: PayloadPreset[] = [
  {
    label: 'VIREON-like',
    shared: { name: 'VIREON MSI', mass: 15, powerPeak: 45, powerAvg: 25, dutyCycle: 0.3, dataRate: 200, storageCapacity: 128 },
    config: { focalLength: 500, apertureDia: 100, pixelSize: 5.5, detectorWidth: 8192, detectorHeight: 1, spectralBands: 4, quantBits: 12, maxOffNadir: 30 } as Partial<EOConfig>,
  },
  {
    label: 'PlanetScope-like',
    shared: { name: 'PS Imager', mass: 3, powerPeak: 15, powerAvg: 8, dutyCycle: 0.25, dataRate: 120, storageCapacity: 32 },
    config: { focalLength: 290, apertureDia: 90, pixelSize: 5.5, detectorWidth: 6600, detectorHeight: 1, spectralBands: 4, quantBits: 12, maxOffNadir: 20 } as Partial<EOConfig>,
  },
  {
    label: 'SkySat-like',
    shared: { name: 'SkySat Imager', mass: 20, powerPeak: 60, powerAvg: 35, dutyCycle: 0.35, dataRate: 350, storageCapacity: 256 },
    config: { focalLength: 3600, apertureDia: 350, pixelSize: 6.5, detectorWidth: 2048, detectorHeight: 1, spectralBands: 4, quantBits: 11, maxOffNadir: 25 } as Partial<EOConfig>,
  },
  {
    label: 'Sentinel-2-like',
    shared: { name: 'Sentinel-2 MSI', mass: 290, powerPeak: 266, powerAvg: 170, dutyCycle: 0.25, dataRate: 490, storageCapacity: 2400 },
    config: { focalLength: 600, apertureDia: 150, pixelSize: 7.6, detectorWidth: 29116, detectorHeight: 1, spectralBands: 13, quantBits: 12, maxOffNadir: 20 } as Partial<EOConfig>,
    orbit: { altitudeKm: 786, inclinationDeg: 98.6 },
  },
]

export const SAR_PRESETS: PayloadPreset[] = [
  {
    label: 'ICEYE-like',
    shared: { name: 'ICEYE SAR', mass: 30, powerPeak: 800, powerAvg: 150, dutyCycle: 0.15, dataRate: 560, storageCapacity: 256 },
    config: { freqBand: 'X', frequency: 9.65, antennaLength: 3.2, antennaWidth: 0.4, peakTxPower: 500, prf: 5500, pulseBandwidth: 300, lookAngle: 35, numLooks: 1, imagingMode: 'stripmap' } as Partial<SARConfig>,
  },
  {
    label: 'Capella-like',
    shared: { name: 'Capella SAR', mass: 45, powerPeak: 1200, powerAvg: 200, dutyCycle: 0.15, dataRate: 800, storageCapacity: 512 },
    config: { freqBand: 'X', frequency: 9.65, antennaLength: 3.5, antennaWidth: 0.7, peakTxPower: 1000, prf: 5000, pulseBandwidth: 500, lookAngle: 30, numLooks: 1, imagingMode: 'spotlight' } as Partial<SARConfig>,
  },
  {
    label: 'Sentinel-1-like',
    shared: { name: 'C-SAR', mass: 880, powerPeak: 4400, powerAvg: 1400, dutyCycle: 0.25, dataRate: 640, storageCapacity: 1400 },
    config: { freqBand: 'C', frequency: 5.405, antennaLength: 12.3, antennaWidth: 0.82, peakTxPower: 4000, prf: 3500, pulseBandwidth: 100, lookAngle: 33, numLooks: 4, imagingMode: 'stripmap' } as Partial<SARConfig>,
  },
]

export const SATCOM_PRESETS: PayloadPreset[] = [
  {
    label: 'CubeSat UHF',
    shared: { name: 'UHF Radio', mass: 0.3, powerPeak: 5, powerAvg: 2, dutyCycle: 0.1, dataRate: 0.0096, storageCapacity: 4 },
    config: { freqBand: 'UHF', uplinkFreq: 0.4, downlinkFreq: 0.437, satAntennaDia: 0.1, satTxPower: 2, satNoiseTemp: 600, gsAntennaDia: 2.4, gsTxPower: 10, gsNoiseTemp: 200, requiredEbN0: 10, modulation: 'BPSK', codingRate: 0.5, rainMargin: 0, atmosphericLoss: 1.0 } as Partial<SATCOMConfig>,
  },
  {
    label: 'Iridium-like',
    shared: { name: 'L-Band Transponder', mass: 5, powerPeak: 100, powerAvg: 40, dutyCycle: 0.5, dataRate: 0.128, storageCapacity: 16 },
    config: { freqBand: 'S', uplinkFreq: 1.616, downlinkFreq: 1.626, satAntennaDia: 0.6, satTxPower: 25, satNoiseTemp: 500, gsAntennaDia: 0.15, gsTxPower: 0.5, gsNoiseTemp: 300, requiredEbN0: 6, modulation: 'QPSK', codingRate: 0.75, rainMargin: 0, atmosphericLoss: 0.5 } as Partial<SATCOMConfig>,
  },
  {
    label: 'Starlink-like',
    shared: { name: 'Ka-Band PHY', mass: 50, powerPeak: 3200, powerAvg: 1500, dutyCycle: 0.9, dataRate: 100, storageCapacity: 64 },
    config: { freqBand: 'Ka', uplinkFreq: 29.5, downlinkFreq: 19.7, satAntennaDia: 0.7, satTxPower: 100, satNoiseTemp: 400, gsAntennaDia: 0.5, gsTxPower: 2, gsNoiseTemp: 150, requiredEbN0: 5, modulation: '16APSK', codingRate: 0.875, rainMargin: 3, atmosphericLoss: 2.0 } as Partial<SATCOMConfig>,
  },
]
