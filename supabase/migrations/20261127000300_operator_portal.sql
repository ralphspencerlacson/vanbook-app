begin;

alter table public.operator_applications
  add column operator_updated_at timestamptz,
  add column resubmitted_at timestamptz;
alter table public.operator_documents
  add column review_status text not null default 'pending' check(review_status in ('pending','approved','changes_requested')),
  add column review_note text not null default '' check(length(review_note)<=3000),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id);
alter table public.operator_vehicles
  add column amenities text[] not null default '{}' check(cardinality(amenities)<=12),
  add column available_for_requests boolean not null default false;
alter table public.operator_vehicles drop constraint operator_vehicles_operator_id_fkey;
alter table public.operator_vehicles add constraint operator_vehicles_operator_id_fkey
  foreign key(operator_id) references public.operator_applications(owner_id) on delete cascade;

create function private.is_operator_account() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid() and role='operator' and email_confirmed_at is not null)
$$;
revoke all on function private.is_operator_account() from public,anon,authenticated;
grant execute on function private.is_operator_account() to authenticated;

drop policy applications_read on public.operator_applications;
create policy applications_read on public.operator_applications for select to authenticated using(
 (select private.is_admin()) or (owner_id=(select auth.uid()) and (select private.is_operator_account())));
drop policy requirements_read on public.operator_document_requirements;
create policy requirements_read on public.operator_document_requirements for select to authenticated using(
 (select private.is_admin()) or (active and (select private.is_operator_account())));
drop policy operator_files_read on storage.objects;
create policy operator_files_read on storage.objects for select to authenticated using(bucket_id='operator-documents' and
 ((select private.is_admin()) or ((storage.foldername(name))[1]=(select auth.uid())::text and (select private.is_operator_account()))));
drop policy vehicles_manage_read on public.operator_vehicles;
create policy vehicles_manage_read on public.operator_vehicles for select to authenticated using(
 (select private.is_admin()) or (operator_id=(select auth.uid()) and (select private.is_operator_account())));
drop policy vehicles_create on public.operator_vehicles;
create policy vehicles_create on public.operator_vehicles for insert to authenticated with check(
 ((operator_id=(select auth.uid()) and (select private.is_operator_account())) or (select private.is_admin())) and status='draft' and version=1);
drop policy vehicles_update on public.operator_vehicles;
create policy vehicles_update on public.operator_vehicles for update to authenticated using(
 (select private.is_admin()) or (operator_id=(select auth.uid()) and (select private.is_operator_account()))) with check(
 (select private.is_admin()) or (operator_id=(select auth.uid()) and (select private.is_operator_account())));
grant insert(amenities),update(amenities) on public.operator_vehicles to authenticated;

create table public.operator_vehicle_photos (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.operator_vehicles(id) on delete cascade,
 storage_path text not null unique,
 position text not null check(position in ('front','side','interior','back')),
 file_name text not null check(length(file_name) between 1 and 255),
 content_type text not null check(content_type in ('image/jpeg','image/png')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 created_at timestamptz not null default now(),
 unique(vehicle_id,position)
);
create index operator_vehicle_photos_vehicle on public.operator_vehicle_photos(vehicle_id);
alter table public.operator_vehicle_photos enable row level security;
revoke all on public.operator_vehicle_photos from public,anon,authenticated;
grant select on public.operator_vehicle_photos to authenticated;
grant all on public.operator_vehicle_photos to service_role;
create function private.owns_operator_vehicle(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_operator_account() and exists(select 1 from public.operator_vehicles where id=p_id and operator_id=auth.uid())
$$;
revoke all on function private.owns_operator_vehicle(uuid) from public,anon,authenticated;
grant execute on function private.owns_operator_vehicle(uuid) to authenticated;
create policy vehicle_photos_read on public.operator_vehicle_photos for select to authenticated using(
 (select private.is_admin()) or private.owns_operator_vehicle(vehicle_id));

create or replace function public.get_managed_vehicles(p_id uuid default null) returns setof public.operator_vehicles
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() and not private.is_operator_account() then raise exception 'Management access required' using errcode='42501'; end if;
 return query select v.* from public.operator_vehicles v where (private.is_admin() or v.operator_id=auth.uid()) and (p_id is null or v.id=p_id) order by v.updated_at desc limit 200;
end $$;

-- A document review and application version change commit together. Owners cannot
-- set review fields or write application/document records through the Data API.
create function public.review_operator_document(p_id uuid,p_version bigint,p_status text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; d public.operator_documents;
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into d from public.operator_documents where id=p_id;
 select * into a from public.operator_applications where id=d.application_id for update;
 if a.id is null then raise exception 'Document not found'; end if;
 if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 if p_status not in ('approved','changes_requested') or p_status is null or length(coalesce(p_note,''))>3000
 or (p_status='changes_requested' and length(trim(coalesce(p_note,'')))=0) then raise exception 'Add a review note for requested changes'; end if;
 update public.operator_documents set review_status=p_status,review_note=trim(coalesce(p_note,'')),reviewed_at=now(),reviewed_by=auth.uid() where id=d.id;
 update public.operator_applications set status=case when p_status='changes_requested' then 'changes_requested' else status end,
 review_note=case when p_status='changes_requested' then trim(p_note) else review_note end where id=a.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 values(a.id,auth.uid(),a.status,case when p_status='changes_requested' then 'changes_requested' else a.status end,
 'Document '||d.category||': '||p_status||case when coalesce(p_note,'')<>'' then ' — '||trim(p_note) else '' end);
end $$;

create function public.operator_resubmit_application(p_id uuid,p_version bigint,p_details jsonb,p_documents jsonb default '[]') returns void
language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; item jsonb;
begin
 if not private.is_operator_account() then raise exception 'Operator access required' using errcode='42501'; end if;
 select * into a from public.operator_applications where id=p_id and owner_id=auth.uid() for update;
 if a.id is null then raise exception 'Application not found' using errcode='42501'; end if;
 if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 if a.status not in ('submitted','changes_requested','draft') then raise exception 'This application cannot be edited'; end if;
 if jsonb_typeof(p_documents)<>'array' or jsonb_array_length(p_documents)>12 then raise exception 'Invalid documents'; end if;
 if length(trim(coalesce(p_details->>'business_name','')))=0 or length(trim(coalesce(p_details->>'contact_name','')))=0
 or coalesce(p_details->>'contact_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or coalesce(p_details->>'contact_phone','') !~ '^[+0-9() -]{7,30}$' or length(trim(coalesce(p_details->>'operating_base','')))=0
 or jsonb_array_length(coalesce(p_details->'service_areas','[]'::jsonb))=0 then raise exception 'Complete required business fields'; end if;
 for item in select * from jsonb_array_elements(p_documents) loop
  if not exists(select 1 from public.operator_document_requirements where code=item->>'category' and active)
  or split_part(item->>'storage_path','/',1)<>auth.uid()::text or split_part(item->>'storage_path','/',2)<>a.id::text
  or not exists(select 1 from storage.objects where bucket_id='operator-documents' and name=item->>'storage_path')
  then raise exception 'Invalid document upload'; end if;
  -- Remove metadata for this category only; historical file objects are retained.
  delete from public.operator_documents where application_id=a.id and category=item->>'category';
  insert into public.operator_documents(application_id,storage_path,category,file_name,content_type,size_bytes)
  values(a.id,item->>'storage_path',item->>'category',item->>'file_name',item->>'content_type',(item->>'size_bytes')::int);
 end loop;
 if exists(select 1 from public.operator_document_requirements r where r.active and r.required and not exists(
 select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.storage_path
 where d.application_id=a.id and d.category=r.code)) then raise exception 'Upload required documents'; end if;
 if exists(select 1 from public.operator_documents where application_id=a.id and review_status='changes_requested')
 then raise exception 'Replace documents marked for resubmission'; end if;
 update public.operator_applications set business_name=trim(p_details->>'business_name'),registration_number=coalesce(p_details->>'registration_number',''),
 contact_name=trim(p_details->>'contact_name'),contact_email=trim(p_details->>'contact_email'),contact_phone=trim(p_details->>'contact_phone'),
 operating_base=trim(p_details->>'operating_base'),service_areas=array(select jsonb_array_elements_text(p_details->'service_areas')),
 notes=coalesce(p_details->>'notes',''),status='submitted',operator_updated_at=now(),resubmitted_at=now(),submitted_at=now(),
 reviewed_at=null,reviewed_by=null,review_note='' where id=a.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 values(a.id,auth.uid(),a.status,'submitted','Operator updated and resubmitted their application');
end $$;

create function public.save_operator_vehicle(p_id uuid,p_version bigint,p_details jsonb,p_photos jsonb default '[]') returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.operator_vehicles; photo jsonb; saved_id uuid; app_id uuid;
begin
 if not private.is_operator_account() then raise exception 'Operator access required' using errcode='42501'; end if;
 select id into app_id from public.operator_applications where owner_id=auth.uid() and status<>'rejected' for update;
 if app_id is null then raise exception 'Application access required'; end if;
 if p_id is not null then
  select * into v from public.operator_vehicles where id=p_id and operator_id=auth.uid() for update;
  if v.id is null then raise exception 'Vehicle access denied' using errcode='42501'; end if;
  if v.version is distinct from p_version then raise exception 'Vehicle changed' using errcode='40001'; end if;
  saved_id=v.id;
 else saved_id=gen_random_uuid(); end if;
 if jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)>4 then raise exception 'Invalid vehicle photos'; end if;
 if p_id is null then
  insert into public.operator_vehicles(id,operator_id,title,make,model,model_year,seats,location,description,plate_number,amenities)
  values(saved_id,auth.uid(),trim(p_details->>'title'),trim(p_details->>'make'),trim(p_details->>'model'),(p_details->>'model_year')::int,
  (p_details->>'seats')::int,trim(p_details->>'location'),coalesce(p_details->>'description',''),trim(p_details->>'plate_number'),
  array(select jsonb_array_elements_text(coalesce(p_details->'amenities','[]'::jsonb))));
 else
  update public.operator_vehicles set title=trim(p_details->>'title'),make=trim(p_details->>'make'),model=trim(p_details->>'model'),
  model_year=(p_details->>'model_year')::int,seats=(p_details->>'seats')::int,location=trim(p_details->>'location'),
  description=coalesce(p_details->>'description',''),plate_number=trim(p_details->>'plate_number'),
  amenities=array(select jsonb_array_elements_text(coalesce(p_details->'amenities','[]'::jsonb))),status='draft',available_for_requests=false where id=saved_id;
 end if;
 for photo in select * from jsonb_array_elements(p_photos) loop
  if split_part(photo->>'storage_path','/',1)<>auth.uid()::text or split_part(photo->>'storage_path','/',2)<>app_id::text
  or not exists(select 1 from storage.objects where bucket_id='operator-documents' and name=photo->>'storage_path') then raise exception 'Invalid photo upload'; end if;
  insert into public.operator_vehicle_photos(vehicle_id,storage_path,position,file_name,content_type,size_bytes)
  values(saved_id,photo->>'storage_path',photo->>'position',photo->>'file_name',photo->>'content_type',(photo->>'size_bytes')::int)
  on conflict(vehicle_id,position) do update set storage_path=excluded.storage_path,file_name=excluded.file_name,
  content_type=excluded.content_type,size_bytes=excluded.size_bytes,created_at=now();
 end loop;
 if not exists(select 1 from public.operator_vehicle_photos where vehicle_id=saved_id and position='front') then raise exception 'Upload a front photo'; end if;
 update public.operator_applications set operator_updated_at=now() where id=app_id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 select app_id,auth.uid(),status,status,'Operator updated vehicle: '||trim(p_details->>'title') from public.operator_applications where id=app_id;
 return saved_id;
end $$;

create function public.set_vehicle_availability(p_id uuid,p_version bigint,p_available boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v public.operator_vehicles;
begin
 select * into v from public.operator_vehicles where id=p_id for update;
 if v.id is null or not (private.is_admin() or (private.is_operator_account() and v.operator_id=auth.uid())) then raise exception 'Access denied' using errcode='42501'; end if;
 if v.version is distinct from p_version then raise exception 'Vehicle changed' using errcode='40001'; end if;
 if p_available and (v.status<>'published' or not private.operator_is_approved(v.operator_id)) then raise exception 'Approval is required before accepting requests'; end if;
 update public.operator_vehicles set available_for_requests=p_available where id=v.id;
end $$;

create function public.get_operator_review_vehicles(p_owner uuid) returns setof public.operator_vehicles
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select * from public.operator_vehicles where operator_id=p_owner order by created_at limit 200;
end $$;
revoke all on function public.get_operator_review_vehicles(uuid) from public,anon,authenticated;
grant execute on function public.get_operator_review_vehicles(uuid) to authenticated;

create or replace function public.review_operator_application(p_id uuid,p_version bigint,p_decision text,p_note text)
returns public.operator_applications language plpgsql security definer set search_path='' as $$
declare a public.operator_applications;
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','changes_requested','rejected') then raise exception 'Invalid review decision'; end if;
 if length(coalesce(p_note,''))>3000 or (p_decision<>'approved' and length(trim(coalesce(p_note,'')))=0) then raise exception 'Explain the requested changes or rejection'; end if;
 select * into a from public.operator_applications where id=p_id for update;
 if a.id is null then raise exception 'Application not found'; end if;
 if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 if a.status<>'submitted' then raise exception 'Only submitted applications can be reviewed'; end if;
 if p_decision='approved' and exists(select 1 from public.operator_document_requirements r where r.active and r.required
 and not exists(select 1 from public.operator_documents d where d.application_id=a.id and d.category=r.code and d.review_status='approved'))
 then raise exception 'Approve each required document before approving the operator'; end if;
 update public.operator_applications set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),review_note=trim(coalesce(p_note,'')) where id=a.id returning * into a;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note) values(a.id,auth.uid(),'submitted',p_decision,trim(coalesce(p_note,'')));
 return a;
end $$;

create or replace function private.touch_vehicle() returns trigger language plpgsql set search_path='' as $$
begin
 new.version=old.version+1; new.updated_at=now();
 if not private.is_admin() and row(new.title,new.make,new.model,new.model_year,new.seats,new.location,new.description,new.plate_number,new.amenities)
 is distinct from row(old.title,old.make,old.model,old.model_year,old.seats,old.location,old.description,old.plate_number,old.amenities) then new.status='draft'; end if;
 if new.status<>'published' then new.available_for_requests=false; end if;
 return new;
end $$;

revoke all on function public.review_operator_document(uuid,bigint,text,text),public.operator_resubmit_application(uuid,bigint,jsonb,jsonb),public.save_operator_vehicle(uuid,bigint,jsonb,jsonb),public.set_vehicle_availability(uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.review_operator_document(uuid,bigint,text,text),public.operator_resubmit_application(uuid,bigint,jsonb,jsonb),public.save_operator_vehicle(uuid,bigint,jsonb,jsonb),public.set_vehicle_availability(uuid,bigint,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
