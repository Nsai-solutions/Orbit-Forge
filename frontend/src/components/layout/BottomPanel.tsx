import { ReactNode, useCallback, useRef, useEffect } from 'react'
import { useStore } from '@/stores'

interface BottomPanelProps {
  children?: ReactNode
}

export default function BottomPanel({ children }: BottomPanelProps) {
  const expanded = useStore((s) => s.bottomPanelExpanded)
  const toggle = useStore((s) => s.toggleBottomPanel)
  const height = useStore((s) => s.bottomPanelHeight)
  const setHeight = useStore((s) => s.setBottomPanelHeight)

  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!expanded) return
      e.preventDefault()
      isDragging.current = true
      startY.current = e.clientY
      startHeight.current = height
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    },
    [expanded, height],
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startY.current - e.clientY
      setHeight(startHeight.current + delta)
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setHeight])

  return (
    <div
      className="bg-space-800/80 backdrop-blur-sm border-t border-white/5 flex flex-col relative"
      style={{ height: expanded ? height : 48 }}
    >
      {/* Drag handle — invisible resize grip at top edge */}
      {expanded && (
        <div
          onMouseDown={onMouseDown}
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 hover:bg-accent-blue/20 transition-colors"
        />
      )}

      {/* Toggle bar */}
      <button
        onClick={toggle}
        className="h-12 min-h-[48px] flex items-center px-4 gap-2 hover:bg-white/5 transition-colors w-full"
      >
        <svg
          className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 10l4-4 4 4" />
        </svg>
        <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
          {expanded ? 'Collapse' : 'Expand'} Panel
        </span>
        {expanded && (
          <span className="text-[9px] font-mono text-[var(--text-tertiary)]/50 ml-auto">
            drag top edge to resize
          </span>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="flex-1 overflow-auto px-4 pb-3">
          {children || (
            <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-6">
              Charts and data will appear here
            </div>
          )}
        </div>
      )}
    </div>
  )
}
