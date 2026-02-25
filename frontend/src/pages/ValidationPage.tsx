import { useState } from 'react'

/* ─── Status types ─── */
type TestStatus = 'PASS' | 'CLOSE' | 'INVESTIGATE' | 'FAIL'

interface ValidationTest {
  id: string
  name: string
  mission: string
  inputs: string
  orbitForge: string
  published: string
  sourceLabel?: string
  sourceUrl?: string
  error: string
  status: TestStatus
  note?: string
  bonus?: string
}

interface TestGroup {
  title: string
  tests: ValidationTest[]
}

/* ─── All 21 tests ─── */
const TEST_GROUPS: TestGroup[] = [
  {
    title: 'LEO Orbit Design',
    tests: [
      {
        id: '1.1',
        name: 'ISS Orbital Period',
        mission: 'International Space Station',
        inputs: 'Altitude 408 km, Eccentricity 0, Inclination 51.6\u00B0',
        orbitForge: '92.7 min',
        published: '92.68 min',
        sourceLabel: 'NASA ISS Facts & Figures',
        sourceUrl: 'https://www.nasa.gov/reference/international-space-station-facts-and-figures/',
        error: '0.02%',
        status: 'PASS',
      },
      {
        id: '1.2',
        name: 'ISS Orbital Velocity',
        mission: 'International Space Station',
        inputs: 'Altitude 408 km, Eccentricity 0, Inclination 51.6\u00B0',
        orbitForge: '7.664 km/s',
        published: '7.66 km/s',
        sourceLabel: 'NASA ISS Facts & Figures',
        sourceUrl: 'https://www.nasa.gov/reference/international-space-station-facts-and-figures/',
        error: '0.05%',
        status: 'PASS',
      },
      {
        id: '1.3',
        name: 'Starlink Orbital Period',
        mission: 'Starlink Gen 2 Shell 1',
        inputs: 'Altitude 550 km, Eccentricity 0, Inclination 53\u00B0',
        orbitForge: '95.6 min',
        published: '95.6 min',
        sourceLabel: 'SpaceX FCC Filing',
        sourceUrl: 'https://fcc.report/IBFS/SAT-MOD-20200417-00037',
        error: '0.00%',
        status: 'PASS',
      },
      {
        id: '1.4',
        name: 'Sun-Synchronous Inclination',
        mission: 'Standard SSO at 500 km',
        inputs: 'Altitude 500 km, SSO mode',
        orbitForge: '97.40\u00B0',
        published: '97.4\u00B0',
        sourceLabel: 'Wertz, Space Mission Analysis & Design',
        error: '0.00%',
        status: 'PASS',
        bonus: 'RAAN drift shows 0.9856\u00B0/day (exact SSO requirement of 360\u00B0/365.25 days)',
      },
      {
        id: '1.5',
        name: 'Geostationary Period',
        mission: 'Standard GEO',
        inputs: 'Altitude 35,786 km, Eccentricity 0, Inclination 0\u00B0',
        orbitForge: '1436.1 min (1.00 rev/day)',
        published: '1436.0 min (sidereal day)',
        error: '0.007%',
        status: 'PASS',
        bonus: 'Velocity 3.075 km/s matches published GEO velocity exactly',
      },
    ],
  },
  {
    title: 'Lagrange Points',
    tests: [
      {
        id: '2.1',
        name: 'JWST L2 Distance',
        mission: 'James Webb Space Telescope',
        inputs: 'Sun-Earth L2, Halo orbit, 200 km departure',
        orbitForge: '1.501M km',
        published: '1.5M km',
        sourceLabel: 'NASA JWST',
        sourceUrl: 'https://webb.nasa.gov/content/about/orbit.html',
        error: '0.07%',
        status: 'PASS',
      },
      {
        id: '2.2',
        name: 'JWST Transfer Time',
        mission: 'James Webb Space Telescope',
        inputs: 'Sun-Earth L2, Halo orbit, 200 km departure',
        orbitForge: '30 days',
        published: '~30 days (Dec 25 2021 \u2192 Jan 24 2022)',
        error: '0.00%',
        status: 'PASS',
      },
      {
        id: '2.3',
        name: 'JWST Station-Keeping \u0394V',
        mission: 'James Webb Space Telescope',
        inputs: 'Sun-Earth L2, Halo orbit, 200 km departure',
        orbitForge: '3.3 m/s/yr',
        published: '2\u20134 m/s/yr',
        sourceLabel: 'NASA NTRS',
        error: 'Within published range',
        status: 'PASS',
        note: 'JWST actual insertion burn was only 1.6 m/s due to exceptionally precise Ariane 5 launch. OrbitForge shows 15 m/s planning budget \u2014 a conservative estimate appropriate for mission planning.',
      },
      {
        id: '2.4',
        name: 'SOHO L1 Distance',
        mission: 'SOHO Solar Observatory',
        inputs: 'Sun-Earth L1, Halo orbit',
        orbitForge: '1.491M km',
        published: '~1.5M km',
        sourceLabel: 'NASA/ESA SOHO',
        error: '0.6%',
        status: 'PASS',
        note: 'L1 is slightly closer than L2 (1.491M vs 1.501M km) due to gravitational potential asymmetry \u2014 physically correct.',
      },
    ],
  },
  {
    title: 'Lunar Missions',
    tests: [
      {
        id: '3.1',
        name: 'Apollo TLI \u0394V',
        mission: 'Apollo 11 (Trans-Lunar Injection)',
        inputs: '185 km parking orbit, 100 km target lunar orbit',
        orbitForge: '3135 m/s',
        published: '3100\u20133250 m/s',
        sourceLabel: 'Apollo Mission Reports',
        error: 'Within published range',
        status: 'PASS',
      },
      {
        id: '3.2',
        name: 'Apollo LOI \u0394V',
        mission: 'Apollo 11 (Lunar Orbit Insertion)',
        inputs: '185 km parking orbit, 100 km target lunar orbit',
        orbitForge: '821 m/s',
        published: '800\u2013900 m/s',
        sourceLabel: 'Apollo Mission Reports',
        error: 'Within published range',
        status: 'PASS',
      },
      {
        id: '3.3',
        name: 'Lunar Orbit Period at 100 km',
        mission: 'Apollo verification',
        inputs: '100 km circular lunar orbit',
        orbitForge: '117.8 min',
        published: '~118 min',
        error: '0.17%',
        status: 'PASS',
      },
      {
        id: '3.4',
        name: 'Free-Return Trip Duration',
        mission: 'Apollo 13 (Free-Return Trajectory)',
        inputs: '185 km parking orbit, free-return',
        orbitForge: '10.0 days',
        published: '~10 days (Apollo 13)',
        error: '0.00%',
        status: 'PASS',
        bonus: 'LOI \u0394V = 0 m/s (correct \u2014 free-return requires no capture burn)',
      },
      {
        id: '3.5',
        name: 'Lunar Landing Total \u0394V',
        mission: 'Apollo-class lunar landing',
        inputs: '200 km parking orbit, 100 km target orbit',
        orbitForge: '5652 m/s (TLI: 3131 + LOI+Landing: 2521)',
        published: '5500\u20135800 m/s',
        sourceLabel: 'Apollo Mission Budgets',
        error: 'Within published range',
        status: 'PASS',
      },
    ],
  },
  {
    title: 'Interplanetary Transfers',
    tests: [
      {
        id: '4.1',
        name: 'Mars Hohmann Transfer',
        mission: 'Standard Mars Hohmann',
        inputs: '200 km parking, 300 km arrival orbit',
        orbitForge: 'C3 = 8.7 km\u00B2/s\u00B2, Transfer = 259 days, \u0394V = 5702 m/s',
        published: 'C3 \u2248 8.6 km\u00B2/s\u00B2, Transfer \u2248 259 days',
        error: 'C3 1.2%, Transfer 0.00%',
        status: 'PASS',
        bonus: 'Mars radius 3390 km \u2713, surface gravity 3.71 m/s\u00B2 \u2713, synodic period 780 days \u2713',
      },
      {
        id: '4.2',
        name: 'Venus Hohmann Transfer',
        mission: 'Standard Venus Hohmann',
        inputs: '200 km parking, 300 km arrival orbit',
        orbitForge: 'C3 = 6.2 km\u00B2/s\u00B2, Transfer = 146 days, \u0394V = 6822 m/s',
        published: 'C3 \u2248 6\u20138 km\u00B2/s\u00B2, Transfer \u2248 146 days',
        error: 'Within range, Transfer 0.00%',
        status: 'PASS',
        bonus: 'Venus radius 6052 km \u2713, surface gravity 8.87 m/s\u00B2 \u2713, synodic period 584 days \u2713',
      },
      {
        id: '4.3',
        name: 'Jupiter Hohmann Transfer',
        mission: 'Standard Jupiter Hohmann',
        inputs: '200 km parking orbit',
        orbitForge: 'C3 = 77.3 km\u00B2/s\u00B2, Transfer = 997 days, \u0394V = 8028 m/s',
        published: 'C3 \u2248 76\u201380 km\u00B2/s\u00B2, Transfer \u2248 997 days (2.73 years)',
        error: 'Within range, Transfer 0.00%',
        status: 'PASS',
        note: 'Juno\u2019s actual launch C3 was only 31.1 km\u00B2/s\u00B2 because it used an Earth gravity assist. OrbitForge correctly computes the direct transfer energy.',
      },
      {
        id: '4.4',
        name: 'Mars Lambert (Perseverance Window)',
        mission: 'Mars 2020 Perseverance',
        inputs: 'Departure 07/30/2020, Arrival 02/18/2021, 200 km parking',
        orbitForge: 'C3 = 13.2 km\u00B2/s\u00B2, Transfer = 203 days, Dep \u0394V = 3809 m/s',
        published: 'C3 \u2248 12\u201315 km\u00B2/s\u00B2, Transfer = 204 days',
        sourceLabel: 'NASA Mars 2020',
        sourceUrl: 'https://mars.nasa.gov/mars2020/',
        error: 'C3 within range, Transfer 0.5%',
        status: 'PASS',
        note: 'Perseverance launched on Atlas V-541 with max C3 ~15 km\u00B2/s\u00B2 for its 4150 kg mass. OrbitForge\u2019s 13.2 falls within this constraint.',
      },
      {
        id: '4.5',
        name: 'Venus Lambert (Venus Express Window)',
        mission: 'Venus Express',
        inputs: 'Departure 11/09/2005, Arrival 04/11/2006, 200 km parking',
        orbitForge: 'C3 = 7.9 km\u00B2/s\u00B2, Transfer = 153 days, Dep \u0394V = 3579 m/s',
        published: 'C3 \u2248 7\u201312 km\u00B2/s\u00B2, Transfer \u2248 153 days',
        error: 'Transfer correct, C3 in range',
        status: 'PASS',
      },
      {
        id: '4.6',
        name: 'Jupiter Lambert (Direct Transfer)',
        mission: 'Direct Jupiter transfer (Juno departure window)',
        inputs: 'Departure 08/05/2011, Arrival 12/01/2014, 200 km parking',
        orbitForge: 'C3 = 85.8 km\u00B2/s\u00B2, Transfer = 1214 days, Dep \u0394V = 6603 m/s',
        published: 'Direct transfer C3 \u2248 80\u201390 km\u00B2/s\u00B2 (Hohmann min: 77.3)',
        error: 'Within expected range',
        status: 'PASS',
        note: 'Juno\u2019s actual launch C3 was only 31.1 km\u00B2/s\u00B2 using an Earth gravity assist. The difference between direct (85.8) and gravity-assist (31.1) demonstrates why outer planet missions use flybys.',
      },
    ],
  },
  {
    title: 'Payload Analysis',
    tests: [
      {
        id: '5.1',
        name: 'Sentinel-2 Ground Sample Distance',
        mission: 'Sentinel-2 MSI (Copernicus/ESA)',
        inputs: '786 km SSO, Focal 600 mm, Aperture 150 mm, Pixel 7.6 \u03BCm',
        orbitForge: 'GSD = 9.96 m (nadir)',
        published: '10 m',
        sourceLabel: 'ESA Sentinel-2 Spec',
        sourceUrl: 'https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi/resolutions/spatial',
        error: '0.4%',
        status: 'PASS',
        note: 'Swath width shows 81.6 km vs Sentinel-2\u2019s 290 km because Sentinel-2 uses 12 staggered detectors. OrbitForge correctly computes swath for the single detector specified.',
      },
    ],
  },
]

/* ─── Computed stats ─── */
function computeStats(groups: TestGroup[]) {
  let total = 0
  let passed = 0
  const groupStats = groups.map((g) => {
    const groupTotal = g.tests.length
    const groupPassed = g.tests.filter((t) => t.status === 'PASS' || t.status === 'CLOSE').length
    total += groupTotal
    passed += groupPassed
    return { title: g.title, passed: groupPassed, total: groupTotal }
  })
  return { total, passed, groupStats }
}

/* ─── Status badge styles ─── */
const STATUS_STYLES: Record<TestStatus, { bg: string; text: string; border: string }> = {
  PASS: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  CLOSE: { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  INVESTIGATE: { bg: 'rgba(249, 115, 22, 0.12)', text: '#F97316', border: 'rgba(249, 115, 22, 0.3)' },
  FAIL: { bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
}

function StatusBadge({ status }: { status: TestStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        letterSpacing: '0.05em',
        borderRadius: '4px',
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
      }}
    >
      {status}
    </span>
  )
}

/* ─── Test Card ─── */
function TestCard({ test }: { test: ValidationTest }) {
  return (
    <div
      style={{
        background: 'rgba(17, 24, 39, 0.5)',
        border: '1px solid rgba(59, 130, 246, 0.08)',
        borderRadius: '8px',
        padding: '20px 24px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <StatusBadge status={test.status} />
        <span
          style={{
            fontSize: '15px',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            color: '#F9FAFB',
          }}
        >
          Test {test.id} — {test.name}
        </span>
      </div>

      {/* Mission & Inputs */}
      <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '14px', lineHeight: 1.6 }}>
        <div>
          <span style={{ color: '#6B7280' }}>Mission:</span> {test.mission}
        </div>
        <div>
          <span style={{ color: '#6B7280' }}>Inputs:</span> {test.inputs}
        </div>
      </div>

      {/* Values comparison */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 24px',
          fontSize: '13px',
          marginBottom: test.note || test.bonus ? '14px' : '0',
        }}
      >
        <div>
          <span style={{ color: '#6B7280' }}>Published: </span>
          <span style={{ color: '#D1D5DB', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
            {test.published}
          </span>
        </div>
        <div>
          {test.sourceUrl ? (
            <a
              href={test.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3B82F6', fontSize: '12px', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              {test.sourceLabel || 'Source'} &rarr;
            </a>
          ) : test.sourceLabel ? (
            <span style={{ color: '#6B7280', fontSize: '12px' }}>{test.sourceLabel}</span>
          ) : null}
        </div>
        <div>
          <span style={{ color: '#6B7280' }}>OrbitForge: </span>
          <span style={{ color: '#06B6D4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
            {test.orbitForge}
          </span>
        </div>
        <div>
          <span style={{ color: '#6B7280' }}>Error: </span>
          <span
            style={{
              color: test.error.startsWith('0.0') || test.error === 'Within published range' || test.error.includes('0.00%')
                ? '#10B981'
                : '#D1D5DB',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
            }}
          >
            {test.error}
          </span>
        </div>
      </div>

      {/* Note */}
      {test.note && (
        <div
          style={{
            fontSize: '12px',
            color: '#9CA3AF',
            lineHeight: 1.6,
            padding: '10px 12px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '6px',
            borderLeft: '2px solid rgba(59, 130, 246, 0.3)',
            marginBottom: test.bonus ? '8px' : '0',
          }}
        >
          {test.note}
        </div>
      )}

      {/* Bonus */}
      {test.bonus && (
        <div
          style={{
            fontSize: '12px',
            color: '#10B981',
            lineHeight: 1.6,
            padding: '10px 12px',
            background: 'rgba(16, 185, 129, 0.05)',
            borderRadius: '6px',
            borderLeft: '2px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          {test.bonus}
        </div>
      )}
    </div>
  )
}

/* ─── Collapsible Group ─── */
function TestGroupSection({
  group,
  index,
  stats,
}: {
  group: TestGroup
  index: number
  stats: { passed: number; total: number }
}) {
  const [open, setOpen] = useState(true)

  return (
    <section style={{ marginBottom: '32px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'rgba(17, 24, 39, 0.6)',
          border: '1px solid rgba(59, 130, 246, 0.12)',
          borderRadius: open ? '10px 10px 0 0' : '10px',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.12)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              color: '#3B82F6',
              letterSpacing: '0.05em',
            }}
          >
            GROUP {index + 1}
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '16px',
              fontWeight: 600,
              color: '#F9FAFB',
            }}
          >
            {group.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              color: stats.passed === stats.total ? '#10B981' : '#F59E0B',
            }}
          >
            {stats.passed}/{stats.total} Passed
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            background: 'rgba(10, 14, 23, 0.4)',
            border: '1px solid rgba(59, 130, 246, 0.08)',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
          }}
        >
          {group.tests.map((test) => (
            <TestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ─── Main Page ─── */
export default function ValidationPage() {
  const { total, passed, groupStats } = computeStats(TEST_GROUPS)

  return (
    <div
      className="validation-page w-full min-h-screen"
      style={{ background: '#0A0E17', color: '#F9FAFB' }}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          background: 'rgba(10, 14, 23, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
        }}
      >
        <a
          href="#"
          style={{
            fontSize: '14px',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            color: '#9CA3AF',
            textDecoration: 'none',
            letterSpacing: '0.1em',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F9FAFB')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
        >
          ORBITFORGE
        </a>
        <a
          href="#"
          style={{
            fontSize: '13px',
            color: '#6B7280',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#9CA3AF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
        >
          &larr; Back to Home
        </a>
      </div>

      {/* Header */}
      <header
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '64px 24px 48px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 700,
            color: '#F9FAFB',
            marginBottom: '24px',
          }}
        >
          Physics Validation
        </h1>

        {/* Score badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 28px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            marginBottom: '28px',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '20px',
              fontWeight: 700,
              color: '#10B981',
            }}
          >
            {passed}/{total}
          </span>
          <span style={{ fontSize: '15px', color: '#D1D5DB' }}>
            Tests Passed — Physics Validated Against NASA/ESA Mission Data
          </span>
        </div>

        {/* Intro */}
        <p
          style={{
            fontSize: '15px',
            color: '#9CA3AF',
            lineHeight: 1.7,
            maxWidth: '720px',
            margin: '0 auto',
          }}
        >
          Every calculation in OrbitForge is validated against real mission data from agencies including
          NASA, ESA, and published aerospace references. Below are {total} tests comparing OrbitForge outputs
          against known values. All modules — orbit design, Lagrange points, lunar transfers,
          interplanetary transfers (Hohmann and Lambert), and payload analysis — pass within published
          accuracy ranges.
        </p>
      </header>

      {/* Test Groups */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 64px' }}>
        {TEST_GROUPS.map((group, i) => (
          <TestGroupSection
            key={group.title}
            group={group}
            index={i}
            stats={groupStats[i]}
          />
        ))}

        {/* Footer note */}
        <div
          style={{
            marginTop: '32px',
            padding: '20px 24px',
            background: 'rgba(17, 24, 39, 0.5)',
            border: '1px solid rgba(59, 130, 246, 0.08)',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#9CA3AF',
            lineHeight: 1.7,
          }}
        >
          All {total} tests pass within published accuracy ranges. OrbitForge computes direct
          (non-gravity-assist) transfers. For outer planet missions like Jupiter, real spacecraft
          typically use gravity assists to significantly reduce energy requirements. Last updated:
          February 2026.
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '14px',
          color: '#6B7280',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        <span>OrbitForge — North Star AI Solutions</span>
        <span>&copy; 2026</span>
      </footer>
    </div>
  )
}
