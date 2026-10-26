-- Conference room photos for the booking pages, chosen by admins (Joe,
-- 2026-10-26). They were a list in components/book/AvailabilityView.tsx,
-- keyed by location slug and external name, with the files in public/rooms,
-- so changing a photo meant a developer and a deploy.
--
-- photo_urls is in display order; the first is the cover. An entry is either
-- one of the original files ('/rooms/...') or the public URL of an upload in
-- the room-photos bucket. Null or empty: the page shows "Photos coming soon".
alter table public.rooms
  add column if not exists photo_urls text[];

-- Public, because the booking pages are public. Uploads and deletes go
-- through an admin-only API route with the service-role client, so no write
-- policy is granted.
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;

-- Carry over what the booking pages show today, matched the same way the
-- code matched them. Only rooms with no photos yet, so a rerun never
-- overwrites an admin's choice.
--
-- The two El Segundo Medium files are misnamed, and the crossing below is
-- deliberate: es-medium.jpg shows the Medium + room and es-medium-plus.jpg
-- the Medium. Caroline confirmed which room is which (2026-10-01).
update public.rooms r
set photo_urls = m.urls
from public.locations l,
  (values
    ('el-segundo',     'Large',     array['/rooms/es-large.jpg']),
    ('el-segundo',     'Medium +',  array['/rooms/es-medium.jpg']),
    ('el-segundo',     'Medium',    array['/rooms/es-medium-plus.jpg']),
    ('el-segundo',     'Small',     array['/rooms/es-small.jpg']),
    ('marina-del-rey', 'Small',     array['/rooms/mdr-conference-3.jpg', '/rooms/mdr-conference-2.jpg']),
    ('costa-mesa',     'Large',     array['/rooms/cm-large.jpg', '/rooms/cm-large-2.jpg']),
    ('costa-mesa',     'Medium +',  array['/rooms/cm-medium-plus.jpg']),
    ('costa-mesa',     'Medium',    array['/rooms/cm-medium.jpg']),
    ('costa-mesa',     'Small',     array['/rooms/cm-small.jpg'])
  ) as m(slug, external_name, urls)
where r.location_id = l.id
  and l.slug = m.slug
  and r.external_name = m.external_name
  and (r.photo_urls is null or cardinality(r.photo_urls) = 0);
