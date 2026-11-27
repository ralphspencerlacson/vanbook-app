-- Run only in your project's Supabase SQL Editor after applying the migration.
-- Create and verify admin@vanbook.ph in Authentication > Users first.
-- Run after 00100_create_schema.sql. The email alone grants no privileges.
do $$
declare target uuid;
begin
  select id into target from auth.users
    where lower(email) = 'admin@vanbook.ph' and email_confirmed_at is not null;
  if target is null then raise exception 'Create and verify admin@vanbook.ph in Authentication first'; end if;
  if exists(select 1 from public.operator_applications where owner_id=target) then raise exception 'Use a dedicated super admin account'; end if;
  update public.users set role='super_admin',updated_at=now() where id=target;
  if not found then raise exception 'Apply 00100_create_schema.sql before bootstrapping the super admin'; end if;
end $$;
