import { useState, useEffect } from 'react'

/* ─── Section navigation data ─── */
const NAV_SECTIONS = [
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'tab-reference', label: 'Tab Reference' },
  { id: 'features', label: 'Features' },
  { id: 'faq', label: 'FAQ' },
]

const TAB_SECTIONS = [
  { id: 'mission-tab', num: '01', title: 'Mission', what: 'Define spacecraft physical properties — name, mass, dimensions, bus type.', inputs: 'Spacecraft name, total mass (kg), dimensions (U-size or custom), bus type (CubeSat 1U–12U, SmallSat, etc.)', outputs: 'Mass budget breakdown, spacecraft 3D preview.', tips: 'Mass affects delta-V budget and orbital lifetime calculations. Set this first as other tabs reference it.' },
  { id: 'orbit-tab', num: '02', title: 'Orbit', what: 'Design and visualize your orbit with Keplerian elements, 3D globe, and ground track.', inputs: 'Altitude (km), eccentricity, inclination (°), RAAN (°), argument of perigee (°), true anomaly (°).', outputs: 'Orbital period, velocity, 3D orbit visualization, 2D ground track, ground station visibility.', tips: 'Use the SSO preset button (~98°) for Earth observation missions. Enable numerical propagation (J2 or Full mode) for higher accuracy. At low altitudes (<400 km), enable drag in Full mode to see orbital decay.', extra: [
    { label: 'Presets', text: 'ISS (408 km/51.6°), Landsat (705 km SSO), Starlink (550 km/53°), Sentinel (786 km SSO), GPS (20,200 km MEO), GEO (35,786 km/0°), Molniya (HEO).' },
    { label: 'Overlays', text: 'Station coverage cones, sensor footprint, comm links, swath corridor — toggle these in the overlay panel.' },
    { label: 'Time Simulation', text: 'Play/pause, speed controls (1× to 1000×), rotating Earth with day/night cycle.' },
    { label: 'Propagation Modes', text: 'Keplerian (analytical, fast), J2 (numerical with J2 oblateness), Full (all perturbations — J2–J6, drag, SRP, third-body Sun/Moon). Full mode shows real orbital decay from atmospheric drag.' },
    { label: 'Sun-Sync Calculator', text: 'Automatically computes the required inclination for a sun-synchronous orbit at your current altitude.' },
  ] },
  { id: 'power-tab', num: '03', title: 'Power', what: 'Solar panel sizing, battery capacity, and eclipse analysis.', inputs: 'Solar panel area, efficiency, battery capacity, power consumption profile.', outputs: 'Power generation per orbit, eclipse duration, battery depth of discharge, power margin.', tips: 'Eclipse fraction increases with lower altitudes. Sun-synchronous dawn-dusk orbits minimize eclipse time.' },
  { id: 'passes-tab', num: '04', title: 'Passes', what: 'Ground station contact scheduling and communication analysis.', inputs: 'Ground station locations, minimum elevation angle, frequency band.', outputs: 'Pass timeline, contact duration, azimuth/elevation plots, link budget per pass.', tips: 'High-latitude ground stations (Svalbard, Fairbanks) get more passes for polar/SSO orbits. Add multiple stations for better coverage.' },
  { id: 'lifetime-tab', num: '05', title: 'Lifetime', what: 'Orbital decay estimation from atmospheric drag.', inputs: 'Spacecraft mass, cross-section area, drag coefficient, initial altitude.', outputs: 'Estimated orbital lifetime, de-orbit timeline, altitude vs time plot.', tips: 'Below 400 km, lifetime drops dramatically. CubeSats with high area-to-mass ratios decay faster. Use this to verify compliance with the 25-year de-orbit guideline (or the newer 5-year guideline).' },
  { id: 'constellation-tab', num: '06', title: 'Constellation', what: 'Design multi-satellite constellation patterns.', inputs: 'Number of planes, satellites per plane, relative spacing, Walker Delta parameters.', outputs: 'Constellation visualization, ground coverage analysis, revisit time.', tips: 'Walker Delta notation is T/P/F where T = total satellites, P = planes, F = phasing factor. Classic examples: GPS is 24/6/1, Iridium is 66/6/1.' },
  { id: 'deltav-tab', num: '07', title: 'Delta-V Budget', what: 'Maneuver planning and propellant mass estimation.', inputs: 'Required maneuvers (orbit raising, plane change, de-orbit, station-keeping), propulsion type, specific impulse.', outputs: 'Total delta-V required, propellant mass, remaining delta-V margin.', tips: 'A positive margin (green bar) means your propulsion system has enough delta-V. A negative margin (red bar) means you need more propellant or a more efficient thruster.', extra: [
    { label: 'Propulsion Presets', text: 'Cold Gas, Monopropellant, Bipropellant, Hall Thruster, Ion Thruster, Resistojet.' },
  ] },
  { id: 'radiation-tab', num: '08', title: 'Radiation', what: 'Radiation environment analysis and shielding requirements.', inputs: 'Orbit altitude, inclination, shielding thickness (aluminum equivalent).', outputs: 'Trapped particle flux, total ionizing dose (TID), dose vs shielding curve, Van Allen belt classification.', tips: 'The inner Van Allen belt (1,000–6,000 km) is the most intense radiation region. LEO satellites below 1,000 km experience relatively low radiation. Higher inclinations see more exposure from polar regions.' },
  { id: 'payload-tab', num: '09', title: 'Payload', what: 'Payload performance analysis for three payload types.', inputs: 'Payload-specific parameters (see sub-types below).', outputs: 'Payload-specific performance metrics.', tips: 'Use presets to see what established satellites achieve, then modify parameters for your design. GSD improves (smaller number) with lower altitude, longer focal length, or smaller pixel size.', extra: [
    { label: 'EO (Earth Observation)', text: 'Ground sample distance (GSD), swath width, field of view, SNR with full radiometric chain.' },
    { label: 'SAR (Synthetic Aperture Radar)', text: 'Resolution, NESZ, PRF ambiguity, data rate.' },
    { label: 'SATCOM (Satellite Comms)', text: 'Full link budget, EIRP, G/T, beam footprint.' },
    { label: 'Presets', text: 'PlanetScope, SkySat, Sentinel-1, Sentinel-2, ICEYE, Capella, VIREON, CubeSat UHF, Iridium, Starlink.' },
  ] },
  { id: 'beyond-leo-tab', num: '10', title: 'Beyond LEO', what: 'Mission design for destinations beyond Low Earth Orbit.', inputs: 'Destination and mission parameters (see sub-modules below).', outputs: 'Transfer trajectories, delta-V budgets, mission timelines.', tips: 'Start with Hohmann transfer for a quick estimate, then use Lambert solver with specific departure/arrival dates for more accurate results.', extra: [
    { label: 'Lagrange Points', text: 'Sun-Earth and Earth-Moon L1–L5, with Halo/Lissajous/Lyapunov orbit types. Computes transfer delta-V, station-keeping requirements. Validated against JWST (L2) and SOHO (L1).' },
    { label: 'Lunar Missions', text: 'Four mission types — Orbit Insertion, Flyby, Free-Return, and Landing. Uses RK4 numerical propagation with combined Earth+Moon gravity. Validated against Apollo TLI and LOI burns.' },
    { label: 'Interplanetary', text: 'Hohmann transfers and Lambert solver for all planets plus Ceres and Vesta. Porkchop plots for launch window analysis. Validated against Mars, Venus, and Jupiter missions.' },
  ] },
  { id: 'compare-tab', num: '11', title: 'Compare', what: 'Side-by-side comparison of two mission configurations.', inputs: 'Two saved mission configurations.', outputs: 'All parameters displayed side by side with differences highlighted.', tips: 'Useful for trade studies — compare different altitudes, inclinations, or payload configurations to see how they affect the overall mission.' },
]

const FEATURES = [
  { title: 'Save / Load', items: ['Save your complete mission configuration to a JSON file.', 'Load previously saved configurations.', 'Share configurations with teammates by sending the JSON file.'] },
  { title: 'PDF Report', items: ['Generate a comprehensive PDF mission report covering all active modules.', 'Includes all computed parameters, charts, and analysis results.'] },
  { title: 'CSV Export', items: ['Export data tables from any module as CSV files.', 'Available on all tables via the "Export CSV" button.'] },
  { title: 'Mission Architect', items: ['AI-powered conversational mission analysis.', 'Ask questions about your mission in natural language.', 'The AI has access to all your current mission parameters.'] },
  { title: 'Numerical Propagation', items: ['Three modes: Keplerian (analytical), J2 (numerical with oblateness), Full (all perturbations).', 'Full mode includes: J2–J6 zonal harmonics, atmospheric drag, solar radiation pressure, Sun and Moon third-body gravity.', 'Spacecraft properties (drag coefficient, SRP coefficient, cross-section area, mass) can be configured.', 'Osculating orbital elements update in real time during simulation.', 'Use the propagation orbits slider to control simulation duration.'] },
]

const FAQ_ITEMS = [
  { q: 'Do I need to create an account?', a: 'No. OrbitForge is free and requires no sign-up. Your mission data is saved locally in your browser.' },
  { q: 'Can I use OrbitForge on mobile?', a: 'The main analysis tool requires a desktop browser for the 3D visualization and complex interface. The landing page, validation page, and this guide are mobile-friendly.' },
  { q: 'How accurate is OrbitForge?', a: 'OrbitForge passes 21 validation tests against NASA/ESA mission data with errors typically below 1–2%. In Keplerian mode, it uses standard two-body analytical methods. In numerical propagation mode, it uses the same class of RK4 integration with perturbation models as professional tools like STK and GMAT. See the validation page for detailed test results.' },
  { q: 'Is OrbitForge open source?', a: 'The source code is available on GitHub. Contributions and feedback are welcome.' },
  { q: 'How do I report bugs or request features?', a: 'Reach out via LinkedIn (Alexander Hughes) or email nsaisolutions@gmail.com. All feedback is welcome.' },
  { q: 'What\u2019s the difference between Keplerian and Numerical propagation?', a: 'Keplerian mode uses closed-form equations assuming two-body gravity — fast and good for first estimates. Numerical mode integrates the equations of motion step-by-step with real perturbation forces (Earth\u2019s non-spherical gravity, atmospheric drag, solar pressure, Moon and Sun gravity). Numerical mode is more accurate for detailed mission planning, especially at low altitudes where drag matters.' },
]

const QUICK_START_STEPS = [
  {
    num: 1,
    title: 'Define Your Spacecraft',
    tab: 'Mission Tab',
    items: [
      'Open OrbitForge and click the "Mission" tab.',
      'Set your spacecraft name, mass (e.g., 4 kg for a typical 3U CubeSat), and dimensions.',
      'Select a bus type or leave defaults for quick analysis.',
    ],
  },
  {
    num: 2,
    title: 'Design Your Orbit',
    tab: 'Orbit Tab',
    items: [
      'Click the "Orbit" tab.',
      'Use a preset (ISS, Landsat, Starlink, etc.) or set custom orbital elements.',
      'Set altitude (e.g., 500 km), inclination (e.g., 97.4\u00B0 for sun-synchronous), and RAAN.',
      'The 3D globe shows your orbit in real time. The 2D Mercator map below shows the ground track.',
      'Hit play on the time simulation controls to watch the satellite move.',
    ],
  },
  {
    num: 3,
    title: 'Check Your Power Budget',
    tab: 'Power Tab',
    items: [
      'Click "Power" to see solar panel sizing, battery capacity, and eclipse analysis.',
      'The tool automatically computes eclipse duration based on your orbit.',
    ],
  },
  {
    num: 4,
    title: 'Find Ground Station Passes',
    tab: 'Passes Tab',
    items: [
      'Click "Passes" to see when your satellite can communicate with ground stations.',
      'Add or select ground stations from the map.',
      'View the pass timeline and link budget.',
    ],
  },
  {
    num: 5,
    title: 'Explore More',
    tab: 'All Tabs',
    items: [
      'Each tab adds a layer of analysis. Try them in order or jump to what you need.',
      'Use "Save/Load" to save your mission configuration.',
      'Use "Report" to generate a PDF mission report.',
      'Use "Compare" to compare two mission configurations side by side.',
    ],
  },
]

/* ─── Chevron icon ─── */
function ChevronIcon({ open }: { open: boolean }) {
  return (
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
        flexShrink: 0,
      }}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/* ─── Collapsible Section ─── */
function CollapsibleSection({
  id,
  label,
  tag,
  defaultOpen = false,
  children,
}: {
  id: string
  label: string
  tag?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id={id} style={{ marginBottom: '16px', scrollMarginTop: '80px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'rgba(17, 24, 39, 0.6)',
          border: '1px solid rgba(59, 130, 246, 0.12)',
          borderRadius: open ? '10px 10px 0 0' : '10px',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.12)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {tag && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#3B82F6',
                letterSpacing: '0.05em',
              }}
            >
              {tag}
            </span>
          )}
          <span
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '15px',
              fontWeight: 600,
              color: '#F9FAFB',
            }}
          >
            {label}
          </span>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          style={{
            padding: '20px 24px',
            background: 'rgba(10, 14, 23, 0.4)',
            border: '1px solid rgba(59, 130, 246, 0.08)',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
          }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

/* ─── Tab Reference Card ─── */
function TabCard({ tab }: { tab: typeof TAB_SECTIONS[number] }) {
  return (
    <div
      style={{
        background: 'rgba(17, 24, 39, 0.5)',
        border: '1px solid rgba(59, 130, 246, 0.08)',
        borderRadius: '8px',
        padding: '20px 24px',
      }}
    >
      <p style={{ fontSize: '14px', color: '#D1D5DB', lineHeight: 1.7, marginBottom: '16px' }}>
        {tab.what}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <DetailRow label="Inputs" text={tab.inputs} />
        <DetailRow label="Outputs" text={tab.outputs} />

        {tab.extra?.map((e) => (
          <DetailRow key={e.label} label={e.label} text={e.text} />
        ))}

        <div
          style={{
            fontSize: '13px',
            color: '#10B981',
            lineHeight: 1.6,
            padding: '10px 12px',
            background: 'rgba(16, 185, 129, 0.05)',
            borderRadius: '6px',
            borderLeft: '2px solid rgba(16, 185, 129, 0.3)',
            marginTop: '4px',
          }}
        >
          <span style={{ fontWeight: 600 }}>Tip: </span>
          {tab.tips}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6 }}>
      <span style={{ color: '#6B7280', fontWeight: 600 }}>{label}: </span>
      {text}
    </div>
  )
}

/* ─── Sidebar Nav (Desktop) ─── */
function SidebarNav({ activeSection }: { activeSection: string }) {
  return (
    <nav
      style={{
        position: 'sticky',
        top: '80px',
        width: '180px',
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#guide-${s.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: activeSection === s.id ? 600 : 400,
              color: activeSection === s.id ? '#3B82F6' : '#6B7280',
              textDecoration: 'none',
              borderLeft: activeSection === s.id
                ? '2px solid #3B82F6'
                : '2px solid transparent',
              transition: 'all 0.15s',
              borderRadius: '0 4px 4px 0',
            }}
            onMouseEnter={(e) => {
              if (activeSection !== s.id) e.currentTarget.style.color = '#9CA3AF'
            }}
            onMouseLeave={(e) => {
              if (activeSection !== s.id) e.currentTarget.style.color = '#6B7280'
            }}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

/* ─── Mobile Nav Dropdown ─── */
function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="guide-mobile-nav"
      style={{
        display: 'none',
        position: 'sticky',
        top: '56px',
        zIndex: 40,
        padding: '0 16px',
        background: 'rgba(10, 14, 23, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.08)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontFamily: "'IBM Plex Sans', sans-serif",
          color: '#9CA3AF',
        }}
      >
        Jump to section
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div style={{ paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#guide-${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                setOpen(false)
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: '#9CA3AF',
                textDecoration: 'none',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'
                e.currentTarget.style.color = '#F9FAFB'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#9CA3AF'
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ─── */
export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('quick-start')

  // Track which section is in view
  useEffect(() => {
    const ids = NAV_SECTIONS.map((s) => s.id)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="guide-page w-full min-h-screen"
      style={{ background: '#0A0E17', color: '#F9FAFB' }}
    >
      {/* Responsive styles */}
      <style>{`
        .guide-sidebar { display: block; }
        .guide-mobile-nav { display: none !important; }
        @media (max-width: 768px) {
          .guide-sidebar { display: none !important; }
          .guide-mobile-nav { display: block !important; }
          .guide-hero-links { flex-wrap: wrap; justify-content: center; }
        }
      `}</style>

      {/* ─── Top bar ─── */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href="#validation"
            style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#10B981')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
          >
            Validation
          </a>
          <a
            href="#"
            style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#9CA3AF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
          >
            &larr; Back to Home
          </a>
        </div>
      </div>

      {/* ─── Mobile Nav ─── */}
      <MobileNav />

      {/* ─── Hero Header ─── */}
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
            marginBottom: '16px',
          }}
        >
          User Guide
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#9CA3AF',
            marginBottom: '32px',
            lineHeight: 1.6,
          }}
        >
          Everything you need to design satellite missions with OrbitForge
        </p>

        {/* Quick-jump links */}
        <div
          className="guide-hero-links"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
        >
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#guide-${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 500,
                color: '#3B82F6',
                textDecoration: 'none',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.08)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
      </header>

      {/* ─── Body: Sidebar + Content ─── */}
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px 64px',
          display: 'flex',
          gap: '48px',
        }}
      >
        {/* Desktop sidebar */}
        <div className="guide-sidebar">
          <SidebarNav activeSection={activeSection} />
        </div>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* ═══════════════ Section 1: Quick Start ═══════════════ */}
          <div id="quick-start" style={{ scrollMarginTop: '80px', marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '22px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 700,
                color: '#F9FAFB',
                marginBottom: '8px',
              }}
            >
              Quick Start
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#9CA3AF',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              Get from zero to a complete mission analysis in five steps.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {QUICK_START_STEPS.map((step) => (
                <div
                  key={step.num}
                  style={{
                    background: 'rgba(17, 24, 39, 0.5)',
                    border: '1px solid rgba(59, 130, 246, 0.08)',
                    borderRadius: '8px',
                    padding: '20px 24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#3B82F6',
                        flexShrink: 0,
                      }}
                    >
                      {step.num}
                    </span>
                    <div>
                      <span
                        style={{
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#F9FAFB',
                        }}
                      >
                        {step.title}
                      </span>
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#06B6D4',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {step.tab}
                      </span>
                    </div>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {step.items.map((item, i) => (
                      <li key={i} style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════ Section 2: Tab Reference ═══════════════ */}
          <div id="tab-reference" style={{ scrollMarginTop: '80px', marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '22px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 700,
                color: '#F9FAFB',
                marginBottom: '8px',
              }}
            >
              Tab Reference
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#9CA3AF',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              Detailed guide for each module. Click a section to expand.
            </p>

            {TAB_SECTIONS.map((tab) => (
              <CollapsibleSection
                key={tab.id}
                id={tab.id}
                label={tab.title}
                tag={tab.num}
              >
                <TabCard tab={tab} />
              </CollapsibleSection>
            ))}
          </div>

          {/* ═══════════════ Section 3: Features Reference ═══════════════ */}
          <div id="features" style={{ scrollMarginTop: '80px', marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '22px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 700,
                color: '#F9FAFB',
                marginBottom: '8px',
              }}
            >
              Features
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#9CA3AF',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              Cross-cutting tools available across the application.
            </p>

            {FEATURES.map((feat) => (
              <CollapsibleSection
                key={feat.title}
                id={`feature-${feat.title.toLowerCase().replace(/[\s/]+/g, '-')}`}
                label={feat.title}
              >
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {feat.items.map((item, i) => (
                    <li key={i} style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            ))}
          </div>

          {/* ═══════════════ Section 4: FAQ ═══════════════ */}
          <div id="faq" style={{ scrollMarginTop: '80px', marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '22px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 700,
                color: '#F9FAFB',
                marginBottom: '8px',
              }}
            >
              FAQ
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#9CA3AF',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              Frequently asked questions about OrbitForge.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FAQ_ITEMS.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>

          {/* ─── Mobile CTA ─── */}
          <div
            className="mobile-only-note"
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '10px',
              marginTop: '8px',
              padding: '14px 20px',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '10px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              Open OrbitForge on a desktop browser to access the full mission planning toolkit.
            </span>
          </div>
        </main>
      </div>

      {/* ─── Footer ─── */}
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

/* ─── FAQ Item ─── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        background: 'rgba(17, 24, 39, 0.5)',
        border: '1px solid rgba(59, 130, 246, 0.08)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            color: '#F9FAFB',
          }}
        >
          {q}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div
          style={{
            padding: '0 20px 16px',
            fontSize: '13px',
            color: '#9CA3AF',
            lineHeight: 1.7,
          }}
        >
          {a}
        </div>
      )}
    </div>
  )
}
