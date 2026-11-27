begin;

-- Contact edits use the current identity; no caller-supplied owner ID is accepted.
create function public.update_operator_contact_profile(
  p_version integer, p_name text, p_phone text, p_contact_email text
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  a public.operator_applications%rowtype;
  new_version integer;
  contact_name text := trim(coalesce(p_name, ''));
  contact_phone text := trim(coalesce(p_phone, ''));
  contact_email text := trim(coalesce(p_contact_email, ''));
begin
  if not private.is_operator_account() then
    raise exception 'Verified operator account required' using errcode = '42501';
  end if;
  if length(contact_name) not between 1 and 150
    or length(contact_phone) not between 7 and 30
    or contact_phone !~ '^[+0-9() -]{7,30}$'
    or length(contact_email) > 254
    or contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Check your name and contact details' using errcode = '22023';
  end if;
  select * into a from public.operator_applications
    where owner_id = auth.uid() for update;
  if not found then
    raise exception 'Operator application unavailable' using errcode = '42501';
  end if;
  if a.version is distinct from p_version then
    raise exception 'Account details changed; reload before saving' using errcode = '40001';
  end if;
  if a.contact_name = contact_name and a.contact_phone = contact_phone
    and a.contact_email = contact_email then return a.version; end if;

  update public.operator_applications set
    contact_name = trim(p_name), contact_phone = trim(p_phone),
    contact_email = trim(p_contact_email), operator_updated_at = now()
    where id = a.id returning version into new_version;
  insert into public.operator_application_events(application_id, actor_id, from_status, to_status, note)
    values(a.id, auth.uid(), a.status, a.status, 'Operator updated account contact details');
  return new_version;
end $$;
revoke all on function public.update_operator_contact_profile(integer,text,text,text) from public, anon, authenticated;
grant execute on function public.update_operator_contact_profile(integer,text,text,text) to authenticated;

-- Keep the user directory consistent with contact edits and application edits.
create function private.sync_operator_contact_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.users set full_name = new.contact_name, updated_at = now()
    where id = new.owner_id and role = 'operator';
  return new;
end $$;
revoke all on function private.sync_operator_contact_name() from public, anon, authenticated;
create trigger operator_contact_name after update of contact_name on public.operator_applications
  for each row when (old.contact_name is distinct from new.contact_name)
  execute function private.sync_operator_contact_name();

-- Auth email/metadata updates must not restore an operator's previous name.
create or replace function private.sync_public_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.users u set
    email = coalesce(new.email, ''), email_confirmed_at = new.email_confirmed_at,
    full_name = case when u.role = 'operator' then coalesce(
      (select a.contact_name from public.operator_applications a where a.owner_id = new.id),
      left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 150)
    ) else left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 150) end,
    updated_at = now()
    where u.id = new.id;
  return new;
end $$;
revoke all on function private.sync_public_user() from public, anon, authenticated;

commit;
