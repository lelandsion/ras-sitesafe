-- RAS SiteSafe — realistic Vancouver Island framing jobsites for the form dropdown.
-- Safe to re-run (idempotent by site name + assignment uniqueness).
-- Prerequisites: schema migration applied; demo framer Auth user created
--   (framer@ras-sitesafe-demo.com / Daniel Ortiz) so public.profiles has a row.
-- Apply: Supabase Dashboard → SQL Editor → paste & run.
-- Does not invent or print demo passwords.

begin;

-- ---------------------------------------------------------------------------
-- Sites (insert only when name is missing — avoids awkward duplicates)
-- ---------------------------------------------------------------------------
with seed (name, address) as (
  values
    (
      'Langford Yard — Shop & Prefab Staging',
      '2350 Millstream Rd, Langford, BC'
    ),
    (
      'North Yard — Truss & Panel Laydown',
      'Langford industrial corridor, BC'
    ),
    (
      'Millstream Heights — Phase 2 Framing',
      'Millstream Heights, Langford, BC'
    ),
    (
      'Royal Bay — Colwood Residential',
      'Royal Bay Ave, Colwood, BC'
    ),
    (
      'Bear Mountain — Townhomes Framing',
      'Bear Mountain Pkwy, Langford, BC'
    ),
    (
      'Westshore Commons — Multi-Family Formwork',
      'Goldstream Ave, Langford, BC'
    ),
    (
      'View Royal Waterfront — Stick Frame',
      'Island Hwy, View Royal, BC'
    ),
    (
      'Cobble Hill — Cowichan Valley Spec Homes',
      'Cobble Hill Rd, Cobble Hill, BC'
    )
)
insert into public.sites (name, address)
select s.name, s.address
from seed s
where not exists (
  select 1
  from public.sites existing
  where existing.name = s.name
);

-- ---------------------------------------------------------------------------
-- Assign seeded sites to demo framer Daniel when that profile exists
-- ---------------------------------------------------------------------------
insert into public.site_assignments (site_id, framer_id)
select s.id, p.id
from public.sites s
cross join lateral (
  select pr.id
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where u.email = 'framer@ras-sitesafe-demo.com'
  limit 1
) p
where s.name in (
  'Langford Yard — Shop & Prefab Staging',
  'North Yard — Truss & Panel Laydown',
  'Millstream Heights — Phase 2 Framing',
  'Royal Bay — Colwood Residential',
  'Bear Mountain — Townhomes Framing',
  'Westshore Commons — Multi-Family Formwork',
  'View Royal Waterfront — Stick Frame',
  'Cobble Hill — Cowichan Valley Spec Homes'
)
on conflict (site_id, framer_id) do nothing;

-- Also attach any legacy single demo site if it was created from older seed notes
insert into public.site_assignments (site_id, framer_id)
select s.id, p.id
from public.sites s
cross join lateral (
  select pr.id
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where u.email = 'framer@ras-sitesafe-demo.com'
  limit 1
) p
where s.name = 'RAS Demo Jobsite — North Yard'
on conflict (site_id, framer_id) do nothing;

commit;
