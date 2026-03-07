/**
 * NRLMSISE-00 Atmospheric Model - TypeScript Port
 *
 * Original model by Mike Picone, Alan Hedin, and Doug Drob (2001).
 * C implementation by Dominik Brodowski (20100516).
 * Python port by Joshua Milas (2013).
 * TypeScript port for OrbitForge.
 */

import { pt, pd, ps, pdl, ptm, pdm, ptl, pma, pavgm } from './nrlmsise00-data'

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface NrlmsiseInput {
  year: number
  doy: number
  sec: number
  alt: number
  gLat: number
  gLon: number
  lst: number
  f107a: number
  f107: number
  ap: number
  apArray?: number[] // 7-element array
}

export interface NrlmsiseOutput {
  d: number[] // 9 densities
  t: number[] // 2 temperatures
}

export interface NrlmsiseFlags {
  switches: number[] // 24 elements
  sw: number[] // 24 elements (computed)
  swc: number[] // 24 elements (computed)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DGTR = 1.74533e-2
const DR = 1.72142e-2
const HR = 0.2618
const SR = 7.2722e-5
const RGAS = 831.4

// ---------------------------------------------------------------------------
// Class Nrlmsise00
// ---------------------------------------------------------------------------

export class Nrlmsise00 {
  // Legendre polynomials  4x9
  plg: number[][]
  // Trig caches
  ctloc = 0
  stloc = 0
  c2tloc = 0
  s2tloc = 0
  c3tloc = 0
  s3tloc = 0
  // Solar flux working values
  dfa = 0
  apdf = 0
  // Ap array (4 elements)
  apt: number[]
  // Mixed density temps
  dm04 = 0
  dm16 = 0
  dm28 = 0
  dm32 = 0
  dm40 = 0
  dm01 = 0
  dm14 = 0
  // Meso temps
  meso_tn1: number[]
  meso_tn2: number[]
  meso_tn3: number[]
  meso_tgn1: number[]
  meso_tgn2: number[]
  meso_tgn3: number[]
  // PARMB
  gsurf = 0
  re = 0
  // GTS3C
  dd = 0

  constructor() {
    this.plg = Array.from({ length: 4 }, () => new Array(9).fill(0))
    this.apt = new Array(4).fill(0)
    this.meso_tn1 = new Array(5).fill(0)
    this.meso_tn2 = new Array(4).fill(0)
    this.meso_tn3 = new Array(5).fill(0)
    this.meso_tgn1 = new Array(2).fill(0)
    this.meso_tgn2 = new Array(2).fill(0)
    this.meso_tgn3 = new Array(2).fill(0)
  }

  // -------------------------------------------------------------------------
  // tselec — initialize sw/swc from switches
  // -------------------------------------------------------------------------
  tselec(flags: NrlmsiseFlags): void {
    for (let i = 0; i < 24; i++) {
      if (i !== 9) {
        flags.sw[i] = flags.switches[i] === 1 ? 1 : 0
        flags.swc[i] = flags.switches[i] > 0 ? 1 : 0
      } else {
        flags.sw[i] = flags.switches[i]
        flags.swc[i] = flags.switches[i]
      }
    }
  }

  // -------------------------------------------------------------------------
  // glatf — gravity and effective radius from latitude
  // -------------------------------------------------------------------------
  glatf(lat: number): { gv: number; reff: number } {
    const c2 = Math.cos(2.0 * DGTR * lat)
    const gv = 980.616 * (1.0 - 0.0026373 * c2)
    const reff = 2.0 * gv / (3.085462e-6 + 2.27e-9 * c2) * 1.0e-5
    return { gv, reff }
  }

  // -------------------------------------------------------------------------
  // ccor — chemistry/dissociation correction
  // -------------------------------------------------------------------------
  ccor(alt: number, r: number, h1: number, zh: number): number {
    const e = (alt - zh) / h1
    if (e > 70) return Math.exp(0)
    if (e < -70) return Math.exp(r)
    const ex = Math.exp(e)
    return Math.exp(r / (1.0 + ex))
  }

  // -------------------------------------------------------------------------
  // ccor2 — chemistry/dissociation correction (2 scale lengths)
  // -------------------------------------------------------------------------
  ccor2(alt: number, r: number, h1: number, zh: number, h2: number): number {
    const e1 = (alt - zh) / h1
    const e2 = (alt - zh) / h2
    if (e1 > 70 || e2 > 70) return Math.exp(0)
    if (e1 < -70 && e2 < -70) return Math.exp(r)
    const ex1 = Math.exp(e1)
    const ex2 = Math.exp(e2)
    return Math.exp(r / (1.0 + 0.5 * (ex1 + ex2)))
  }

  // -------------------------------------------------------------------------
  // scalh — scale height
  // -------------------------------------------------------------------------
  scalh(alt: number, xm: number, temp: number): number {
    const g = this.gsurf / Math.pow(1.0 + alt / this.re, 2.0)
    return RGAS * temp / (g * xm)
  }

  // -------------------------------------------------------------------------
  // dnet — turbopause correction
  // -------------------------------------------------------------------------
  dnet(dd: number, dm: number, zhm: number, xmm: number, xm: number): number {
    let a = zhm / (xmm - xm)
    if (!(dm > 0 && dd > 0)) {
      if (dd === 0 && dm === 0) dd = 1
      if (dm === 0) return dd
      if (dd === 0) return dm
    }
    const ylog = a * Math.log(dm / dd)
    if (ylog < -10) return dd
    if (ylog > 10) return dm
    return dd * Math.pow(1.0 + Math.exp(ylog), 1.0 / a)
  }

  // -------------------------------------------------------------------------
  // zeta — geopotential altitude
  // -------------------------------------------------------------------------
  zeta(zz: number, zl: number): number {
    return (zz - zl) * (this.re + zl) / (this.re + zz)
  }

  // -------------------------------------------------------------------------
  // spline — compute 2nd derivatives for cubic spline
  // -------------------------------------------------------------------------
  private spline(x: number[], y: number[], n: number, yp1: number, ypn: number, y2: number[]): void {
    const u = new Array(n).fill(0)

    if (yp1 > 0.99e30) {
      y2[0] = 0
      u[0] = 0
    } else {
      y2[0] = -0.5
      u[0] = (3.0 / (x[1] - x[0])) * ((y[1] - y[0]) / (x[1] - x[0]) - yp1)
    }

    for (let i = 1; i < n - 1; i++) {
      const sig = (x[i] - x[i - 1]) / (x[i + 1] - x[i - 1])
      const p = sig * y2[i - 1] + 2.0
      y2[i] = (sig - 1.0) / p
      u[i] = (6.0 * ((y[i + 1] - y[i]) / (x[i + 1] - x[i]) - (y[i] - y[i - 1]) / (x[i] - x[i - 1])) / (x[i + 1] - x[i - 1]) - sig * u[i - 1]) / p
    }

    let qn: number, un: number
    if (ypn > 0.99e30) {
      qn = 0
      un = 0
    } else {
      qn = 0.5
      un = (3.0 / (x[n - 1] - x[n - 2])) * (ypn - (y[n - 1] - y[n - 2]) / (x[n - 1] - x[n - 2]))
    }

    y2[n - 1] = (un - qn * u[n - 2]) / (qn * y2[n - 2] + 1.0)

    let k = n - 2
    while (k >= 0) {
      y2[k] = y2[k] * y2[k + 1] + u[k]
      k -= 1
    }
  }

  // -------------------------------------------------------------------------
  // splini — integrate cubic spline from xa[0] to x
  // -------------------------------------------------------------------------
  splini(xa: number[], ya: number[], y2a: number[], n: number, x: number): number {
    let yi = 0
    let klo = 0
    let khi = 1
    while (x > xa[klo] && khi < n) {
      let xx = x
      if (khi < n - 1) {
        if (x < xa[khi]) {
          xx = x
        } else {
          xx = xa[khi]
        }
      }
      const h = xa[khi] - xa[klo]
      const a = (xa[khi] - xx) / h
      const b = (xx - xa[klo]) / h
      const a2 = a * a
      const b2 = b * b
      yi += ((1.0 - a2) * ya[klo] / 2.0 + b2 * ya[khi] / 2.0 + ((-(1.0 + a2 * a2) / 4.0 + a2 / 2.0) * y2a[klo] + (b2 * b2 / 4.0 - b2 / 2.0) * y2a[khi]) * h * h / 6.0) * h
      klo += 1
      khi += 1
    }
    return yi
  }

  // -------------------------------------------------------------------------
  // splint — cubic spline interpolation
  // -------------------------------------------------------------------------
  splint(xa: number[], ya: number[], y2a: number[], n: number, x: number): number {
    let klo = 0
    let khi = n - 1

    while (khi - klo > 1) {
      const k = Math.floor((khi + klo) / 2)
      if (xa[k] > x) {
        khi = k
      } else {
        klo = k
      }
    }
    const h = xa[khi] - xa[klo]
    const a = (xa[khi] - x) / h
    const b = (x - xa[klo]) / h
    return a * ya[klo] + b * ya[khi] + ((a * a * a - a) * y2a[klo] + (b * b * b - b) * y2a[khi]) * h * h / 6.0
  }

  // -------------------------------------------------------------------------
  // densm — lower atmosphere temperature and density profiles
  // -------------------------------------------------------------------------
  densm(
    alt: number, d0: number, xm: number,
    mn3: number, zn3: number[], tn3: number[], tgn3: number[],
    mn2: number, zn2: number[], tn2: number[], tgn2: number[],
  ): { density: number; tz: number } {
    const xs = new Array(10).fill(0)
    const ys = new Array(10).fill(0)
    const y2out = new Array(10).fill(0)

    let densm_tmp = d0
    let tz = 0

    if (alt > zn2[0]) {
      if (xm === 0.0) return { density: 0, tz: 0 }
      return { density: d0, tz: 0 }
    }

    // STRATOSPHERE/MESOSPHERE TEMPERATURE
    let z = alt > zn2[mn2 - 1] ? alt : zn2[mn2 - 1]
    let mn = mn2
    let z1 = zn2[0]
    let z2 = zn2[mn - 1]
    let t1 = tn2[0]
    let t2 = tn2[mn - 1]
    let zg = this.zeta(z, z1)
    let zgdif = this.zeta(z2, z1)

    // set up spline nodes
    for (let k = 0; k < mn; k++) {
      xs[k] = this.zeta(zn2[k], z1) / zgdif
      ys[k] = 1.0 / tn2[k]
    }
    let yd1 = -tgn2[0] / (t1 * t1) * zgdif
    let yd2 = -tgn2[1] / (t2 * t2) * zgdif * Math.pow((this.re + z2) / (this.re + z1), 2.0)

    // calculate spline coefficients
    this.spline(xs, ys, mn, yd1, yd2, y2out)
    let x = zg / zgdif
    let y = this.splint(xs, ys, y2out, mn, x)

    // temperature at altitude
    tz = 1.0 / y
    if (xm !== 0.0) {
      // calculate stratosphere/mesosphere density
      let glb = this.gsurf / Math.pow(1.0 + z1 / this.re, 2.0)
      let gamm = xm * glb * zgdif / RGAS

      // integrate temperature profile
      let yi = this.splini(xs, ys, y2out, mn, x)
      let expl = gamm * yi
      if (expl > 50.0) expl = 50.0

      // density at altitude
      densm_tmp = densm_tmp * (t1 / tz) * Math.exp(-expl)
    }

    if (alt > zn3[0]) {
      if (xm === 0.0) return { density: tz, tz }
      return { density: densm_tmp, tz }
    }

    // TROPOSPHERE / STRATOSPHERE TEMPERATURE
    z = alt
    mn = mn3
    z1 = zn3[0]
    z2 = zn3[mn - 1]
    t1 = tn3[0]
    t2 = tn3[mn - 1]
    zg = this.zeta(z, z1)
    zgdif = this.zeta(z2, z1)

    // set up spline nodes
    for (let k = 0; k < mn; k++) {
      xs[k] = this.zeta(zn3[k], z1) / zgdif
      ys[k] = 1.0 / tn3[k]
    }
    yd1 = -tgn3[0] / (t1 * t1) * zgdif
    yd2 = -tgn3[1] / (t2 * t2) * zgdif * Math.pow((this.re + z2) / (this.re + z1), 2.0)

    // calculate spline coefficients
    this.spline(xs, ys, mn, yd1, yd2, y2out)
    x = zg / zgdif
    y = this.splint(xs, ys, y2out, mn, x)

    // temperature at altitude
    tz = 1.0 / y
    if (xm !== 0.0) {
      // calculate tropospheric/stratosphere density
      const glb = this.gsurf / Math.pow(1.0 + z1 / this.re, 2.0)
      const gamm = xm * glb * zgdif / RGAS

      // integrate temperature profile
      const yi = this.splini(xs, ys, y2out, mn, x)
      let expl = gamm * yi
      if (expl > 50.0) expl = 50.0

      // density at altitude
      densm_tmp = densm_tmp * (t1 / tz) * Math.exp(-expl)
    }

    if (xm === 0.0) return { density: tz, tz }
    return { density: densm_tmp, tz }
  }

  // -------------------------------------------------------------------------
  // densu — upper thermosphere temperature and density profiles
  // -------------------------------------------------------------------------
  densu(
    alt: number, dlb: number, tinf: number, tlb: number,
    xm: number, alpha: number, tzRef: number, zlb: number, s2: number,
    mn1: number, zn1: number[], tn1: number[], tgn1: number[],
  ): { density: number; tz: number } {
    const xs = new Array(5).fill(0)
    const ys = new Array(5).fill(0)
    const y2out = new Array(5).fill(0)

    let tz = tzRef
    let densu_temp = 1.0

    // joining altitudes of Bates and spline
    const za = zn1[0]
    const z = alt > za ? alt : za

    // geopotential altitude difference from ZLB
    const zg2 = this.zeta(z, zlb)

    // Bates temperature
    const tt = tinf - (tinf - tlb) * Math.exp(-s2 * zg2)
    const ta = tt
    tz = tt
    densu_temp = tz

    if (alt < za) {
      // calculate temperature below ZA
      // temperature gradient at ZA from Bates profile
      const dta = (tinf - ta) * s2 * Math.pow((this.re + zlb) / (this.re + za), 2.0)
      tgn1[0] = dta
      tn1[0] = ta
      const zBelow = alt > zn1[mn1 - 1] ? alt : zn1[mn1 - 1]
      const mn = mn1
      const z1 = zn1[0]
      const z2 = zn1[mn - 1]
      const t1 = tn1[0]
      const t2 = tn1[mn - 1]
      // geopotential difference from z1
      const zg = this.zeta(zBelow, z1)
      const zgdif = this.zeta(z2, z1)
      // set up spline nodes
      for (let k = 0; k < mn; k++) {
        xs[k] = this.zeta(zn1[k], z1) / zgdif
        ys[k] = 1.0 / tn1[k]
      }
      // end node derivatives
      const yd1 = -tgn1[0] / (t1 * t1) * zgdif
      const yd2 = -tgn1[1] / (t2 * t2) * zgdif * Math.pow((this.re + z2) / (this.re + z1), 2.0)
      // calculate spline coefficients
      this.spline(xs, ys, mn, yd1, yd2, y2out)
      const x = zg / zgdif
      const y = this.splint(xs, ys, y2out, mn, x)
      // temperature at altitude
      tz = 1.0 / y
      densu_temp = tz
    }

    if (xm === 0) return { density: densu_temp, tz }

    // calculate density above za
    let glb = this.gsurf / Math.pow(1.0 + zlb / this.re, 2.0)
    let gamma = xm * glb / (s2 * RGAS * tinf)
    let expl = Math.exp(-s2 * gamma * zg2)
    if (expl > 50.0) expl = 50.0
    if (tt <= 0) expl = 50.0

    // density at altitude
    const densa = dlb * Math.pow(tlb / tt, 1.0 + alpha + gamma) * expl
    densu_temp = densa
    if (alt >= za) return { density: densu_temp, tz }

    // calculate density below za
    glb = this.gsurf / Math.pow(1.0 + zn1[0] / this.re, 2.0)
    const zgdif = this.zeta(zn1[mn1 - 1], zn1[0])
    const zg = this.zeta(alt > zn1[mn1 - 1] ? alt : zn1[mn1 - 1], zn1[0])
    const x = zg / zgdif
    const gamm = xm * glb * zgdif / RGAS

    // integrate spline temperatures
    const yi = this.splini(xs, ys, y2out, mn1, x)
    expl = gamm * yi
    if (expl > 50.0) expl = 50.0
    if (tz <= 0) expl = 50.0

    // density at altitude
    densu_temp = densu_temp * Math.pow(tn1[0] / tz, 1.0 + alpha) * Math.exp(-expl)
    return { density: densu_temp, tz }
  }

  // -------------------------------------------------------------------------
  // g0, sumex, sg0 — 3hr magnetic activity functions
  // -------------------------------------------------------------------------
  private g0(a: number, p: number[]): number {
    return a - 4.0 + (p[25] - 1.0) * (a - 4.0 + (Math.exp(-Math.sqrt(p[24] * p[24]) * (a - 4.0)) - 1.0) / Math.sqrt(p[24] * p[24]))
  }

  private sumex(ex: number): number {
    return 1.0 + (1.0 - Math.pow(ex, 19.0)) / (1.0 - ex) * Math.pow(ex, 0.5)
  }

  private sg0(ex: number, p: number[], apArr: number[]): number {
    return (
      this.g0(apArr[1], p) +
      (this.g0(apArr[2], p) * ex +
        this.g0(apArr[3], p) * ex * ex +
        this.g0(apArr[4], p) * Math.pow(ex, 3.0) +
        (this.g0(apArr[5], p) * Math.pow(ex, 4.0) +
          this.g0(apArr[6], p) * Math.pow(ex, 12.0)) *
          (1.0 - Math.pow(ex, 8.0)) /
          (1.0 - ex))
    ) / this.sumex(ex)
  }

  // -------------------------------------------------------------------------
  // globe7 — upper thermosphere perturbation (G(L) function)
  // -------------------------------------------------------------------------
  globe7(p: number[], input: NrlmsiseInput, flags: NrlmsiseFlags): number {
    const t = new Array(15).fill(0)
    let sw9 = 1

    const tloc = input.lst
    if (flags.sw[9] > 0) sw9 = 1
    else if (flags.sw[9] < 0) sw9 = -1
    const xlong = input.gLon

    // calculate Legendre polynomials
    const c = Math.sin(input.gLat * DGTR)
    const s = Math.cos(input.gLat * DGTR)
    const c2 = c * c
    const c4 = c2 * c2
    const s2 = s * s

    this.plg[0][1] = c
    this.plg[0][2] = 0.5 * (3.0 * c2 - 1.0)
    this.plg[0][3] = 0.5 * (5.0 * c * c2 - 3.0 * c)
    this.plg[0][4] = (35.0 * c4 - 30.0 * c2 + 3.0) / 8.0
    this.plg[0][5] = (63.0 * c2 * c2 * c - 70.0 * c2 * c + 15.0 * c) / 8.0
    this.plg[0][6] = (11.0 * c * this.plg[0][5] - 5.0 * this.plg[0][4]) / 6.0

    this.plg[1][1] = s
    this.plg[1][2] = 3.0 * c * s
    this.plg[1][3] = 1.5 * (5.0 * c2 - 1.0) * s
    this.plg[1][4] = 2.5 * (7.0 * c2 * c - 3.0 * c) * s
    this.plg[1][5] = 1.875 * (21.0 * c4 - 14.0 * c2 + 1.0) * s
    this.plg[1][6] = (11.0 * c * this.plg[1][5] - 6.0 * this.plg[1][4]) / 5.0

    this.plg[2][2] = 3.0 * s2
    this.plg[2][3] = 15.0 * s2 * c
    this.plg[2][4] = 7.5 * (7.0 * c2 - 1.0) * s2
    this.plg[2][5] = 3.0 * c * this.plg[2][4] - 2.0 * this.plg[2][3]
    this.plg[2][6] = (11.0 * c * this.plg[2][5] - 7.0 * this.plg[2][4]) / 4.0
    this.plg[2][7] = (13.0 * c * this.plg[2][6] - 8.0 * this.plg[2][5]) / 5.0

    this.plg[3][3] = 15.0 * s2 * s
    this.plg[3][4] = 105.0 * s2 * s * c
    this.plg[3][5] = (9.0 * c * this.plg[3][4] - 7.0 * this.plg[3][3]) / 2.0
    this.plg[3][6] = (11.0 * c * this.plg[3][5] - 8.0 * this.plg[3][4]) / 3.0

    if (!(flags.sw[7] === 0 && flags.sw[8] === 0 && flags.sw[14] === 0)) {
      this.stloc = Math.sin(HR * tloc)
      this.ctloc = Math.cos(HR * tloc)
      this.s2tloc = Math.sin(2.0 * HR * tloc)
      this.c2tloc = Math.cos(2.0 * HR * tloc)
      this.s3tloc = Math.sin(3.0 * HR * tloc)
      this.c3tloc = Math.cos(3.0 * HR * tloc)
    }

    const cd32 = Math.cos(DR * (input.doy - p[31]))
    const cd18 = Math.cos(2.0 * DR * (input.doy - p[17]))
    const cd14 = Math.cos(DR * (input.doy - p[13]))
    const cd39 = Math.cos(2.0 * DR * (input.doy - p[38]))

    // F10.7 EFFECT
    const df = input.f107 - input.f107a
    this.dfa = input.f107a - 150.0
    t[0] = p[19] * df * (1.0 + p[59] * this.dfa) + p[20] * df * df + p[21] * this.dfa + p[29] * Math.pow(this.dfa, 2.0)
    const f1 = 1.0 + (p[47] * this.dfa + p[19] * df + p[20] * df * df) * flags.swc[1]
    const f2 = 1.0 + (p[49] * this.dfa + p[19] * df + p[20] * df * df) * flags.swc[1]

    // TIME INDEPENDENT
    t[1] = (p[1] * this.plg[0][2] + p[2] * this.plg[0][4] + p[22] * this.plg[0][6]) +
      p[14] * this.plg[0][2] * this.dfa * flags.swc[1] + p[26] * this.plg[0][1]

    // SYMMETRICAL ANNUAL
    t[2] = p[18] * cd32

    // SYMMETRICAL SEMIANNUAL
    t[3] = (p[15] + p[16] * this.plg[0][2]) * cd18

    // ASYMMETRICAL ANNUAL
    t[4] = f1 * (p[9] * this.plg[0][1] + p[10] * this.plg[0][3]) * cd14

    // ASYMMETRICAL SEMIANNUAL
    t[5] = p[37] * this.plg[0][1] * cd39

    // DIURNAL
    if (flags.sw[7]) {
      const t71 = p[11] * this.plg[1][2] * cd14 * flags.swc[5]
      const t72 = p[12] * this.plg[1][2] * cd14 * flags.swc[5]
      t[6] = f2 * ((p[3] * this.plg[1][1] + p[4] * this.plg[1][3] + p[27] * this.plg[1][5] + t71) *
        this.ctloc + (p[6] * this.plg[1][1] + p[7] * this.plg[1][3] + p[28] * this.plg[1][5] + t72) * this.stloc)
    }

    // SEMIDIURNAL
    if (flags.sw[8]) {
      const t81 = (p[23] * this.plg[2][3] + p[35] * this.plg[2][5]) * cd14 * flags.swc[5]
      const t82 = (p[33] * this.plg[2][3] + p[36] * this.plg[2][5]) * cd14 * flags.swc[5]
      t[7] = f2 * ((p[5] * this.plg[2][2] + p[41] * this.plg[2][4] + t81) * this.c2tloc +
        (p[8] * this.plg[2][2] + p[42] * this.plg[2][4] + t82) * this.s2tloc)
    }

    // TERDIURNAL
    if (flags.sw[14]) {
      t[13] = f2 * ((p[39] * this.plg[3][3] + (p[93] * this.plg[3][4] + p[46] * this.plg[3][6]) * cd14 * flags.swc[5]) * this.s3tloc +
        (p[40] * this.plg[3][3] + (p[94] * this.plg[3][4] + p[48] * this.plg[3][6]) * cd14 * flags.swc[5]) * this.c3tloc)
    }

    // MAGNETIC ACTIVITY based on daily ap
    if (flags.sw[9] === -1) {
      const ap = input.apArray!
      if (p[51] !== 0) {
        let exp1 = Math.exp(-10800.0 * Math.sqrt(p[51] * p[51]) / (1.0 + p[138] * (45.0 - Math.sqrt(input.gLat * input.gLat))))
        if (exp1 > 0.99999) exp1 = 0.99999
        if (p[24] < 1.0e-4) p[24] = 1.0e-4
        this.apt[0] = this.sg0(exp1, p, ap)
        if (flags.sw[9]) {
          t[8] = this.apt[0] * (p[50] + p[96] * this.plg[0][2] + p[54] * this.plg[0][4] +
            (p[125] * this.plg[0][1] + p[126] * this.plg[0][3] + p[127] * this.plg[0][5]) * cd14 * flags.swc[5] +
            (p[128] * this.plg[1][1] + p[129] * this.plg[1][3] + p[130] * this.plg[1][5]) * flags.swc[7] *
            Math.cos(HR * (tloc - p[131])))
        }
      }
    } else {
      const apd = input.ap - 4.0
      let p44 = p[43]
      const p45 = p[44]
      if (p44 < 0) p44 = 1.0e-5
      this.apdf = apd + (p45 - 1.0) * (apd + (Math.exp(-p44 * apd) - 1.0) / p44)
      if (flags.sw[9]) {
        t[8] = this.apdf * (p[32] + p[45] * this.plg[0][2] + p[34] * this.plg[0][4] +
          (p[100] * this.plg[0][1] + p[101] * this.plg[0][3] + p[102] * this.plg[0][5]) * cd14 * flags.swc[5] +
          (p[121] * this.plg[1][1] + p[122] * this.plg[1][3] + p[123] * this.plg[1][5]) * flags.swc[7] *
          Math.cos(HR * (tloc - p[124])))
      }
    }

    if (flags.sw[10] && input.gLon > -1000.0) {
      // LONGITUDINAL
      if (flags.sw[11]) {
        t[10] = (1.0 + p[80] * this.dfa * flags.swc[1]) *
          ((p[64] * this.plg[1][2] + p[65] * this.plg[1][4] + p[66] * this.plg[1][6] +
            p[103] * this.plg[1][1] + p[104] * this.plg[1][3] + p[105] * this.plg[1][5] +
            flags.swc[5] * (p[109] * this.plg[1][1] + p[110] * this.plg[1][3] + p[111] * this.plg[1][5]) * cd14) *
            Math.cos(DGTR * input.gLon) +
            (p[90] * this.plg[1][2] + p[91] * this.plg[1][4] + p[92] * this.plg[1][6] +
              p[106] * this.plg[1][1] + p[107] * this.plg[1][3] + p[108] * this.plg[1][5] +
              flags.swc[5] * (p[112] * this.plg[1][1] + p[113] * this.plg[1][3] + p[114] * this.plg[1][5]) * cd14) *
            Math.sin(DGTR * input.gLon))
      }

      // UT and mixed UT, longitude
      if (flags.sw[12]) {
        t[11] = (1.0 + p[95] * this.plg[0][1]) * (1.0 + p[81] * this.dfa * flags.swc[1]) *
          (1.0 + p[119] * this.plg[0][1] * flags.swc[5] * cd14) *
          ((p[68] * this.plg[0][1] + p[69] * this.plg[0][3] + p[70] * this.plg[0][5]) *
            Math.cos(SR * (input.sec - p[71])))
        t[11] += flags.swc[11] *
          (p[76] * this.plg[2][3] + p[77] * this.plg[2][5] + p[78] * this.plg[2][7]) *
          Math.cos(SR * (input.sec - p[79]) + 2.0 * DGTR * input.gLon) * (1.0 + p[137] * this.dfa * flags.swc[1])
      }

      // UT, longitude magnetic activity
      if (flags.sw[13]) {
        if (flags.sw[9] === -1) {
          if (p[51]) {
            t[12] = this.apt[0] * flags.swc[11] * (1.0 + p[132] * this.plg[0][1]) *
              ((p[52] * this.plg[1][2] + p[98] * this.plg[1][4] + p[67] * this.plg[1][6]) *
                Math.cos(DGTR * (input.gLon - p[97]))) +
              this.apt[0] * flags.swc[11] * flags.swc[5] *
              (p[133] * this.plg[1][1] + p[134] * this.plg[1][3] + p[135] * this.plg[1][5]) *
              cd14 * Math.cos(DGTR * (input.gLon - p[136])) +
              this.apt[0] * flags.swc[12] *
              (p[55] * this.plg[0][1] + p[56] * this.plg[0][3] + p[57] * this.plg[0][5]) *
              Math.cos(SR * (input.sec - p[58]))
          }
        } else {
          t[12] = this.apdf * flags.swc[11] * (1.0 + p[120] * this.plg[0][1]) *
            ((p[60] * this.plg[1][2] + p[61] * this.plg[1][4] + p[62] * this.plg[1][6]) *
              Math.cos(DGTR * (input.gLon - p[63]))) +
            this.apdf * flags.swc[11] * flags.swc[5] *
            (p[115] * this.plg[1][1] + p[116] * this.plg[1][3] + p[117] * this.plg[1][5]) *
            cd14 * Math.cos(DGTR * (input.gLon - p[118])) +
            this.apdf * flags.swc[12] *
            (p[83] * this.plg[0][1] + p[84] * this.plg[0][3] + p[85] * this.plg[0][5]) *
            Math.cos(SR * (input.sec - p[75]))
        }
      }
    }

    // parms not used: 82, 89, 99, 139-149
    let tinf = p[30]
    for (let i = 0; i < 14; i++) {
      tinf += Math.abs(flags.sw[i + 1]) * t[i]
    }
    return tinf
  }

  // -------------------------------------------------------------------------
  // glob7s — lower atmosphere perturbation
  // -------------------------------------------------------------------------
  glob7s(p: number[], input: NrlmsiseInput, flags: NrlmsiseFlags): number {
    const pset = 2.0
    const t = new Array(14).fill(0)

    // confirm parameter set
    if (p[99] === 0) p[99] = pset
    if (p[99] !== pset) return -1

    const cd32 = Math.cos(DR * (input.doy - p[31]))
    const cd18 = Math.cos(2.0 * DR * (input.doy - p[17]))
    const cd14 = Math.cos(DR * (input.doy - p[13]))
    const cd39 = Math.cos(2.0 * DR * (input.doy - p[38]))

    // F10.7
    t[0] = p[21] * this.dfa

    // time independent
    t[1] = p[1] * this.plg[0][2] + p[2] * this.plg[0][4] + p[22] * this.plg[0][6] + p[26] * this.plg[0][1] + p[14] * this.plg[0][3] + p[59] * this.plg[0][5]

    // SYMMETRICAL ANNUAL
    t[2] = (p[18] + p[47] * this.plg[0][2] + p[29] * this.plg[0][4]) * cd32

    // SYMMETRICAL SEMIANNUAL
    t[3] = (p[15] + p[16] * this.plg[0][2] + p[30] * this.plg[0][4]) * cd18

    // ASYMMETRICAL ANNUAL
    t[4] = (p[9] * this.plg[0][1] + p[10] * this.plg[0][3] + p[20] * this.plg[0][5]) * cd14

    // ASYMMETRICAL SEMIANNUAL
    t[5] = p[37] * this.plg[0][1] * cd39

    // DIURNAL
    if (flags.sw[7]) {
      const t71 = p[11] * this.plg[1][2] * cd14 * flags.swc[5]
      const t72 = p[12] * this.plg[1][2] * cd14 * flags.swc[5]
      t[6] = (p[3] * this.plg[1][1] + p[4] * this.plg[1][3] + t71) * this.ctloc +
        (p[6] * this.plg[1][1] + p[7] * this.plg[1][3] + t72) * this.stloc
    }

    // SEMIDIURNAL
    if (flags.sw[8]) {
      const t81 = (p[23] * this.plg[2][3] + p[35] * this.plg[2][5]) * cd14 * flags.swc[5]
      const t82 = (p[33] * this.plg[2][3] + p[36] * this.plg[2][5]) * cd14 * flags.swc[5]
      t[7] = (p[5] * this.plg[2][2] + p[41] * this.plg[2][4] + t81) * this.c2tloc +
        (p[8] * this.plg[2][2] + p[42] * this.plg[2][4] + t82) * this.s2tloc
    }

    // TERDIURNAL
    if (flags.sw[14]) {
      t[13] = p[39] * this.plg[3][3] * this.s3tloc + p[40] * this.plg[3][3] * this.c3tloc
    }

    // MAGNETIC ACTIVITY
    if (flags.sw[9]) {
      if (flags.sw[9] === 1) {
        t[8] = this.apdf * (p[32] + p[45] * this.plg[0][2] * flags.swc[2])
      }
      if (flags.sw[9] === -1) {
        t[8] = p[50] * this.apt[0] + p[96] * this.plg[0][2] * this.apt[0] * flags.swc[2]
      }
    }

    // LONGITUDINAL
    if (!(flags.sw[10] === 0 || flags.sw[11] === 0 || input.gLon <= -1000.0)) {
      t[10] = (1.0 + this.plg[0][1] * (p[80] * flags.swc[5] * Math.cos(DR * (input.doy - p[81])) +
        p[85] * flags.swc[6] * Math.cos(2.0 * DR * (input.doy - p[86]))) +
        p[83] * flags.swc[3] * Math.cos(DR * (input.doy - p[84])) +
        p[87] * flags.swc[4] * Math.cos(2.0 * DR * (input.doy - p[88]))) *
        ((p[64] * this.plg[1][2] + p[65] * this.plg[1][4] + p[66] * this.plg[1][6] +
          p[74] * this.plg[1][1] + p[75] * this.plg[1][3] + p[76] * this.plg[1][5]) *
          Math.cos(DGTR * input.gLon) +
          (p[90] * this.plg[1][2] + p[91] * this.plg[1][4] + p[92] * this.plg[1][6] +
            p[77] * this.plg[1][1] + p[78] * this.plg[1][3] + p[79] * this.plg[1][5]) *
          Math.sin(DGTR * input.gLon))
    }

    let tt = 0
    for (let i = 0; i < 14; i++) {
      tt += Math.abs(flags.sw[i + 1]) * t[i]
    }
    return tt
  }

  // -------------------------------------------------------------------------
  // gts7 — thermospheric portion of NRLMSISE-00
  // -------------------------------------------------------------------------
  gts7(input: NrlmsiseInput, flags: NrlmsiseFlags): { d: number[]; t: number[] } {
    const zn1 = [120.0, 110.0, 100.0, 90.0, 72.5]
    const mn1 = 5
    const alpha = [-0.38, 0.0, 0.0, 0.0, 0.17, 0.0, -0.38, 0.0, 0.0]
    const altl = [200.0, 300.0, 160.0, 250.0, 240.0, 450.0, 320.0, 450.0]

    const d = new Array(9).fill(0)
    const t = new Array(2).fill(0)

    const za = pdl[1][15]
    zn1[0] = za

    // TINF VARIATIONS NOT IMPORTANT BELOW ZA OR ZN1(1)
    let tinf: number
    if (input.alt > zn1[0]) {
      tinf = ptm[0] * pt[0] * (1.0 + flags.sw[16] * this.globe7(pt, input, flags))
    } else {
      tinf = ptm[0] * pt[0]
    }
    t[0] = tinf

    // GRADIENT VARIATIONS NOT IMPORTANT BELOW ZN1(5)
    let g0_val: number
    if (input.alt > zn1[4]) {
      g0_val = ptm[3] * ps[0] * (1.0 + flags.sw[19] * this.globe7(ps, input, flags))
    } else {
      g0_val = ptm[3] * ps[0]
    }
    const tlb = ptm[1] * (1.0 + flags.sw[17] * this.globe7(pd[3], input, flags)) * pd[3][0]
    const s = g0_val / (tinf - tlb)

    // Lower thermosphere temp variations not significant for density above 300 km
    if (input.alt < 300.0) {
      this.meso_tn1[1] = ptm[6] * ptl[0][0] / (1.0 - flags.sw[18] * this.glob7s(ptl[0], input, flags))
      this.meso_tn1[2] = ptm[2] * ptl[1][0] / (1.0 - flags.sw[18] * this.glob7s(ptl[1], input, flags))
      this.meso_tn1[3] = ptm[7] * ptl[2][0] / (1.0 - flags.sw[18] * this.glob7s(ptl[2], input, flags))
      this.meso_tn1[4] = ptm[4] * ptl[3][0] / (1.0 - flags.sw[18] * flags.sw[20] * this.glob7s(ptl[3], input, flags))
      this.meso_tgn1[1] = ptm[8] * pma[8][0] * (1.0 + flags.sw[18] * flags.sw[20] * this.glob7s(pma[8], input, flags)) *
        this.meso_tn1[4] * this.meso_tn1[4] / Math.pow(ptm[4] * ptl[3][0], 2.0)
    } else {
      this.meso_tn1[1] = ptm[6] * ptl[0][0]
      this.meso_tn1[2] = ptm[2] * ptl[1][0]
      this.meso_tn1[3] = ptm[7] * ptl[2][0]
      this.meso_tn1[4] = ptm[4] * ptl[3][0]
      this.meso_tgn1[1] = ptm[8] * pma[8][0] * this.meso_tn1[4] * this.meso_tn1[4] / Math.pow(ptm[4] * ptl[3][0], 2.0)
    }

    const z0 = zn1[3]
    const t0 = this.meso_tn1[3]
    const tr12 = 1.0

    // N2 variation factor at Zlb
    const g28 = flags.sw[21] * this.globe7(pd[2], input, flags)

    // VARIATION OF TURBOPAUSE HEIGHT
    const zhf = pdl[1][24] * (1.0 + flags.sw[5] * pdl[0][24] * Math.sin(DGTR * input.gLat) * Math.cos(DR * (input.doy - pt[13])))
    t[0] = tinf
    const xmm = pdm[2][4]
    const z = input.alt

    // **** N2 DENSITY ****

    // Diffusive density at Zlb
    const db28 = pdm[2][0] * Math.exp(g28) * pd[2][0]
    // Diffusive density at Alt
    let result = this.densu(z, db28, tinf, tlb, 28.0, alpha[2], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[2] = result.density
    t[1] = result.tz
    this.dd = d[2]
    // Turbopause
    const zh28 = pdm[2][2] * zhf
    const zhm28 = pdm[2][3] * pdl[1][5]
    const xmd = 28.0 - xmm
    // Mixed density at Zlb
    let tz_tmp = 0
    const b28 = this.densu(zh28, db28, tinf, tlb, xmd, alpha[2] - 1.0, tz_tmp, ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1).density
    if (flags.sw[15] && z <= altl[2]) {
      // Mixed density at Alt
      this.dm28 = this.densu(z, b28, tinf, tlb, xmm, alpha[2], tz_tmp, ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1).density
      // Net density at Alt
      d[2] = this.dnet(d[2], this.dm28, zhm28, xmm, 28.0)
    }

    // **** HE DENSITY ****

    // Density variation factor at Zlb
    const g4 = flags.sw[21] * this.globe7(pd[0], input, flags)
    // Diffusive density at Zlb
    const db04 = pdm[0][0] * Math.exp(g4) * pd[0][0]
    // Diffusive density at Alt
    result = this.densu(z, db04, tinf, tlb, 4.0, alpha[0], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[0] = result.density
    t[1] = result.tz
    this.dd = d[0]
    if (flags.sw[15] && z < altl[0]) {
      // Turbopause
      const zh04 = pdm[0][2]
      // Mixed density at Zlb
      result = this.densu(zh04, db04, tinf, tlb, 4.0 - xmm, alpha[0] - 1.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      const b04 = result.density
      t[1] = result.tz
      // Mixed density at Alt
      result = this.densu(z, b04, tinf, tlb, xmm, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      this.dm04 = result.density
      t[1] = result.tz
      const zhm04 = zhm28
      // Net density at Alt
      d[0] = this.dnet(d[0], this.dm04, zhm04, xmm, 4.0)
      // Correction to specified mixing ratio at ground
      const rl = Math.log(b28 * pdm[0][1] / b04)
      const zc04 = pdm[0][4] * pdl[1][0]
      const hc04 = pdm[0][5] * pdl[1][1]
      // Net density corrected at Alt
      d[0] = d[0] * this.ccor(z, rl, hc04, zc04)
    }

    // **** O DENSITY ****

    // Density variation factor at Zlb
    const g16 = flags.sw[21] * this.globe7(pd[1], input, flags)
    // Diffusive density at Zlb
    const db16 = pdm[1][0] * Math.exp(g16) * pd[1][0]
    // Diffusive density at Alt
    result = this.densu(z, db16, tinf, tlb, 16.0, alpha[1], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[1] = result.density
    t[1] = result.tz
    this.dd = d[1]
    if (flags.sw[15] && z <= altl[1]) {
      // Turbopause
      const zh16 = pdm[1][2]
      // Mixed density at Zlb
      result = this.densu(zh16, db16, tinf, tlb, 16.0 - xmm, alpha[1] - 1.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      const b16 = result.density
      t[1] = result.tz
      // Mixed density at Alt
      result = this.densu(z, b16, tinf, tlb, xmm, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      this.dm16 = result.density
      t[1] = result.tz
      const zhm16 = zhm28
      // Net density at Alt
      d[1] = this.dnet(d[1], this.dm16, zhm16, xmm, 16.0)
      const rl = pdm[1][1] * pdl[1][16] * (1.0 + flags.sw[1] * pdl[0][23] * (input.f107a - 150.0))
      const hc16 = pdm[1][5] * pdl[1][3]
      const zc16 = pdm[1][4] * pdl[1][2]
      const hc216 = pdm[1][5] * pdl[1][4]
      d[1] = d[1] * this.ccor2(z, rl, hc16, zc16, hc216)
      // Chemistry correction
      const hcc16 = pdm[1][7] * pdl[1][13]
      const zcc16 = pdm[1][6] * pdl[1][12]
      const rc16 = pdm[1][3] * pdl[1][14]
      // Net density corrected at Alt
      d[1] = d[1] * this.ccor(z, rc16, hcc16, zcc16)
    }

    // **** O2 DENSITY ****

    // Density variation factor at Zlb
    const g32 = flags.sw[21] * this.globe7(pd[4], input, flags)
    // Diffusive density at Zlb
    const db32 = pdm[3][0] * Math.exp(g32) * pd[4][0]
    // Diffusive density at Alt
    result = this.densu(z, db32, tinf, tlb, 32.0, alpha[3], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[3] = result.density
    t[1] = result.tz
    this.dd = d[3]
    if (flags.sw[15]) {
      if (z <= altl[3]) {
        // Turbopause
        const zh32 = pdm[3][2]
        // Mixed density at Zlb
        result = this.densu(zh32, db32, tinf, tlb, 32.0 - xmm, alpha[3] - 1.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
        const b32 = result.density
        t[1] = result.tz
        // Mixed density at Alt
        result = this.densu(z, b32, tinf, tlb, xmm, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
        this.dm32 = result.density
        t[1] = result.tz
        const zhm32 = zhm28
        // Net density at Alt
        d[3] = this.dnet(d[3], this.dm32, zhm32, xmm, 32.0)
        // Correction to specified mixing ratio at ground
        const rl = Math.log(b28 * pdm[3][1] / b32)
        const hc32 = pdm[3][5] * pdl[1][7]
        const zc32 = pdm[3][4] * pdl[1][6]
        d[3] = d[3] * this.ccor(z, rl, hc32, zc32)
      }
      // Correction for general departure from diffusive equilibrium above Zlb
      const hcc32 = pdm[3][7] * pdl[1][22]
      const hcc232 = pdm[3][7] * pdl[0][22]
      const zcc32 = pdm[3][6] * pdl[1][21]
      const rc32 = pdm[3][3] * pdl[1][23] * (1.0 + flags.sw[1] * pdl[0][23] * (input.f107a - 150.0))
      // Net density corrected at Alt
      d[3] = d[3] * this.ccor2(z, rc32, hcc32, zcc32, hcc232)
    }

    // **** AR DENSITY ****

    // Density variation factor at Zlb
    const g40 = flags.sw[21] * this.globe7(pd[5], input, flags)
    // Diffusive density at Zlb
    const db40 = pdm[4][0] * Math.exp(g40) * pd[5][0]
    // Diffusive density at Alt
    result = this.densu(z, db40, tinf, tlb, 40.0, alpha[4], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[4] = result.density
    t[1] = result.tz
    this.dd = d[4]
    if (flags.sw[15] && z <= altl[4]) {
      // Turbopause
      const zh40 = pdm[4][2]
      // Mixed density at Zlb
      result = this.densu(zh40, db40, tinf, tlb, 40.0 - xmm, alpha[4] - 1.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      const b40 = result.density
      t[1] = result.tz
      // Mixed density at Alt
      result = this.densu(z, b40, tinf, tlb, xmm, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      this.dm40 = result.density
      t[1] = result.tz
      const zhm40 = zhm28
      // Net density at Alt
      d[4] = this.dnet(d[4], this.dm40, zhm40, xmm, 40.0)
      // Correction to specified mixing ratio at ground
      const rl = Math.log(b28 * pdm[4][1] / b40)
      const hc40 = pdm[4][5] * pdl[1][9]
      const zc40 = pdm[4][4] * pdl[1][8]
      // Net density corrected at Alt
      d[4] = d[4] * this.ccor(z, rl, hc40, zc40)
    }

    // **** HYDROGEN DENSITY ****

    // Density variation factor at Zlb
    const g1 = flags.sw[21] * this.globe7(pd[6], input, flags)
    // Diffusive density at Zlb
    const db01 = pdm[5][0] * Math.exp(g1) * pd[6][0]
    // Diffusive density at Alt
    result = this.densu(z, db01, tinf, tlb, 1.0, alpha[6], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[6] = result.density
    t[1] = result.tz
    this.dd = d[6]
    if (flags.sw[15] && z <= altl[6]) {
      // Turbopause
      const zh01 = pdm[5][2]
      // Mixed density at Zlb
      result = this.densu(zh01, db01, tinf, tlb, 1.0 - xmm, alpha[6] - 1.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      const b01 = result.density
      t[1] = result.tz
      // Mixed density at Alt
      result = this.densu(z, b01, tinf, tlb, xmm, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      this.dm01 = result.density
      t[1] = result.tz
      const zhm01 = zhm28
      // Net density at Alt
      d[6] = this.dnet(d[6], this.dm01, zhm01, xmm, 1.0)
      // Correction to specified mixing ratio at ground
      const rl = Math.log(b28 * pdm[5][1] * Math.sqrt(pdl[1][17] * pdl[1][17]) / b01)
      const hc01 = pdm[5][5] * pdl[1][11]
      const zc01 = pdm[5][4] * pdl[1][10]
      d[6] = d[6] * this.ccor(z, rl, hc01, zc01)
      // Chemistry correction
      const hcc01 = pdm[5][7] * pdl[1][19]
      const zcc01 = pdm[5][6] * pdl[1][18]
      const rc01 = pdm[5][3] * pdl[1][20]
      // Net density corrected at Alt
      d[6] = d[6] * this.ccor(z, rc01, hcc01, zcc01)
    }

    // **** ATOMIC NITROGEN DENSITY ****

    // Density variation factor at Zlb
    const g14 = flags.sw[21] * this.globe7(pd[7], input, flags)
    // Diffusive density at Zlb
    const db14 = pdm[6][0] * Math.exp(g14) * pd[7][0]
    // Diffusive density at Alt
    result = this.densu(z, db14, tinf, tlb, 14.0, alpha[7], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    d[7] = result.density
    t[1] = result.tz
    this.dd = d[7]
    if (flags.sw[15] && z <= altl[7]) {
      // Turbopause
      const zh14 = pdm[6][2]
      // Mixed density at Zlb
      result = this.densu(zh14, db14, tinf, tlb, 14.0 - xmm, alpha[7] - 1.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      const b14 = result.density
      t[1] = result.tz
      // Mixed density at Alt
      result = this.densu(z, b14, tinf, tlb, xmm, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
      this.dm14 = result.density
      t[1] = result.tz
      const zhm14 = zhm28
      // Net density at Alt
      d[7] = this.dnet(d[7], this.dm14, zhm14, xmm, 14.0)
      // Correction to specified mixing ratio at ground
      const rl = Math.log(b28 * pdm[6][1] * Math.sqrt(pdl[0][2] * pdl[0][2]) / b14)
      const hc14 = pdm[6][5] * pdl[0][1]
      const zc14 = pdm[6][4] * pdl[0][0]
      d[7] = d[7] * this.ccor(z, rl, hc14, zc14)
      // Chemistry correction
      const hcc14 = pdm[6][7] * pdl[0][4]
      const zcc14 = pdm[6][6] * pdl[0][3]
      const rc14 = pdm[6][3] * pdl[0][5]
      // Net density corrected at Alt
      d[7] = d[7] * this.ccor(z, rc14, hcc14, zcc14)
    }

    // **** Anomalous OXYGEN DENSITY ****

    const g16h = flags.sw[21] * this.globe7(pd[8], input, flags)
    const db16h = pdm[7][0] * Math.exp(g16h) * pd[8][0]
    const tho = pdm[7][9] * pdl[0][6]
    result = this.densu(z, db16h, tho, tho, 16.0, alpha[8], t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    this.dd = result.density
    t[1] = result.tz
    const zsht = pdm[7][5]
    const zmho = pdm[7][4]
    const zsho = this.scalh(zmho, 16.0, tho)
    d[8] = this.dd * Math.exp(-zsht / zsho * (Math.exp(-(z - zmho) / zsht) - 1.0))

    // total mass density
    d[5] = 1.66e-24 * (4.0 * d[0] + 16.0 * d[1] + 28.0 * d[2] + 32.0 * d[3] + 40.0 * d[4] + d[6] + 14.0 * d[7])
    const db48 = 1.66e-24 * (4.0 * db04 + 16.0 * db16 + 28.0 * db28 + 32.0 * db32 + 40.0 * db40 + db01 + 14.0 * db14)

    // temperature
    const zAbs = Math.sqrt(input.alt * input.alt)
    result = this.densu(zAbs, 1.0, tinf, tlb, 0.0, 0.0, t[1], ptm[5], s, mn1, zn1, this.meso_tn1, this.meso_tgn1)
    t[1] = result.tz
    if (flags.sw[0]) {
      for (let i = 0; i < 9; i++) {
        d[i] = d[i] * 1.0e6
      }
      d[5] = d[5] / 1000
    }
    return { d, t }
  }

  // -------------------------------------------------------------------------
  // gtd7 — main entry point
  // -------------------------------------------------------------------------
  gtd7(input: NrlmsiseInput, flags: NrlmsiseFlags): NrlmsiseOutput {
    const mn3 = 5
    const zn3 = [32.5, 20.0, 15.0, 10.0, 0.0]
    const mn2 = 4
    const zn2 = [72.5, 55.0, 45.0, 32.5]
    const zmix = 62.5

    this.tselec(flags)

    // Latitude variation of gravity (none for sw[2]=0)
    let xlat = input.gLat
    if (flags.sw[2] === 0) xlat = 45.0
    const glatResult = this.glatf(xlat)
    this.gsurf = glatResult.gv
    this.re = glatResult.reff

    const xmm = pdm[2][4]

    // THERMOSPHERE / MESOSPHERE (above zn2[0])
    let altt: number
    if (input.alt > zn2[0]) {
      altt = input.alt
    } else {
      altt = zn2[0]
    }

    const tmp = input.alt
    input.alt = altt

    const soutput = this.gts7(input, flags)
    altt = input.alt
    input.alt = tmp

    let dm28m: number
    if (flags.sw[0]) {
      dm28m = this.dm28 * 1.0e6
    } else {
      dm28m = this.dm28
    }

    const output: NrlmsiseOutput = {
      d: new Array(9).fill(0),
      t: new Array(2).fill(0),
    }

    output.t[0] = soutput.t[0]
    output.t[1] = soutput.t[1]
    if (input.alt >= zn2[0]) {
      for (let i = 0; i < 9; i++) {
        output.d[i] = soutput.d[i]
      }
      return output
    }

    // LOWER MESOSPHERE/UPPER STRATOSPHERE (between zn3[0] and zn2[0])
    this.meso_tgn2[0] = this.meso_tgn1[1]
    this.meso_tn2[0] = this.meso_tn1[4]
    this.meso_tn2[1] = pma[0][0] * pavgm[0] / (1.0 - flags.sw[20] * this.glob7s(pma[0], input, flags))
    this.meso_tn2[2] = pma[1][0] * pavgm[1] / (1.0 - flags.sw[20] * this.glob7s(pma[1], input, flags))
    this.meso_tn2[3] = pma[2][0] * pavgm[2] / (1.0 - flags.sw[20] * flags.sw[22] * this.glob7s(pma[2], input, flags))
    this.meso_tgn2[1] = pavgm[8] * pma[9][0] * (1.0 + flags.sw[20] * flags.sw[22] * this.glob7s(pma[9], input, flags)) *
      this.meso_tn2[3] * this.meso_tn2[3] / Math.pow(pma[2][0] * pavgm[2], 2.0)
    this.meso_tn3[0] = this.meso_tn2[3]

    if (input.alt < zn3[0]) {
      // LOWER STRATOSPHERE AND TROPOSPHERE (below zn3[0])
      this.meso_tgn3[0] = this.meso_tgn2[1]
      this.meso_tn3[1] = pma[3][0] * pavgm[3] / (1.0 - flags.sw[22] * this.glob7s(pma[3], input, flags))
      this.meso_tn3[2] = pma[4][0] * pavgm[4] / (1.0 - flags.sw[22] * this.glob7s(pma[4], input, flags))
      this.meso_tn3[3] = pma[5][0] * pavgm[5] / (1.0 - flags.sw[22] * this.glob7s(pma[5], input, flags))
      this.meso_tn3[4] = pma[6][0] * pavgm[6] / (1.0 - flags.sw[22] * this.glob7s(pma[6], input, flags))
      this.meso_tgn3[1] = pma[7][0] * pavgm[7] * (1.0 + flags.sw[22] * this.glob7s(pma[7], input, flags)) *
        this.meso_tn3[4] * this.meso_tn3[4] / Math.pow(pma[6][0] * pavgm[6], 2.0)
    }

    // LINEAR TRANSITION TO FULL MIXING BELOW zn2[0]
    let dmc = 0
    if (input.alt > zmix) {
      dmc = 1.0 - (zn2[0] - input.alt) / (zn2[0] - zmix)
    }
    const dz28 = soutput.d[2]

    // **** N2 density ****
    const dmr_n2 = soutput.d[2] / dm28m - 1.0
    let densm_result = this.densm(input.alt, dm28m, xmm, mn3, zn3, this.meso_tn3, this.meso_tgn3, mn2, zn2, this.meso_tn2, this.meso_tgn2)
    output.d[2] = densm_result.density
    output.d[2] = output.d[2] * (1.0 + dmr_n2 * dmc)

    // **** HE density ****
    const dmr_he = soutput.d[0] / (dz28 * pdm[0][1]) - 1.0
    output.d[0] = output.d[2] * pdm[0][1] * (1.0 + dmr_he * dmc)

    // **** O density ****
    output.d[1] = 0
    output.d[8] = 0

    // **** O2 density ****
    const dmr_o2 = soutput.d[3] / (dz28 * pdm[3][1]) - 1.0
    output.d[3] = output.d[2] * pdm[3][1] * (1.0 + dmr_o2 * dmc)

    // **** AR density ****
    const dmr_ar = soutput.d[4] / (dz28 * pdm[4][1]) - 1.0
    output.d[4] = output.d[2] * pdm[4][1] * (1.0 + dmr_ar * dmc)

    // **** Hydrogen density ****
    output.d[6] = 0

    // **** Atomic nitrogen density ****
    output.d[7] = 0

    // **** Total mass density ****
    output.d[5] = 1.66e-24 * (4.0 * output.d[0] + 16.0 * output.d[1] + 28.0 * output.d[2] + 32.0 * output.d[3] + 40.0 * output.d[4] + output.d[6] + 14.0 * output.d[7])

    if (flags.sw[0]) {
      output.d[5] = output.d[5] / 1000
    }

    // **** temperature at altitude ****
    densm_result = this.densm(input.alt, 1.0, 0, mn3, zn3, this.meso_tn3, this.meso_tgn3, mn2, zn2, this.meso_tn2, this.meso_tgn2)
    output.t[1] = densm_result.tz

    return output
  }

  // -------------------------------------------------------------------------
  // gtd7d — main entry including anomalous O for drag
  // -------------------------------------------------------------------------
  gtd7d(input: NrlmsiseInput, flags: NrlmsiseFlags): NrlmsiseOutput {
    const output = this.gtd7(input, flags)
    output.d[5] = 1.66e-24 * (4.0 * output.d[0] + 16.0 * output.d[1] + 28.0 * output.d[2] + 32.0 * output.d[3] + 40.0 * output.d[4] + output.d[6] + 14.0 * output.d[7] + 16.0 * output.d[8])
    if (flags.sw[0]) {
      output.d[5] = output.d[5] / 1000
    }
    return output
  }
}

// ---------------------------------------------------------------------------
// Solar presets
// ---------------------------------------------------------------------------

export const SOLAR_PRESETS = {
  low: { f107a: 70, f107: 70, ap: 4 },
  moderate: { f107a: 140, f107: 140, ap: 15 },
  high: { f107a: 200, f107: 200, ap: 30 },
} as const

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getDayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1
}

function createDefaultFlags(): NrlmsiseFlags {
  const flags: NrlmsiseFlags = {
    switches: new Array(24).fill(1),
    sw: new Array(24).fill(0),
    swc: new Array(24).fill(0),
  }
  flags.switches[0] = 0
  return flags
}

// ---------------------------------------------------------------------------
// Wrapper function
// ---------------------------------------------------------------------------

export function getNrlmsiseDensity(
  altKm: number,
  latDeg: number,
  lonDeg: number,
  date: Date,
  f107a: number,
  f107: number,
  ap: number,
): number {
  const doy = getDayOfYear(date)
  const sec = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds()
  const lst = sec / 3600 + lonDeg / 15

  const input: NrlmsiseInput = {
    year: date.getUTCFullYear(),
    doy,
    sec,
    alt: altKm,
    gLat: latDeg,
    gLon: lonDeg,
    lst,
    f107a,
    f107,
    ap,
  }

  const flags = createDefaultFlags()
  const model = new Nrlmsise00()
  const output = model.gtd7d(input, flags)

  // d[5] is total mass density in g/cm^3, convert to kg/m^3
  return output.d[5] * 1000
}
