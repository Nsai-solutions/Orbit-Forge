import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { useStore } from '@/stores'
import { ModuleId } from '@/types'
import EarthScene from '@/components/viewport/EarthScene'
import BeyondLeoScene from '@/components/viewport/BeyondLeoScene'
import OverlayTogglePanel from '@/components/viewport/OverlayTogglePanel'
import TimeControls from '@/components/viewport/TimeControls'

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        <span className="text-xs font-mono text-[var(--text-tertiary)]">Loading viewport...</span>
      </div>
    </div>
  )
}

function SceneSelector() {
  const activeModule = useStore((s) => s.activeModule)

  if (activeModule === ModuleId.BeyondLeo) {
    return <BeyondLeoScene />
  }
  return <EarthScene />
}

function ShowOverlayPanel() {
  const activeModule = useStore((s) => s.activeModule)
  // Only show overlay panel on tabs with the Earth globe
  const showPanel =
    activeModule === ModuleId.OrbitDesign ||
    activeModule === ModuleId.GroundPasses ||
    activeModule === ModuleId.Payload
  if (!showPanel) return null
  return <OverlayTogglePanel />
}

function ShowTimeControls() {
  const activeModule = useStore((s) => s.activeModule)
  const showControls =
    activeModule === ModuleId.OrbitDesign ||
    activeModule === ModuleId.GroundPasses ||
    activeModule === ModuleId.Payload
  if (!showControls) return null
  return <TimeControls />
}

export default function CenterViewport() {
  return (
    <div className="relative flex-1 bg-space-900 overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0.8, 3], fov: 45, near: 0.01, far: 1000 }}
          dpr={[1, 1.5]}
          frameloop="always"
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            toneMapping: ACESFilmicToneMapping,
            outputColorSpace: SRGBColorSpace,
          }}
          style={{ background: '#0A0E17' }}
        >
          <SceneSelector />
        </Canvas>
      </Suspense>
      <ShowOverlayPanel />
      <ShowTimeControls />
    </div>
  )
}
