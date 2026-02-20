const STORAGE_PREFIX = 'orbitforge-project-'
const SCHEMA_VERSION = 2

interface SavedProject {
  version: number
  name: string
  savedAt: string
  data: {
    elements: any
    groundStations: any
    mission: any
    subsystems?: any
    degradationRate?: number
    walkerParams?: any
  }
}

function serializeMissionState(state: any): SavedProject['data'] {
  return {
    elements: state.elements,
    groundStations: state.groundStations,
    mission: {
      ...state.mission,
      epoch: state.mission.epoch instanceof Date
        ? state.mission.epoch.toISOString()
        : state.mission.epoch,
    },
    subsystems: state.subsystems,
    degradationRate: state.degradationRate,
    walkerParams: state.walkerParams,
  }
}

export function saveProject(name: string, state: any): void {
  const project: SavedProject = {
    version: SCHEMA_VERSION,
    name,
    savedAt: new Date().toISOString(),
    data: serializeMissionState(state),
  }
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(project))
}

export function loadProject(name: string): SavedProject | null {
  const raw = localStorage.getItem(STORAGE_PREFIX + name)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SavedProject
  } catch {
    return null
  }
}

export function listProjects(): Array<{ name: string; savedAt: string }> {
  const projects: Array<{ name: string; savedAt: string }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      const name = key.slice(STORAGE_PREFIX.length)
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as SavedProject
          projects.push({ name, savedAt: parsed.savedAt })
        }
      } catch {
        // skip corrupted
      }
    }
  }
  return projects.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function deleteProject(name: string): void {
  localStorage.removeItem(STORAGE_PREFIX + name)
}

export function exportProjectJSON(name: string, state: any): void {
  const project: SavedProject = {
    version: SCHEMA_VERSION,
    name,
    savedAt: new Date().toISOString(),
    data: serializeMissionState(state),
  }

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/\s+/g, '_')}.orbitforge.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importProjectJSON(file: File): Promise<SavedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const project = JSON.parse(reader.result as string) as SavedProject
        if (!project.version || !project.data) {
          reject(new Error('Invalid OrbitForge project file'))
          return
        }
        resolve(project)
      } catch {
        reject(new Error('Failed to parse project file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
