# RAS SiteSafe — Entity Relationship Diagram

Tables: `profiles`, `sites`, `site_assignments`, `submissions`, `submission_photos`.

Enums:

- `user_role`: `admin` | `framer`
- `submission_status`: `draft` → `submitted` → `under_review` → `approved` | `rejected`

See rendered image: [ras-sitesafe-erd.png](./ras-sitesafe-erd.png)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "extends"
  PROFILES ||--o{ SITE_ASSIGNMENTS : "framer_id"
  SITES ||--o{ SITE_ASSIGNMENTS : "site_id"
  SITES ||--o{ SUBMISSIONS : "site_id"
  PROFILES ||--o{ SUBMISSIONS : "submitted_by"
  PROFILES ||--o{ SUBMISSIONS : "reviewed_by"
  SUBMISSIONS ||--o{ SUBMISSION_PHOTOS : "submission_id"

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
  }

  SUBMISSIONS {
    uuid id PK
    uuid site_id FK
    uuid submitted_by FK
    submission_status status
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
    timestamptz created_at
  }
```
