-- Site vs hazard photo classification on submission_photos.
-- Client: PhotoUpload photoKind; listSubmissionPhotos optional filter.

create type public.submission_photo_kind as enum ('site', 'hazard');

alter table public.submission_photos
  add column if not exists photo_kind public.submission_photo_kind not null default 'site';

comment on column public.submission_photos.photo_kind is
  'site = general jobsite photos; hazard = tied to hazard observation section';

-- Before this column, uploads only appeared under Hazards (reclassify existing rows).
update public.submission_photos
set photo_kind = 'hazard'::public.submission_photo_kind;

create index if not exists submission_photos_submission_kind_idx
  on public.submission_photos (submission_id, photo_kind);
