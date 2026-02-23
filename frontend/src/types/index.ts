export enum ModuleId {
  MissionConfig = 'mission-config',
  OrbitDesign = 'orbit-design',
  PowerBudget = 'power-budget',
  GroundPasses = 'ground-passes',
  OrbitalLifetime = 'orbital-lifetime',
  Constellation = 'constellation',
  DeltaV = 'delta-v',
  Radiation = 'radiation',
  Payload = 'payload',
  BeyondLeo = 'beyond-leo',
  Comparison = 'comparison',
  MissionArchitect = 'mission-architect',
}

export const MODULE_LABELS: Record<ModuleId, string> = {
  [ModuleId.MissionConfig]: 'Mission',
  [ModuleId.OrbitDesign]: 'Orbit',
  [ModuleId.PowerBudget]: 'Power',
  [ModuleId.GroundPasses]: 'Passes',
  [ModuleId.OrbitalLifetime]: 'Lifetime',
  [ModuleId.Constellation]: 'Constellation',
  [ModuleId.DeltaV]: '\u0394V Budget',
  [ModuleId.Radiation]: 'Radiation',
  [ModuleId.Payload]: 'Payload',
  [ModuleId.BeyondLeo]: 'Beyond-LEO',
  [ModuleId.Comparison]: 'Compare',
  [ModuleId.MissionArchitect]: 'Architect',
}

export const MODULE_NUMBERS: Record<ModuleId, number> = {
  [ModuleId.MissionConfig]: 1,
  [ModuleId.OrbitDesign]: 2,
  [ModuleId.PowerBudget]: 3,
  [ModuleId.GroundPasses]: 4,
  [ModuleId.OrbitalLifetime]: 5,
  [ModuleId.Constellation]: 6,
  [ModuleId.DeltaV]: 7,
  [ModuleId.Radiation]: 8,
  [ModuleId.Payload]: 9,
  [ModuleId.BeyondLeo]: 10,
  [ModuleId.Comparison]: 11,
  [ModuleId.MissionArchitect]: 12,
}

export interface Vec3 {
  x: number
  y: number
  z: number
}
