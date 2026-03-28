import { useMemo, useEffect, useRef, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '@/stores'
import { geodeticToThreeJS, threeJSToGeodetic } from '@/lib/coordinate-transforms'

function EOTargetPlacer() {
  const { gl, camera, scene } = useThree()
  const isPlacing = useStore((s) => s.isPlacingTarget)
  const addTarget = useStore((s) => s.addEOTarget)
  const setPlacing = useStore((s) => s.setIsPlacingTarget)
  const targets = useStore((s) => s.eoTargets)
  const raycaster = useRef(new THREE.Raycaster())
  const mouseDown = useRef<{ x: number; y: number; time: number } | null>(null)

  const handleClick = useCallback(
    (lat: number, lon: number) => {
      const idx = targets.length + 1
      addTarget({
        id: crypto.randomUUID(),
        name: `Target ${idx}`,
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        active: true,
      })
      setPlacing(false)
    },
    [addTarget, setPlacing, targets.length],
  )

  useEffect(() => {
    if (!isPlacing) return

    const canvas = gl.domElement
    canvas.style.cursor = 'crosshair'

    const onDown = (e: MouseEvent) => {
      mouseDown.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    }

    const onUp = (e: MouseEvent) => {
      if (!mouseDown.current) return
      const dx = e.clientX - mouseDown.current.x
      const dy = e.clientY - mouseDown.current.y
      const dt = Date.now() - mouseDown.current.time
      mouseDown.current = null

      // Only treat as click if small movement and short duration
      if (Math.sqrt(dx * dx + dy * dy) > 5 || dt > 300) return

      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.current.setFromCamera(mouse, camera)

      const earthMesh = scene.getObjectByName('earth-globe')
      if (!earthMesh) return
      const hits = raycaster.current.intersectObject(earthMesh)
      if (hits.length === 0) return

      const pt = hits[0].point
      const { lat, lon } = threeJSToGeodetic(pt.x, pt.y, pt.z)
      handleClick(lat, lon)
    }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mouseup', onUp)

    return () => {
      canvas.style.cursor = ''
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mouseup', onUp)
    }
  }, [isPlacing, gl, camera, scene, handleClick])

  return null
}

export default function EOTargetMarkers() {
  const targets = useStore((s) => s.eoTargets)

  const markerData = useMemo(
    () =>
      targets
        .filter((t) => t.active)
        .map((t) => ({
          ...t,
          pos: geodeticToThreeJS(t.lat, t.lon, 1.003),
        })),
    [targets],
  )

  return (
    <group>
      <EOTargetPlacer />
      {markerData.map((t) => (
        <group key={t.id} position={[t.pos.x, t.pos.y, t.pos.z]}>
          {/* Target marker */}
          <mesh>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>

          {/* Glow ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.01, 0.015, 12]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0.4} side={2} />
          </mesh>

          {/* Label */}
          <Html
            center
            occlude
            style={{ pointerEvents: 'none', userSelect: 'none' }}
            position={[0, 0.03, 0]}
          >
            <div
              className="whitespace-nowrap max-w-[120px] truncate bg-space-800/90 border border-amber-500/30 rounded font-mono text-amber-400 leading-tight"
              style={{ fontSize: '9px', padding: '2px 6px' }}
            >
              {t.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}
