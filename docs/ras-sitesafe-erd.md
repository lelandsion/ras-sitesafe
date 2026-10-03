# RAS SiteSafe — Entity Relationship Diagram

Tables: `profiles`, `sites`, `site_assignments`, `submissions`, `submission_photos`, `safety_issues`, `corrective_actions`, `saved_reports`.

Enums:

- `user_role`: `admin` | `framer`
- `submission_status`: `draft` → `submitted` → `under_review` → `approved` | `rejected`  
  (`approved` displays as **Reviewed** in the UI)
- `submission_photo_kind`: `site` | `hazard` | `issue` | `resolution` | `corrective_action`
- `issue_severity`: `low` | `medium` | `high`
- `corrective_action_status`: `open` → `in_progress` → `ready_for_review` → `resolved`
- `corrective_action_priority`: `low` | `medium` | `high`

See rendered image: [ras-sitesafe-erd.png](./ras-sitesafe-erd.png)  
(Image may lag the Mermaid below — treat this markdown as source of truth.)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "extends"
  PROFILES ||--o{ SITE_ASSIGNMENTS : "framer_id"
  SITES ||--o{ SITE_ASSIGNMENTS : "site_id"
  SITES ||--o{ SUBMISSIONS : "site_id"
  PROFILES ||--o{ SUBMISSIONS : "submitted_by"
  PROFILES ||--o{ SUBMISSIONS : "reviewed_by"
  SUBMISSIONS ||--o{ SUBMISSION_PHOTOS : "submission_id"
  SUBMISSIONS ||--o{ SAFETY_ISSUES : "submission_id"
  SAFETY_ISSUES ||--o{ CORRECTIVE_ACTIONS : "safety_issue_id"
  SAFETY_ISSUES ||--o{ SUBMISSION_PHOTOS : "safety_issue_id"
  CORRECTIVE_ACTIONS ||--o{ SUBMISSION_PHOTOS : "corrective_action_id"
  PROFILES ||--o{ CORRECTIVE_ACTIONS : "assignee_id"
  PROFILES ||--o{ SAFETY_ISSUES : "created_by"
  PROFILES ||--o{ CORRECTIVE_ACTIONS : "created_by"
  PROFILES ||--o{ CORRECTIVE_ACTIONS : "resolved_by"
  PROFILES ||--o{ SAVED_REPORTS : "created_by"
  SITES ||--o{ SAVED_REPORTS : "site_id"

  PROFILES {
    uuid id PK
    text display_name
    user_role role
    timestamptz created_at
    timestamptz updated_at
  }

  SITES {
    uuid id PK
    text name
    text address
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  SITE_ASSIGNMENTS {
    uuid id PK
    uuid site_id FK
    uuid framer_id FK
    timestamptz assigned_at
    timestamptz unassigned_at "null = active"
  }

  SUBMISSIONS {
    uuid id PK
    uuid site_id FK
    uuid submitted_by FK
    submission_status status
    jsonb checklist
    text notes
    uuid reviewed_by FK
    timestamptz reviewed_at
    timestamptz created_at
    timestamptz updated_at
  }

  SUBMISSION_PHOTOS {
    uuid id PK
    uuid submission_id FK
    text storage_path
    text content_type
    int byte_size
    submission_photo_kind photo_kind
    uuid safety_issue_id FK
    uuid corrective_action_id FK
    timestamptz created_at
  }

  SAFETY_ISSUES {
    uuid id PK
    uuid submission_id FK
    text checklist_item_key
    text item_label
    text description
    issue_severity severity
    text immediate_action
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }

  CORRECTIVE_ACTIONS {
    uuid id PK
    uuid safety_issue_id FK
    text required_action
    corrective_action_priority priority
    corrective_action_status status
    uuid assignee_id FK
    date due_date
    text resolution_notes
    uuid resolved_by FK
    timestamptz resolved_at
    timestamptz framer_completed_at
    text framer_completion_notes
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }

  SAVED_REPORTS {
    uuid id PK
    uuid created_by FK
    uuid site_id FK
    text site_name
    int period_year
    int period_month
    text title
    jsonb options
    jsonb summary
    timestamptz created_at
  }
```

## Notes

- **Assignment history:** soft-unassign via `site_assignments.unassigned_at` so Daily Compliance “Missing” stays accurate for past dates.
- **Corrective actions:** framer marks `ready_for_review` (sets `framer_completed_at` / optional `framer_completion_notes`); only admin resolves.
- **Period reports:** aggregate by checklist `checkDate` for the site/month; appendix lists safety issues in all CA statuses (`open`, `in_progress`, `ready_for_review`, `resolved`) plus issues with no CA yet.
- **Migrations:** `supabase/migrations/` (apply in filename order). Aligned through `20261003000801_*`.
