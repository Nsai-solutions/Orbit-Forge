import { useState } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import ExportCSVButton from '@/components/ui/ExportCSVButton'
import { subsystemAvgPower, totalAvgPowerDraw } from '@/lib/power-budget'
import { exportCSV } from '@/lib/csv-export'

export default function PowerBudgetPanel() {
  const subsystems = useStore((s) => s.subsystems)
  const degradationRate = useStore((s) => s.degradationRate)
  const addSubsystem = useStore((s) => s.addSubsystem)
  const removeSubsystem = useStore((s) => s.removeSubsystem)
  const updateSubsystem = useStore((s) => s.updateSubsystem)
  const setDegradationRate = useStore((s) => s.setDegradationRate)
  const resetSubsystems = useStore((s) => s.resetSubsystems)

  const [newName, setNewName] = useState('')
  const [newMode, setNewMode] = useState('')
  const [newPower, setNewPower] = useState(1)
  const [newDuty, setNewDuty] = useState(100)

  const mission = useStore((s) => s.mission)
  const totalAvg = totalAvgPowerDraw(subsystems)

  const handleExportCSV = () => {
    exportCSV(
      `${mission.name.replace(/\s+/g, '_')}_power_budget`,
      ['Name', 'Mode', 'Power (W)', 'Duty Cycle (%)', 'Avg Power (W)', 'Eclipse Only'],
      subsystems.map(s => [
        s.name, s.mode, s.powerW,
        (Math.min(1, Math.max(0, s.dutyCycle)) * 100).toFixed(1),
        subsystemAvgPower(s).toFixed(2),
        s.isEclipseOnly ? 'Yes' : 'No',
      ])
    )
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    addSubsystem({
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      mode: newMode.trim() || 'Active',
      powerW: newPower,
      dutyCycle: Math.max(0, Math.min(1, newDuty / 100)),
      isEclipseOnly: false,
    })
    setNewName('')
    setNewMode('')
    setNewPower(1)
    setNewDuty(100)
  }

  const handleDutyChange = (id: string, percentValue: number) => {
    const clamped = Math.max(0, Math.min(100, percentValue))
    updateSubsystem(id, { dutyCycle: clamped / 100 })
  }

  const handlePowerChange = (id: string, watts: number) => {
    updateSubsystem(id, { powerW: Math.max(0, watts) })
  }

  return (
    <div className="space-y-2">
      <SectionHeader title="Power Subsystems">
        <div className="space-y-2">
          {subsystems.map((sub) => {
            const avgW = subsystemAvgPower(sub)
            const dutyPercent = Math.round(Math.max(0, Math.min(1, sub.dutyCycle)) * 100)

            return (
              <div
                key={sub.id}
                className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-2 group overflow-hidden"
              >
                {/* Header row: name, mode, delete */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-primary)] font-mono font-semibold">
                      {sub.name}
                    </span>
                    <span className="text-[9px] text-[var(--text-tertiary)] font-mono px-1.5 py-0.5 bg-white/5 rounded">
                      {sub.mode}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSubsystem(sub.id)}
                    className="text-[9px] text-accent-red/40 hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100 px-1"
                  >
                    Remove
                  </button>
                </div>

                {/* Input row */}
                <div className="flex items-end gap-2">
                  {/* Power input */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
                      Power (W)
                    </label>
                    <input
                      type="number"
                      value={sub.powerW}
                      onChange={(e) => handlePowerChange(sub.id, parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-white/10 bg-white/[0.06] px-1.5 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                      step="0.1"
                      min="0"
                    />
                  </div>

                  {/* Duty cycle input */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
                      Duty (%)
                    </label>
                    <input
                      type="number"
                      value={dutyPercent}
                      onChange={(e) => handleDutyChange(sub.id, parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-white/10 bg-white/[0.06] px-1.5 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                      min="0"
                      max="100"
                    />
                  </div>

                  {/* Average result */}
                  <div className="shrink-0 text-right pl-1">
                    <label className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">
                      Avg
                    </label>
                    <div className="text-xs font-mono font-bold text-accent-cyan py-1 whitespace-nowrap">
                      {avgW.toFixed(2)} W
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total + Export */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/10 mt-3">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-mono font-semibold">
            Total Avg Draw
          </span>
          <div className="flex items-center gap-3">
            <ExportCSVButton onClick={handleExportCSV} />
            <span className="text-sm font-mono font-bold text-accent-cyan">
              {totalAvg.toFixed(2)} W
            </span>
          </div>
        </div>
      </SectionHeader>

      <SectionHeader title="Add Subsystem" defaultOpen={false}>
        <div className="space-y-2">
          <div>
            <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. GPS Receiver"
              className="input-field w-full text-xs"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
              Mode
            </label>
            <input
              type="text"
              value={newMode}
              onChange={(e) => setNewMode(e.target.value)}
              placeholder="e.g. Active, TX, Standby"
              className="input-field w-full text-xs"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
                Power (W)
              </label>
              <input
                type="number"
                value={newPower}
                onChange={(e) => setNewPower(Math.max(0, parseFloat(e.target.value) || 0))}
                className="input-field w-full text-xs"
                step="0.1"
                min="0"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
                Duty (%)
              </label>
              <input
                type="number"
                value={newDuty}
                onChange={(e) => setNewDuty(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="input-field w-full text-xs"
                min="0"
                max="100"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full px-3 py-1.5 rounded-md bg-accent-blue text-white text-xs font-sans font-semibold hover:bg-accent-blue-hover transition-colors disabled:opacity-50"
          >
            Add Subsystem
          </button>
        </div>
      </SectionHeader>

      <SectionHeader title="Panel Degradation">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Degradation rate</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={(degradationRate * 100).toFixed(1)}
                onChange={(e) => setDegradationRate(Math.max(0, Math.min(0.2, (parseFloat(e.target.value) || 0) / 100)))}
                className="w-16 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono text-[var(--text-primary)] text-center focus:border-accent-blue focus:outline-none"
                step="0.5"
                min="0"
                max="20"
              />
              <span className="text-[11px] text-[var(--text-secondary)]">%/yr</span>
            </div>
          </div>
          <button
            onClick={resetSubsystems}
            className="w-full px-3 py-1.5 rounded-md border border-white/10 text-[var(--text-secondary)] text-xs font-sans hover:bg-white/5 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </SectionHeader>
    </div>
  )
}
