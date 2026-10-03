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

export type ChecklistFieldKey =
  | `ppe.${keyof DailySafetyChecklist['ppe']}`
  | `fallProtection.${keyof DailySafetyChecklist['fallProtection']}`
  | `toolsAndWorkArea.${keyof DailySafetyChecklist['toolsAndWorkArea']}`
  | 'hazards.present'
  | 'hazards.description'
  | 'hazards.severity'
  | 'incidentOrNearMiss.occurred'
  | 'incidentOrNearMiss.detail'
  | 'siteId'
  | 'checkDate'

export type ChecklistFieldError = {
  field: ChecklistFieldKey
  message: string
}

const TRI_FIELDS: {
  group: 'ppe' | 'fallProtection' | 'toolsAndWorkArea'
  key: string
  label: string
  field: ChecklistFieldKey
}[] = [
  { group: 'ppe', key: 'hardHat', label: 'Hard hat worn', field: 'ppe.hardHat' },
  { group: 'ppe', key: 'highVis', label: 'High-vis vest', field: 'ppe.highVis' },
  {
    group: 'ppe',
    key: 'footwear',
    label: 'Appropriate footwear',
    field: 'ppe.footwear',
  },
  {
    group: 'ppe',
    key: 'eyeProtection',
    label: 'Eye protection (when required)',
    field: 'ppe.eyeProtection',
  },
  {
    group: 'fallProtection',
    key: 'edgesProtected',
    label: 'Edges / openings protected',
    field: 'fallProtection.edgesProtected',
  },
  {
    group: 'fallProtection',
    key: 'fpInUse',
    label: 'Fall protection in use',
    field: 'fallProtection.fpInUse',
  },
  {
    group: 'fallProtection',
    key: 'ladders',
    label: 'Ladders / access safe',
    field: 'fallProtection.ladders',
  },
  {
    group: 'toolsAndWorkArea',
    key: 'toolsCondition',
    label: 'Tools / equipment condition OK',
    field: 'toolsAndWorkArea.toolsCondition',
  },
  {
    group: 'toolsAndWorkArea',
    key: 'workAreaClear',
    label: 'Work area clear',
    field: 'toolsAndWorkArea.workAreaClear',
  },
  {
    group: 'toolsAndWorkArea',
    key: 'housekeeping',
    label: 'Housekeeping acceptable',
    field: 'toolsAndWorkArea.housekeeping',
  },
]

/** Collect all Daily Safety Check field errors for in-app submit messaging. */
export function collectDailySafetyChecklistErrors(
  checklist: DailySafetyChecklist,
  options?: { siteId?: string },
): ChecklistFieldError[] {
  const errors: ChecklistFieldError[] = []

  if (options && !options.siteId?.trim()) {
    errors.push({ field: 'siteId', message: 'Select a jobsite.' })
  }

  if (!checklist.checkDate?.trim()) {
    errors.push({ field: 'checkDate', message: 'Select the check date.' })
  }

  for (const { group, key, label, field } of TRI_FIELDS) {
    const section = checklist[group] as Record<string, TriState | null>
    if (!isTriState(section[key])) {
      errors.push({
        field,
        message: `Answer “${label}” (Yes, No, or N/A).`,
      })
    }
  }

  if (checklist.hazards.present === null) {
    errors.push({
      field: 'hazards.present',
      message: 'Indicate whether a hazard was observed.',
    })
  } else if (checklist.hazards.present) {
    if (!checklist.hazards.description.trim()) {
      errors.push({
        field: 'hazards.description',
        message: 'Describe the hazard.',
      })
    }
    if (!checklist.hazards.severity) {
      errors.push({
        field: 'hazards.severity',
        message: 'Select a severity for the hazard.',
      })
    }
  }

  if (checklist.incidentOrNearMiss.occurred === null) {
    errors.push({
      field: 'incidentOrNearMiss.occurred',
      message: 'Indicate whether an incident or near miss occurred.',
    })
  } else if (checklist.incidentOrNearMiss.occurred) {
    if (!checklist.incidentOrNearMiss.detail.trim()) {
      errors.push({
        field: 'incidentOrNearMiss.detail',
        message: 'Describe the incident or near miss.',
      })
    }
  }

  return errors
}

/** First checklist error message, or null when valid. */
export function validateDailySafetyChecklist(
  checklist: DailySafetyChecklist,
): string | null {
  return collectDailySafetyChecklistErrors(checklist)[0]?.message ?? null
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
