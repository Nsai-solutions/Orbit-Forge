import { useState, useEffect } from 'react'
import { useStore } from '@/stores'

export default function UTCClock() {
  const simPlaying = useStore((s) => s.simPlaying)
  const simTime = useStore((s) => s.simTime)
  const [wallTime, setWallTime] = useState(new Date())

  useEffect(() => {
    if (simPlaying) return
    const interval = setInterval(() => setWallTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [simPlaying])

  const displayTime = simPlaying && simTime > 0 ? new Date(simTime) : wallTime
  const utcString = displayTime.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  return (
    <div className="font-mono text-sm text-accent-cyan tracking-wide">
      {simPlaying && <span className="text-accent-amber mr-1">SIM</span>}
      {utcString}
    </div>
  )
}
