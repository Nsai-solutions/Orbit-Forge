import { useStore } from '@/stores'
import type { OverlayToggles } from '@/stores/ui-slice'

const TOGGLE_ITEMS: { key: keyof OverlayToggles; label: string }[] = [
  { key: 'stationCoverage', label: 'Station Coverage' },
  { key: 'sensorFootprint', label: 'Sensor Footprint' },
  { key: 'commLinks', label: 'Comm Links' },
  { key: 'swathCorridor', label: 'Swath Corridor' },
]

export default function OverlayTogglePanel() {
  const overlayToggles = useStore((s) => s.overlayToggles)
  const setOverlayToggle = useStore((s) => s.setOverlayToggle)

  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-white/10 bg-space-900/80 backdrop-blur-sm px-3 py-2 select-none">
      <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
        Overlays
      </div>
      <div className="flex flex-col gap-1">
        {TOGGLE_ITEMS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={overlayToggles[key]}
              onChange={(e) => setOverlayToggle(key, e.target.checked)}
              className="w-3 h-3 rounded-sm border border-white/20 bg-transparent accent-accent-cyan cursor-pointer"
            />
            <span className="text-[10px] font-mono text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
