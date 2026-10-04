import type { DailySafetyChecklist, HazardSeverity } from '../types/safetyChecklist'
import type { IssueSeverity } from '../types/correctiveActions'

/** Stable keys for safety_issues.checklist_item_key (unique per submission). */
export type ChecklistIssueKey =
  | `ppe.${keyof DailySafetyChecklist['ppe']}`
  | `fallProtection.${keyof DailySafetyChecklist['fallProtection']}`
  | `toolsAndWorkArea.${keyof DailySafetyChecklist['toolsAndWorkArea']}`
  | 'hazards'
  | 'incidentOrNearMiss'

export type IssueFieldSpec = {
  key: ChecklistIssueKey
  label: string
  /** Pre-fill description from checklist (hazards / incident). */
  defaultDescription?: string
  /** Pre-fill severity from checklist hazards. */
  defaultSeverity?: IssueSeverity | null
}

const PPE_LABELS: Record<keyof DailySafetyChecklist['ppe'], string> = {
  hardHat: 'Hard hat worn',
  highVis: 'High-vis vest',
  footwear: 'Appropriate footwear',
  eyeProtection: 'Eye protection (when required)',
}

const FP_LABELS: Record<keyof DailySafetyChecklist['fallProtection'], string> =
  {
    edgesProtected: 'Edges / openings protected',
    fpInUse: 'Fall protection in use',
    ladders: 'Ladders / access safe',
  }

const TOOLS_LABELS: Record<
  keyof DailySafetyChecklist['toolsAndWorkArea'],
  string
> = {
  toolsCondition: 'Tools / equipment condition OK',
  workAreaClear: 'Work area clear',
  housekeeping: 'Housekeeping acceptable',
}

export function mapHazardSeverityToIssue(
  severity: HazardSeverity | null | undefined,
): IssueSeverity | null {
  if (!severity) return null
  if (severity === 'moderate') return 'medium'
  return severity
}

/** Which checklist answers require a field-captured safety issue. */
export function requiredIssueSpecs(
  checklist: DailySafetyChecklist,
): IssueFieldSpec[] {
  const specs: IssueFieldSpec[] = []

  for (const key of Object.keys(PPE_LABELS) as (keyof typeof PPE_LABELS)[]) {
    if (checklist.ppe[key] === 'no') {
      specs.push({ key: `ppe.${key}`, label: PPE_LABELS[key] })
    }
  }
  for (const key of Object.keys(FP_LABELS) as (keyof typeof FP_LABELS)[]) {
    if (checklist.fallProtection[key] === 'no') {
      specs.push({
        key: `fallProtection.${key}`,
        label: FP_LABELS[key],
      })
    }
  }
  for (const key of Object.keys(TOOLS_LABELS) as (keyof typeof TOOLS_LABELS)[]) {
    if (checklist.toolsAndWorkArea[key] === 'no') {
      specs.push({
        key: `toolsAndWorkArea.${key}`,
        label: TOOLS_LABELS[key],
      })
    }
  }

  if (checklist.hazards.present) {
    specs.push({
      key: 'hazards',
      label: 'Hazard observed',
      defaultDescription: checklist.hazards.description,
      defaultSeverity: mapHazardSeverityToIssue(checklist.hazards.severity),
    })
  }

  if (checklist.incidentOrNearMiss.occurred) {
    specs.push({
      key: 'incidentOrNearMiss',
      label: 'Incident / near miss',
      defaultDescription: checklist.incidentOrNearMiss.detail,
      defaultSeverity: 'high',
    })
  }

  return specs
}

export type IssueDraft = {
  checklist_item_key: ChecklistIssueKey
  item_label: string
  description: string
  severity: IssueSeverity | null
  immediate_action: string
}

export type IssueFieldError = {
  field: string
  message: string
}

export function emptyIssueDraft(spec: IssueFieldSpec): IssueDraft {
  return {
    checklist_item_key: spec.key,
    item_label: spec.label,
    description: spec.defaultDescription?.trim() ?? '',
    severity: spec.defaultSeverity ?? null,
    immediate_action: '',
  }
}

/** Merge required specs with existing drafts; drop obsolete keys. */
export function reconcileIssueDrafts(
  checklist: DailySafetyChecklist,
  previous: Record<string, IssueDraft>,
): Record<string, IssueDraft> {
  const next: Record<string, IssueDraft> = {}
  for (const spec of requiredIssueSpecs(checklist)) {
    const prev = previous[spec.key]
    if (prev) {
      // Keep hazards/incident description in sync with checklist fields.
      const fromChecklist = spec.defaultDescription?.trim()
      next[spec.key] = {
        ...prev,
        item_label: spec.label,
        description: fromChecklist || prev.description,
        severity:
          spec.defaultSeverity ?? prev.severity ?? null,
      }
    } else {
      next[spec.key] = emptyIssueDraft(spec)
    }
  }
  return next
}

/**
 * Optional issue photos belong on checklist “No” capture only —
 * hazards / incidents use dedicated hazard photos instead.
 */
export function issuePhotoCaptureAllowed(key: ChecklistIssueKey | string): boolean {
  return issueKindFromChecklistKey(key) === 'checklist'
}

/** Collect all issue-draft field errors for in-app submit messaging. */
export function collectIssueDraftErrors(
  drafts: Record<string, IssueDraft>,
): IssueFieldError[] {
  const errors: IssueFieldError[] = []
  for (const key of Object.keys(drafts)) {
    const d = drafts[key]
    if (!d.description.trim()) {
      errors.push({
        field: `issue.${key}.description`,
        message: `Describe the issue for “${d.item_label}”.`,
      })
    }
    if (!d.severity) {
      errors.push({
        field: `issue.${key}.severity`,
        message: `Select a severity for “${d.item_label}”.`,
      })
    }
    if (!d.immediate_action.trim()) {
      errors.push({
        field: `issue.${key}.immediate_action`,
        message: `Add the immediate action for “${d.item_label}”.`,
      })
    }
  }
  return errors
}

export function validateIssueDrafts(
  drafts: Record<string, IssueDraft>,
): string | null {
  return collectIssueDraftErrors(drafts)[0]?.message ?? null
}

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/** UI kind for open issues — hazards and incidents are distinct, not duplicates. */
export type SafetyIssueKind = 'checklist' | 'hazard' | 'incident'

export const SAFETY_ISSUE_KIND_LABELS: Record<SafetyIssueKind, string> = {
  checklist: 'Checklist failure',
  hazard: 'Hazard',
  incident: 'Incident',
}

export function issueKindFromChecklistKey(key: string): SafetyIssueKind {
  if (key === 'hazards') return 'hazard'
  if (key === 'incidentOrNearMiss') return 'incident'
  return 'checklist'
}

/** Map Site Safety Report open-issue categories to the same kind badges. */
export function issueKindFromCategory(
  category: string,
): SafetyIssueKind {
  if (category === 'Hazard') return 'hazard'
  if (category === 'Incident / near miss') return 'incident'
  return 'checklist'
}
