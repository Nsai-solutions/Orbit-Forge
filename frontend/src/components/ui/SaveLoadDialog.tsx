import { useState, useRef } from 'react'
import { useStore } from '@/stores'
import Modal from './Modal'
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  exportProjectJSON,
  importProjectJSON,
} from '@/lib/persistence'
import { generateMissionReport } from '@/lib/pdf-report'

interface SaveLoadDialogProps {
  open: boolean
  onClose: () => void
}

function restoreProjectData(data: any) {
  const state = useStore.getState()

  if (data.elements) {
    state.updateElements(data.elements)
  }
  if (data.mission) {
    const mission = {
      ...data.mission,
      epoch: new Date(data.mission.epoch),
    }
    state.updateMission(mission)
  }
  if (data.groundStations) {
    state.setGroundStations(data.groundStations)
  }
  if (data.subsystems) {
    state.setSubsystems(data.subsystems)
  }
  if (data.degradationRate !== undefined) {
    state.setDegradationRate(data.degradationRate)
  }
  if (data.walkerParams) {
    state.setWalkerParams(data.walkerParams)
  }
  if (data.propulsion) {
    state.setPropulsion(data.propulsion)
  }
  if (data.maneuvers) {
    state.setManeuvers(data.maneuvers)
  }
  if (data.shieldingThicknessMm !== undefined) {
    state.setShieldingThickness(data.shieldingThicknessMm)
  }
  if (data.scenarios) {
    state.setScenarios(data.scenarios)
  }
  if (data.payloadType) {
    state.setPayloadType(data.payloadType)
  }
  if (data.payloadShared) {
    state.updatePayloadShared(data.payloadShared)
  }
  if (data.payloadEO) {
    state.updatePayloadEO(data.payloadEO)
  }
  if (data.payloadSAR) {
    state.updatePayloadSAR(data.payloadSAR)
  }
  if (data.payloadSATCOM) {
    state.updatePayloadSATCOM(data.payloadSATCOM)
  }
  if (data.beyondLeo) {
    if (data.beyondLeo.mode) state.setBeyondLeoMode(data.beyondLeo.mode)
    if (data.beyondLeo.lagrangeParams) state.updateLagrangeParams(data.beyondLeo.lagrangeParams)
    if (data.beyondLeo.lunarParams) state.updateLunarParams(data.beyondLeo.lunarParams)
    if (data.beyondLeo.interplanetaryParams) state.updateInterplanetaryParams(data.beyondLeo.interplanetaryParams)
  }
}

export default function SaveLoadDialog({ open, onClose }: SaveLoadDialogProps) {
  const [projectName, setProjectName] = useState('')
  const [projects, setProjects] = useState(listProjects)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const state = useStore.getState()

  const refreshProjects = () => setProjects(listProjects())

  const handleSave = () => {
    const name = projectName.trim() || state.mission.name || 'Untitled'
    saveProject(name, state)
    setStatus(`Saved "${name}"`)
    refreshProjects()
    setTimeout(() => setStatus(''), 2000)
  }

  const handleLoad = (name: string) => {
    const project = loadProject(name)
    if (!project) {
      setStatus('Failed to load project')
      return
    }
    restoreProjectData(project.data)
    setStatus(`Loaded "${name}"`)
    setTimeout(() => {
      setStatus('')
      onClose()
    }, 1000)
  }

  const handleDelete = (name: string) => {
    deleteProject(name)
    refreshProjects()
    setStatus(`Deleted "${name}"`)
    setTimeout(() => setStatus(''), 2000)
  }

  const handleExport = () => {
    const name = projectName.trim() || state.mission.name || 'Untitled'
    exportProjectJSON(name, state)
    setStatus('Exported to file')
    setTimeout(() => setStatus(''), 2000)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const project = await importProjectJSON(file)
      restoreProjectData(project.data)
      setStatus(`Imported "${project.name}"`)
      setTimeout(() => {
        setStatus('')
        onClose()
      }, 1000)
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
    }
    e.target.value = ''
  }

  return (
    <Modal open={open} onClose={onClose} title="Save / Load Mission">
      <div className="space-y-4">
        {/* Save Section */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-sans">
            Save Current Mission
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={state.mission.name}
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-accent-blue text-white text-xs font-sans font-semibold hover:bg-accent-blue-hover transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Export / Import */}
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 px-3 py-2 rounded-md border border-white/10 text-[var(--text-secondary)] text-xs font-sans hover:bg-white/5 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-3 py-2 rounded-md border border-white/10 text-[var(--text-secondary)] text-xs font-sans hover:bg-white/5 transition-colors"
          >
            Import JSON
          </button>
          <button
            onClick={async () => {
              setStatus('Generating PDF...')
              try {
                await generateMissionReport(state)
                setStatus('PDF exported')
              } catch {
                setStatus('PDF export failed')
              }
              setTimeout(() => setStatus(''), 2000)
            }}
            className="flex-1 px-3 py-2 rounded-md bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs font-sans font-semibold hover:bg-accent-blue/20 transition-colors"
          >
            Export PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Saved Projects */}
        {projects.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-sans">
              Saved Projects
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {projects.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-primary)] truncate">{p.name}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] font-mono">
                      {new Date(p.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoad(p.name)}
                    className="px-2 py-1 rounded text-[10px] bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(p.name)}
                    className="px-2 py-1 rounded text-[10px] text-accent-red/50 hover:text-accent-red hover:bg-accent-red/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Del
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="text-xs text-accent-green font-mono text-center py-1">
            {status}
          </div>
        )}
      </div>
    </Modal>
  )
}
