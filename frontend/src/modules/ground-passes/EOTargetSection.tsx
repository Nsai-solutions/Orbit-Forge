import { useState } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'

export default function EOTargetSection() {
  const payloadType = useStore((s) => s.payloadType)
  const targets = useStore((s) => s.eoTargets)
  const addTarget = useStore((s) => s.addEOTarget)
  const removeTarget = useStore((s) => s.removeEOTarget)
  const toggleActive = useStore((s) => s.toggleEOTargetActive)
  const updateTarget = useStore((s) => s.updateEOTarget)
  const isPlacing = useStore((s) => s.isPlacingTarget)
  const setPlacing = useStore((s) => s.setIsPlacingTarget)

  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')

  if (payloadType !== 'earth-observation') return null

  const handleAddManual = () => {
    const lat = parseFloat(manualLat)
    const lon = parseFloat(manualLon)
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return
    const idx = targets.length + 1
    addTarget({
      id: crypto.randomUUID(),
      name: `Target ${idx}`,
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100,
      active: true,
    })
    setManualLat('')
    setManualLon('')
  }

  return (
    <SectionHeader
      title={`EO Targets${targets.length > 0 ? ` (${targets.length})` : ''}`}
    >
      <div className="space-y-2">
        {/* Place on globe button */}
        <button
          onClick={() => setPlacing(!isPlacing)}
          className={`w-full px-3 py-1.5 rounded text-[10px] font-mono font-medium transition-all ${
            isPlacing
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'bg-white/5 text-[var(--text-secondary)] border border-white/10 hover:bg-white/10'
          }`}
        >
          {isPlacing ? 'Click globe to place...' : 'Place Target on Globe'}
        </button>

        {/* Manual entry */}
        <div className="flex gap-1 items-end">
          <div className="flex-1">
            <label className="text-[8px] text-[var(--text-tertiary)] uppercase">Lat</label>
            <input
              type="number"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="0.0"
              className="input-field w-full text-[10px] py-0.5 px-1.5"
              min={-90}
              max={90}
              step={0.1}
            />
          </div>
          <div className="flex-1">
            <label className="text-[8px] text-[var(--text-tertiary)] uppercase">Lon</label>
            <input
              type="number"
              value={manualLon}
              onChange={(e) => setManualLon(e.target.value)}
              placeholder="0.0"
              className="input-field w-full text-[10px] py-0.5 px-1.5"
              min={-180}
              max={180}
              step={0.1}
            />
          </div>
          <button
            onClick={handleAddManual}
            className="px-2 py-1 rounded text-[10px] font-mono bg-accent-blue/15 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/25 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Target list */}
        {targets.length > 0 && (
          <div className="space-y-1 pt-1">
            {targets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-white/[0.03] border border-white/[0.06]"
              >
                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(t.id)}
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                    t.active ? 'bg-amber-400' : 'bg-white/20'
                  }`}
                  title={t.active ? 'Disable' : 'Enable'}
                />

                {/* Editable name */}
                <input
                  value={t.name}
                  onChange={(e) => updateTarget(t.id, { name: e.target.value })}
                  className="flex-1 bg-transparent text-[10px] text-[var(--text-primary)] font-mono outline-none min-w-0"
                />

                {/* Coordinates */}
                <span className="text-[8px] text-[var(--text-tertiary)] font-mono flex-shrink-0">
                  {t.lat.toFixed(1)},{t.lon.toFixed(1)}
                </span>

                {/* Delete */}
                <button
                  onClick={() => removeTarget(t.id)}
                  className="text-[var(--text-tertiary)] hover:text-accent-red transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionHeader>
  )
}
