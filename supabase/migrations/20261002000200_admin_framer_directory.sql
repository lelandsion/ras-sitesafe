-- Admin-only framer directory (display name + auth email) for Sites assignment UI.
-- Client calls via supabase.rpc('admin_list_framers').

create or replace function public.admin_list_framers()
returns table (
  id uuid,
  display_name text,
  email text
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    u.email::text
  from public.profiles p
  inner join auth.users u on u.id = p.id
  where p.role = 'framer'::public.user_role
  order by p.display_name asc, u.email asc;
end;
$$;

revoke all on function public.admin_list_framers() from public;
grant execute on function public.admin_list_framers() to authenticated;
