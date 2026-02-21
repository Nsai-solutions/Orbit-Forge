import { useState, useEffect } from 'react'
import heroScreenshot from '@/assets/hero-screenshot.png'

const BREAKPOINT = 1024

export default function MobileOverlay() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINT)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < BREAKPOINT)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!isMobile) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0A0E17',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: "'IBM Plex Sans', sans-serif",
        overflow: 'auto',
      }}
    >
      {/* Screenshot preview */}
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          marginBottom: '32px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <img
          src={heroScreenshot}
          alt="OrbitForge desktop interface"
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#F9FAFB',
          marginBottom: '8px',
        }}
      >
        ORBITFORGE
      </h1>

      <p
        style={{
          fontSize: '14px',
          color: '#3B82F6',
          fontWeight: 500,
          letterSpacing: '0.03em',
          marginBottom: '32px',
        }}
      >
        Professional CubeSat Mission Design
      </p>

      {/* Message */}
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.8)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '360px',
          marginBottom: '32px',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="1.5"
          style={{ margin: '0 auto 16px' }}
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#F9FAFB',
            marginBottom: '8px',
          }}
        >
          Desktop Browser Required
        </p>
        <p
          style={{
            fontSize: '14px',
            color: '#9CA3AF',
            lineHeight: 1.6,
          }}
        >
          OrbitForge uses interactive 3D visualization and multi-panel layouts
          that require a screen width of at least 1024px.
        </p>
      </div>

      {/* Copy Link button */}
      <button
        onClick={handleCopy}
        style={{
          padding: '14px 32px',
          fontSize: '15px',
          fontWeight: 600,
          fontFamily: "'IBM Plex Sans', sans-serif",
          background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          color: copied ? '#10B981' : '#3B82F6',
          border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: '16px',
        }}
      >
        {copied ? 'Link Copied!' : 'Copy Link to Open on Desktop'}
      </button>

      <p style={{ fontSize: '13px', color: '#6B7280' }}>
        North Star AI Solutions
      </p>
    </div>
  )
}
