export type TriState = 'yes' | 'no' | 'na'

export type HazardSeverity = 'low' | 'moderate' | 'high'

export const CHECKLIST_SCHEMA_VERSION = 1 as const

export interface DailySafetyChecklist {
  schemaVersion: typeof CHECKLIST_SCHEMA_VERSION
  reportType: 'daily_safety_check'
  /** ISO date (YYYY-MM-DD) for the check, usually local field date. */
  checkDate: string
  ppe: {
    hardHat: TriState | null
    highVis: TriState | null
    footwear: TriState | null
    eyeProtection: TriState | null
  }
  fallProtection: {
    edgesProtected: TriState | null
    fpInUse: TriState | null
    ladders: TriState | null
  }
  toolsAndWorkArea: {
    toolsCondition: TriState | null
    workAreaClear: TriState | null
    housekeeping: TriState | null
  }
  hazards: {
    present: boolean | null
    description: string
    severity: HazardSeverity | null
  }
  incidentOrNearMiss: {
    occurred: boolean | null
    detail: string
  }
}

export function emptyDailySafetyChecklist(
  checkDate?: string,
): DailySafetyChecklist {
  const today =
    checkDate ??
    new Date().toLocaleDateString('en-CA', { timeZone: undefined })
  return {
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    reportType: 'daily_safety_check',
    checkDate: today,
    ppe: {
      hardHat: null,
      highVis: null,
      footwear: null,
      eyeProtection: null,
    },
    fallProtection: {
      edgesProtected: null,
      fpInUse: null,
      ladders: null,
    },
    toolsAndWorkArea: {
      toolsCondition: null,
      workAreaClear: null,
      housekeeping: null,
    },
    hazards: {
      present: null,
      description: '',
      severity: null,
    },
    incidentOrNearMiss: {
      occurred: null,
      detail: '',
    },
  }
}

function isTriState(v: unknown): v is TriState {
  return v === 'yes' || v === 'no' || v === 'na'
}

function isSeverity(v: unknown): v is HazardSeverity {
  return v === 'low' || v === 'moderate' || v === 'high'
}

/** Merge stored JSON with defaults; tolerate legacy empty {}. */
export function parseDailySafetyChecklist(
  raw: unknown,
  fallbackDate?: string,
): DailySafetyChecklist {
  const base = emptyDailySafetyChecklist(fallbackDate)
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.reportType !== 'daily_safety_check') return base

  const ppe = (o.ppe ?? {}) as Record<string, unknown>
  const fp = (o.fallProtection ?? {}) as Record<string, unknown>
  const tools = (o.toolsAndWorkArea ?? {}) as Record<string, unknown>
  const hazards = (o.hazards ?? {}) as Record<string, unknown>
  const incident = (o.incidentOrNearMiss ?? {}) as Record<string, unknown>

  return {
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    reportType: 'daily_safety_check',
    checkDate:
      typeof o.checkDate === 'string' && o.checkDate.length >= 8
        ? o.checkDate
        : base.checkDate,
    ppe: {
      hardHat: isTriState(ppe.hardHat) ? ppe.hardHat : null,
      highVis: isTriState(ppe.highVis) ? ppe.highVis : null,
      footwear: isTriState(ppe.footwear) ? ppe.footwear : null,
      eyeProtection: isTriState(ppe.eyeProtection)
        ? ppe.eyeProtection
        : null,
    },
    fallProtection: {
      edgesProtected: isTriState(fp.edgesProtected) ? fp.edgesProtected : null,
      fpInUse: isTriState(fp.fpInUse) ? fp.fpInUse : null,
      ladders: isTriState(fp.ladders) ? fp.ladders : null,
    },
    toolsAndWorkArea: {
      toolsCondition: isTriState(tools.toolsCondition)
        ? tools.toolsCondition
        : null,
      workAreaClear: isTriState(tools.workAreaClear)
        ? tools.workAreaClear
        : null,
      housekeeping: isTriState(tools.housekeeping) ? tools.housekeeping : null,
    },
    hazards: {
      present:
        typeof hazards.present === 'boolean' ? hazards.present : null,
      description:
        typeof hazards.description === 'string' ? hazards.description : '',
      severity: isSeverity(hazards.severity) ? hazards.severity : null,
    },
    incidentOrNearMiss: {
      occurred:
        typeof incident.occurred === 'boolean' ? incident.occurred : null,
      detail: typeof incident.detail === 'string' ? incident.detail : '',
    },
  }
}

export function serializeChecklist(
  checklist: DailySafetyChecklist,
): Record<string, unknown> {
  return { ...checklist }
}

const TRI_FIELDS: { group: keyof DailySafetyChecklist; key: string }[] = [
  { group: 'ppe', key: 'hardHat' },
  { group: 'ppe', key: 'highVis' },
  { group: 'ppe', key: 'footwear' },
  { group: 'ppe', key: 'eyeProtection' },
  { group: 'fallProtection', key: 'edgesProtected' },
  { group: 'fallProtection', key: 'fpInUse' },
  { group: 'fallProtection', key: 'ladders' },
  { group: 'toolsAndWorkArea', key: 'toolsCondition' },
  { group: 'toolsAndWorkArea', key: 'workAreaClear' },
  { group: 'toolsAndWorkArea', key: 'housekeeping' },
]

export function validateDailySafetyChecklist(
  checklist: DailySafetyChecklist,
): string | null {
  for (const { group, key } of TRI_FIELDS) {
    const section = checklist[group] as Record<string, TriState | null>
    if (!isTriState(section[key])) {
      return 'Answer every checklist item (Yes, No, or N/A) before submitting.'
    }
  }
  if (checklist.hazards.present === null) {
    return 'Indicate whether hazards were observed.'
  }
  if (checklist.hazards.present) {
    if (!checklist.hazards.description.trim()) {
      return 'Describe the hazard when Hazards is Yes.'
    }
    if (!checklist.hazards.severity) {
      return 'Select hazard severity (Low, Moderate, or High).'
    }
  }
  if (checklist.incidentOrNearMiss.occurred === null) {
    return 'Indicate whether an incident or near miss occurred.'
  }
  if (checklist.incidentOrNearMiss.occurred) {
    if (!checklist.incidentOrNearMiss.detail.trim()) {
      return 'Add incident / near miss details when Yes is selected.'
    }
  }
  return null
}

export const TRI_STATE_LABELS: Record<TriState, string> = {
  yes: 'Yes',
  no: 'No',
  na: 'N/A',
}

export const HAZARD_SEVERITY_LABELS: Record<HazardSeverity, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}
