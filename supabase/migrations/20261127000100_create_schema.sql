-- Complete VANBOOK schema. Run once on a database without VANBOOK application tables.
-- All profiles and roles live in public.users; credentials stay in auth.users.
begin;
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null default '',
 full_name text not null default '' check(length(full_name)<=150),
 role text not null default 'customer' check(role in ('customer','operator','admin','super_admin','agent')),
 email_confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.operator_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  business_name text not null default '' check (length(business_name) <= 200),
  registration_number text not null default '' check (length(registration_number) <= 100),
  contact_name text not null default '' check (length(contact_name) <= 150),
  contact_email text not null default '' check (length(contact_email) <= 254),
  contact_phone text not null default '' check (length(contact_phone) <= 30),
  operating_base text not null default '' check (length(operating_base) <= 200),
  service_areas text[] not null default '{}' check (cardinality(service_areas) <= 30 and length(array_to_string(service_areas, ',')) <= 3000),
  notes text not null default '' check (length(notes) <= 3000),
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','rejected')),
  version bigint not null default 1,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create function private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid() and role in ('admin','super_admin'))
$$;
create function private.is_super_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid() and role='super_admin')
$$;
create function private.is_approved_operator() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users u join public.operator_applications a on a.owner_id=u.id
 where u.id=auth.uid() and u.role='operator' and a.status='approved')
$$;
create function private.operator_is_approved(p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.operator_applications a join public.users u on u.id=a.owner_id
 where a.owner_id=p_owner and a.status='approved' and u.role='operator')
$$;

revoke all on function private.is_admin(),private.is_super_admin(),private.is_approved_operator(),private.operator_is_approved(uuid) from public,anon,authenticated;
grant execute on function private.is_admin(),private.is_super_admin(),private.is_approved_operator(),private.operator_is_approved(uuid) to authenticated;
grant usage on schema private to anon;
grant execute on function private.operator_is_approved(uuid) to anon;
alter table public.users enable row level security;
revoke all on public.users from public,anon,authenticated;
grant select on public.users to authenticated;
create policy users_read_own_or_admin on public.users for select to authenticated
 using(id=(select auth.uid()) or (select private.is_admin()));
insert into public.users(id,email,full_name,email_confirmed_at,role)
 select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name',''),150),email_confirmed_at,
 case when raw_user_meta_data->>'account_type'='operator' then 'operator' else 'customer' end from auth.users;

create index operator_applications_queue on public.operator_applications(status,updated_at desc);
alter table public.operator_applications enable row level security;
revoke all on public.operator_applications from public,anon,authenticated;
grant select on public.operator_applications to authenticated;
create policy applications_read on public.operator_applications for select to authenticated
 using((select private.is_admin()) or (owner_id=(select auth.uid()) and (select private.is_approved_operator())));
create function private.touch_operator_application() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end $$;
revoke all on function private.touch_operator_application() from public,anon,authenticated;
create trigger application_version before update on public.operator_applications for each row execute function private.touch_operator_application();
create table public.operator_document_requirements (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{0,63}$'),
  label text not null check (length(trim(label)) between 1 and 150),
  required boolean not null default false,
  active boolean not null default true
);
insert into public.operator_document_requirements(code,label) values('supporting_document','Supporting document');
alter table public.operator_document_requirements enable row level security;
revoke all on public.operator_document_requirements from public,anon,authenticated;
grant select,insert,update,delete on public.operator_document_requirements to authenticated;
create policy requirements_read on public.operator_document_requirements for select to authenticated using((select private.is_admin()));
create policy requirements_insert on public.operator_document_requirements for insert to authenticated with check((select private.is_admin()));
create policy requirements_update on public.operator_document_requirements for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy requirements_delete on public.operator_document_requirements for delete to authenticated using((select private.is_admin()));
create table public.operator_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.operator_applications(id) on delete cascade,
  storage_path text not null unique,
  category text not null check (length(category) <= 64),
  file_name text not null check (length(file_name) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
create table public.operator_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.operator_applications(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  from_status text not null,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index operator_documents_application on public.operator_documents(application_id);
create index operator_application_events_history on public.operator_application_events(application_id,created_at desc);
alter table public.operator_documents enable row level security;
alter table public.operator_application_events enable row level security;
revoke all on public.operator_documents,public.operator_application_events from public,anon,authenticated;
grant select on public.operator_documents,public.operator_application_events to authenticated;
create policy documents_read on public.operator_documents for select to authenticated using(exists(select 1 from public.operator_applications a where a.id=application_id));
create policy events_read on public.operator_application_events for select to authenticated using(exists(select 1 from public.operator_applications a where a.id=application_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('operator-documents','operator-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy operator_files_read on storage.objects for select to authenticated using(bucket_id='operator-documents' and
 ((select private.is_admin()) or ((storage.foldername(name))[1]=(select auth.uid())::text and (select private.is_approved_operator()))));
-- Uploads happen only through validated server registration, never pending sessions.
create function public.finalize_operator_registration(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.operator_applications;
begin
 select * into a from public.operator_applications where id=p_id for update;
 if a.id is null or a.status<>'draft' or not exists(select 1 from public.users r where r.id=a.owner_id and r.role='operator') then raise exception 'Invalid registration'; end if;
 if length(trim(a.business_name))=0 or length(trim(a.contact_name))=0 or a.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or a.contact_phone !~ '^[+0-9() -]{7,30}$' or length(trim(a.operating_base))=0 or cardinality(a.service_areas)=0 then raise exception 'Complete required business fields'; end if;
 if exists(select 1 from public.operator_document_requirements r where r.active and r.required and not exists(
 select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.storage_path where d.application_id=a.id and d.category=r.code)) then raise exception 'Upload required documents'; end if;
 update public.operator_applications set status='submitted',submitted_at=now() where id=a.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status) values(a.id,a.owner_id,'draft','submitted');
end $$;
create function public.review_operator_application(p_id uuid, p_version bigint, p_decision text, p_note text)
returns public.operator_applications language plpgsql security definer set search_path = '' as $$
declare a public.operator_applications;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('changes_requested','approved','rejected') then raise exception 'Invalid review decision'; end if;
  if length(coalesce(p_note,'')) > 3000 then raise exception 'Review note is too long'; end if;
  if p_decision <> 'approved' and length(trim(coalesce(p_note,''))) = 0 then raise exception 'Explain the requested changes or rejection'; end if;
  select * into a from public.operator_applications where id=p_id for update;
  if a.id is null then raise exception 'Application not found'; end if;
  if a.version is distinct from p_version then raise exception 'Application changed' using errcode = '40001'; end if;
  if a.status <> 'submitted' then raise exception 'Only submitted applications can be reviewed'; end if;
  update public.operator_applications set status=p_decision, reviewed_at=now(), reviewed_by=auth.uid(), review_note=trim(coalesce(p_note,''))
    where id=a.id returning * into a;
  insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
    values(a.id,auth.uid(),'submitted',p_decision,trim(coalesce(p_note,'')));
  return a;
end $$;
create function private.require_verified_operator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' and not exists(select 1 from auth.users where id=new.owner_id and email_confirmed_at is not null)
 then raise exception 'Operator must verify their email before approval'; end if;
 return new;
end $$;
create function public.account_access() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('role',u.role,'approved',private.is_approved_operator(),
 'status',(select a.status from public.operator_applications a where a.owner_id=auth.uid()))
 from public.users u where u.id=auth.uid()
$$;
create function public.admin_update_operator(p_id uuid,p_version bigint,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a public.operator_applications;
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into a from public.operator_applications where id=p_id for update;
 if a.id is null then raise exception 'Application not found'; end if;
 if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 if length(trim(coalesce(p_details->>'business_name','')))=0 or length(trim(coalesce(p_details->>'contact_name','')))=0
 or coalesce(p_details->>'contact_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or coalesce(p_details->>'contact_phone','') !~ '^[+0-9() -]{7,30}$' or length(trim(coalesce(p_details->>'operating_base','')))=0
 or jsonb_array_length(coalesce(p_details->'service_areas','[]'::jsonb))=0 then raise exception 'Complete required fields'; end if;
 update public.operator_applications set business_name=p_details->>'business_name',registration_number=coalesce(p_details->>'registration_number',''),
 contact_name=p_details->>'contact_name',contact_email=p_details->>'contact_email',contact_phone=p_details->>'contact_phone',
 operating_base=p_details->>'operating_base',service_areas=array(select jsonb_array_elements_text(p_details->'service_areas')),notes=coalesce(p_details->>'notes','') where id=a.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note) values(a.id,auth.uid(),a.status,a.status,'Administrator updated business details');
end $$;
revoke all on function public.finalize_operator_registration(uuid),public.review_operator_application(uuid,bigint,text,text),private.require_verified_operator(),public.account_access(),public.admin_update_operator(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_operator_registration(uuid) to service_role;
grant execute on function public.review_operator_application(uuid,bigint,text,text),public.account_access(),public.admin_update_operator(uuid,bigint,jsonb) to authenticated;
create trigger require_verified_operator before update on public.operator_applications for each row execute function private.require_verified_operator();
create table private.admin_invitations(email text primary key,invited_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create function public.reserve_admin_invitation(p_email text,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.users where id=p_actor and role='super_admin') then raise exception 'Super administrator required' using errcode='42501'; end if;
 if exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then raise exception 'Account already exists'; end if;
 insert into private.admin_invitations(email,invited_by) values(lower(trim(p_email)),p_actor);
end $$;
create function public.release_admin_invitation(p_email text,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.users where id=p_actor and role='super_admin') then raise exception 'Super administrator required' using errcode='42501'; end if;
 delete from private.admin_invitations where email=lower(trim(p_email)) and invited_by=p_actor;
end $$;
create function public.admin_accounts() returns table(user_id uuid,email text,role text,confirmed boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select u.id,u.email,u.role,u.email_confirmed_at is not null from public.users u order by u.created_at;
end $$;
create function private.create_public_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare assigned_role text;
begin
 if new.invited_at is not null and exists(select 1 from private.admin_invitations where email=lower(new.email)) then
  assigned_role='admin';
  delete from private.admin_invitations where email=lower(new.email);
 else
  assigned_role=case when new.raw_user_meta_data->>'account_type'='operator' then 'operator' else 'customer' end;
 end if;
 insert into public.users(id,email,full_name,email_confirmed_at,role) values(
  new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),150),new.email_confirmed_at,assigned_role);
 return new;
end $$;
create function private.sync_public_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.users set email=coalesce(new.email,''),email_confirmed_at=new.email_confirmed_at,
 full_name=left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),150),updated_at=now()
 where id=new.id;
 return new;
end $$;
revoke all on function public.reserve_admin_invitation(text,uuid),public.release_admin_invitation(text,uuid),public.admin_accounts(),private.create_public_user(),private.sync_public_user() from public,anon,authenticated;
grant execute on function public.reserve_admin_invitation(text,uuid),public.release_admin_invitation(text,uuid) to service_role;
grant execute on function public.admin_accounts() to authenticated;
create trigger create_public_user after insert on auth.users for each row execute function private.create_public_user();
create trigger sync_public_user after update of email,email_confirmed_at,raw_user_meta_data on auth.users for each row execute function private.sync_public_user();
create table private.registration_limits(key text primary key,window_started timestamptz not null default now(),attempts integer not null default 1);
create function public.check_registration_limit(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from private.registration_limits where window_started<now()-interval '1 day';
 insert into private.registration_limits(key) values(p_key) on conflict(key) do update set
 attempts=case when registration_limits.window_started<now()-interval '15 minutes' then 1 else registration_limits.attempts+1 end,
 window_started=case when registration_limits.window_started<now()-interval '15 minutes' then now() else registration_limits.window_started end returning attempts into n;
 return n<=5;
end $$;
revoke all on function public.check_registration_limit(text) from public,anon,authenticated;
grant execute on function public.check_registration_limit(text) to service_role;
create table public.operator_vehicles (
 id uuid primary key default gen_random_uuid(),
 operator_id uuid not null references public.operator_applications(owner_id),
 title text not null check(length(trim(title)) between 1 and 150),
 make text not null check(length(trim(make)) between 1 and 80),
 model text not null check(length(trim(model)) between 1 and 80),
 model_year integer not null check(model_year between 1990 and 2100),
 seats integer not null check(seats between 1 and 30),
 location text not null check(length(trim(location)) between 1 and 200),
 description text not null default '' check(length(description)<=3000),
 plate_number text not null check(length(trim(plate_number)) between 1 and 30),
 status text not null default 'draft' check(status in ('draft','submitted','published','rejected')),
 version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index operator_vehicles_owner on public.operator_vehicles(operator_id);
create index operator_vehicles_status on public.operator_vehicles(status,updated_at desc);
alter table public.operator_vehicles enable row level security;
revoke all on public.operator_vehicles from public,anon,authenticated;
-- Public clients may select only catalog fields. Plates and ownership are read
-- exclusively through get_managed_vehicles, after a role/ownership check.
grant select(id,title,make,model,model_year,seats,location,description,status,version,updated_at) on public.operator_vehicles to anon,authenticated;
grant insert(operator_id,title,make,model,model_year,seats,location,description,plate_number),update(title,make,model,model_year,seats,location,description,plate_number) on public.operator_vehicles to authenticated;
create policy vehicles_public_read on public.operator_vehicles for select to anon,authenticated using(status='published' and private.operator_is_approved(operator_id));
create policy vehicles_manage_read on public.operator_vehicles for select to authenticated using((select private.is_admin()) or (operator_id=(select auth.uid()) and (select private.is_approved_operator())));
create policy vehicles_create on public.operator_vehicles for insert to authenticated with check(
 ((operator_id=(select auth.uid()) and (select private.is_approved_operator())) or ((select private.is_admin()) and private.operator_is_approved(operator_id))) and status='draft' and version=1);
create policy vehicles_update on public.operator_vehicles for update to authenticated using(
 (select private.is_admin()) or (operator_id=(select auth.uid()) and (select private.is_approved_operator()))) with check(
 (select private.is_admin()) or (operator_id=(select auth.uid()) and (select private.is_approved_operator())));
create function private.touch_vehicle() returns trigger language plpgsql set search_path='' as $$
begin
 new.version=old.version+1; new.updated_at=now();
 if not private.is_admin() and row(new.title,new.make,new.model,new.model_year,new.seats,new.location,new.description,new.plate_number)
 is distinct from row(old.title,old.make,old.model,old.model_year,old.seats,old.location,old.description,old.plate_number) then new.status='draft'; end if;
 return new;
end $$;
create function public.set_vehicle_status(p_id uuid,p_version bigint,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare v public.operator_vehicles;
begin
 select * into v from public.operator_vehicles where id=p_id for update;
 if v.id is null then raise exception 'Vehicle not found'; end if;
 if v.version is distinct from p_version then raise exception 'Vehicle changed' using errcode='40001'; end if;
 if private.is_admin() then
   if p_status is null or p_status not in ('draft','published','rejected') then raise exception 'Invalid status'; end if;
 elsif v.operator_id=auth.uid() and private.is_approved_operator() then
   if p_status is distinct from 'submitted' or v.status not in ('draft','rejected') then raise exception 'Only draft or rejected listings can be submitted'; end if;
 else raise exception 'Access denied' using errcode='42501'; end if;
 if not private.operator_is_approved(v.operator_id) then raise exception 'Operator must be approved'; end if;
 update public.operator_vehicles set status=p_status where id=v.id;
end $$;
revoke all on function private.touch_vehicle(),public.set_vehicle_status(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.set_vehicle_status(uuid,bigint,text) to authenticated;
create trigger vehicle_version before update on public.operator_vehicles for each row execute function private.touch_vehicle();
create view public.vehicle_listings with(security_invoker=true) as
 select id,title,make,model,model_year,seats,location,description,updated_at from public.operator_vehicles where status='published';
grant select on public.vehicle_listings to anon,authenticated;
create function public.get_managed_vehicles(p_id uuid default null) returns setof public.operator_vehicles
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() and not private.is_approved_operator() then raise exception 'Management access required' using errcode='42501'; end if;
 return query select v.* from public.operator_vehicles v where (private.is_admin() or v.operator_id=auth.uid()) and (p_id is null or v.id=p_id) order by v.updated_at desc limit 200;
end $$;
revoke all on function public.get_managed_vehicles(uuid) from public,anon,authenticated;
grant execute on function public.get_managed_vehicles(uuid) to authenticated;
grant usage on schema public to service_role;
grant all on public.users,public.operator_applications,public.operator_documents,public.operator_document_requirements,public.operator_application_events,public.operator_vehicles to service_role;
notify pgrst, 'reload schema';
commit;
