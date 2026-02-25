import heroScreenshot from '@/assets/hero-screenshot.png'

const MODULES = [
  {
    number: '01',
    title: 'Mission Config',
    description: 'Define spacecraft bus, solar arrays, and ground stations',
  },
  {
    number: '02',
    title: 'Orbit Design',
    description: '3D globe with Keplerian elements and ground tracks',
  },
  {
    number: '03',
    title: 'Power Budget',
    description: 'Solar power analysis with BOL/EOL margins',
  },
  {
    number: '04',
    title: 'Ground Passes',
    description: 'Contact window prediction and data throughput',
  },
  {
    number: '05',
    title: 'Orbital Lifetime',
    description: 'Atmospheric drag decay and 25-year compliance',
  },
  {
    number: '06',
    title: 'Constellation',
    description: 'Walker Delta patterns and coverage analysis',
  },
  {
    number: '07',
    title: 'Delta-V Budget',
    description: 'Propulsion sizing with Tsiolkovsky equation',
  },
  {
    number: '08',
    title: 'Radiation',
    description: 'TID estimation with Van Allen belt modeling',
  },
  {
    number: '09',
    title: 'Payload Analysis',
    description: 'EO, SAR, and SATCOM payload design with link budgets',
  },
  {
    number: '10',
    title: 'Mission Compare',
    description: 'Save and compare scenarios side-by-side',
  },
]

function enterApp() {
  window.location.hash = '#app'
}

export default function LandingPage() {
  return (
    <div
      className="landing-page w-full min-h-screen"
      style={{ background: '#0A0E17', color: '#F9FAFB' }}
    >
      {/* ─── Hero Section ─── */}
      <section
        className="min-h-screen flex flex-col items-center justify-center px-4 relative"
        style={{
          backgroundImage: `url(${heroScreenshot})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(10,14,23,0.85) 0%, rgba(10,14,23,0.7) 40%, rgba(10,14,23,0.85) 100%)',
          }}
        />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6 z-10">
          <span
            className="text-sm font-semibold tracking-wide"
            style={{ color: '#9CA3AF', fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            North Star AI Solutions
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="#validation"
              className="text-sm transition-all duration-200"
              style={{
                color: '#6B7280',
                textDecoration: 'none',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10B981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
            >
              Validated against NASA/ESA data &rarr;
            </a>
            <button
              onClick={enterApp}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3B82F6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
              }}
            >
              Open App
            </button>
          </div>
        </div>

        {/* Hero content */}
        <div className="flex flex-col items-center text-center mx-auto w-full relative z-10" style={{ gap: '32px', maxWidth: '800px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <p
              style={{
                fontSize: '14px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 500,
                color: '#3B82F6',
                letterSpacing: '0.05em',
              }}
            >
              The free alternative to STK for small satellite teams
            </p>
            <h1
              className="font-bold tracking-widest"
              style={{
                fontSize: 'clamp(40px, 6vw, 64px)',
                fontFamily: "'IBM Plex Sans', sans-serif",
                letterSpacing: '0.15em',
                color: '#F9FAFB',
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              }}
            >
              ORBITFORGE
            </h1>
            <p
              style={{
                fontSize: 'clamp(16px, 2.5vw, 22px)',
                color: '#D1D5DB',
                fontFamily: "'IBM Plex Sans', sans-serif",
                textShadow: '0 1px 10px rgba(0,0,0,0.5)',
              }}
            >
              Professional CubeSat Mission Design
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center" style={{ gap: '16px' }}>
            <button
              onClick={enterApp}
              className="font-semibold transition-all duration-200 cursor-pointer"
              style={{
                padding: '16px 48px',
                fontSize: '16px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                background: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.5)'
                e.currentTarget.style.background = '#2563EB'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)'
                e.currentTarget.style.background = '#3B82F6'
              }}
            >
              Try it Now
            </button>
            <span style={{ fontSize: '14px', color: '#9CA3AF' }}>
              Free — No signup required
            </span>
            <a
              href="#validation"
              className="transition-all duration-200"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '8px',
                fontSize: '13px',
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: '#9CA3AF',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10B981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" stroke="#10B981" strokeWidth="1.5" />
                <path d="M4.5 7l1.8 1.8L9.5 5.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              21/21 Tests Validated Against NASA/ESA Mission Data
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 pulse-glow z-10"
          style={{ color: '#9CA3AF' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 13l5 5 5-5M7 7l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section
        className="px-4"
        style={{ padding: '96px 16px', maxWidth: '1200px', margin: '0 auto' }}
      >
        <div className="text-center" style={{ marginBottom: '64px' }}>
          <h2
            className="font-bold"
            style={{
              fontSize: '32px',
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: '#F9FAFB',
              marginBottom: '16px',
            }}
          >
            10 Powerful Modules
          </h2>
          <p style={{ fontSize: '16px', color: '#9CA3AF', maxWidth: '600px', margin: '0 auto' }}>
            Everything you need to design, analyze, and optimize CubeSat missions
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {MODULES.map((mod) => (
            <div
              key={mod.number}
              className="transition-all duration-200 cursor-default"
              style={{
                background: 'rgba(17, 24, 39, 0.6)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                padding: '24px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#3B82F6',
                  letterSpacing: '0.05em',
                }}
              >
                {mod.number}
              </span>
              <h3
                style={{
                  fontSize: '18px',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 600,
                  color: '#F9FAFB',
                  marginTop: '8px',
                  marginBottom: '8px',
                }}
              >
                {mod.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: 1.5 }}>
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Founder Story Section ─── */}
      <section
        style={{
          padding: '96px 16px',
          background: 'linear-gradient(180deg, #0A0E17 0%, #111827 100%)',
        }}
      >
        <div
          className="text-center"
          style={{ maxWidth: '720px', margin: '0 auto' }}
        >
          <blockquote
            style={{
              fontSize: 'clamp(20px, 3vw, 24px)',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontStyle: 'italic',
              fontWeight: 300,
              color: '#F9FAFB',
              lineHeight: 1.6,
              marginBottom: '32px',
            }}
          >
            "Built by an 18-year-old aerospace enthusiast who believes
            professional-grade mission design tools should be accessible
            to everyone."
          </blockquote>

          <div
            style={{
              fontSize: '20px',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 600,
              color: '#3B82F6',
              marginBottom: '24px',
            }}
          >
            North Star AI Solutions
          </div>

          <p
            style={{
              fontSize: '16px',
              color: '#9CA3AF',
              lineHeight: 1.7,
              marginBottom: '48px',
            }}
          >
            OrbitForge puts real engineering analysis in your browser — no
            expensive licenses, no complex installations. Whether you're a
            university team, a hobbyist designer, or a startup building your
            first satellite, design with confidence.
          </p>

          <button
            onClick={enterApp}
            className="font-semibold transition-all duration-200 cursor-pointer"
            style={{
              padding: '16px 48px',
              fontSize: '16px',
              fontFamily: "'IBM Plex Sans', sans-serif",
              background: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)'
              e.currentTarget.style.background = '#2563EB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.3)'
              e.currentTarget.style.background = '#3B82F6'
            }}
          >
            Launch OrbitForge
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        className="flex items-center justify-between"
        style={{
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
