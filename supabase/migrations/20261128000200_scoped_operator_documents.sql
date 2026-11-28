begin;

alter table public.operator_document_requirements
  add column scope text not null default 'user' check(scope in ('user','van'));
update public.operator_document_requirements set scope='van'
  where code in ('vehicle_or_cr','insurance');

alter table public.operator_documents add column vehicle_id uuid
  references public.operator_vehicles(id) on delete cascade;
create index operator_documents_vehicle on public.operator_documents(vehicle_id,category);

-- Existing unassigned uploads are retained. They never satisfy a van checklist.
create function private.validate_document_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.vehicle_id is not null and not exists(
  select 1 from public.operator_vehicles v join public.operator_applications a on a.owner_id=v.operator_id
  where v.id=new.vehicle_id and a.id=new.application_id)
 then raise exception 'Document vehicle does not belong to this application' using errcode='42501'; end if;
 if not exists(select 1 from public.operator_document_requirements r where r.code=new.category
  and r.scope=case when new.vehicle_id is null then 'user' else 'van' end)
 then raise exception 'Document scope does not match its requirement'; end if;
 return new;
end $$;
revoke all on function private.validate_document_scope() from public,anon,authenticated;
create trigger document_scope before insert or update of application_id,vehicle_id,category
 on public.operator_documents for each row execute function private.validate_document_scope();

create function private.documents_complete(p_application uuid,p_vehicle uuid,p_reviewed boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.operator_document_requirements r
 where r.active and r.required and r.scope=case when p_vehicle is null then 'user' else 'van' end
 and not exists(select 1 from public.operator_documents d join storage.objects o
 on o.bucket_id='operator-documents' and o.name=d.storage_path
 where d.application_id=p_application and d.vehicle_id is not distinct from p_vehicle and d.category=r.code
 and (not p_reviewed or d.review_status='approved')))
$$;
revoke all on function private.documents_complete(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function public.review_operator_document(p_id uuid,p_version bigint,p_status text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; d public.operator_documents; v public.operator_vehicles;
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into d from public.operator_documents where id=p_id;
 select * into a from public.operator_applications where id=d.application_id for update;
 if a.id is null then raise exception 'Document not found'; end if;
 if d.vehicle_id is null then
  if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 else
  select * into v from public.operator_vehicles where id=d.vehicle_id for update;
  if v.version is distinct from p_version then raise exception 'Vehicle changed' using errcode='40001'; end if;
 end if;
 -- Re-read after the parent lock: an operator may have replaced this upload.
 select * into d from public.operator_documents where id=p_id for update;
 if d.id is null then raise exception 'Document changed' using errcode='40001'; end if;
 if p_status is null or p_status not in ('approved','changes_requested') or length(coalesce(p_note,''))>3000
 or (p_status='changes_requested' and length(trim(coalesce(p_note,'')))=0) then raise exception 'Add a review note for requested changes'; end if;
 update public.operator_documents set review_status=p_status,review_note=trim(coalesce(p_note,'')),reviewed_at=now(),reviewed_by=auth.uid() where id=d.id;
 if d.vehicle_id is null then
  update public.operator_applications set status=case when p_status='changes_requested' then 'changes_requested' else status end,
   review_note=case when p_status='changes_requested' then trim(p_note) else review_note end where id=a.id;
 else
  update public.operator_vehicles set status=case when p_status='changes_requested' then 'rejected' else status end where id=v.id;
 end if;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 values(a.id,auth.uid(),a.status,case when d.vehicle_id is null and p_status='changes_requested' then 'changes_requested' else a.status end,
 case when d.vehicle_id is null then 'Shared document ' else 'Van '||v.plate_number||' document ' end||d.category||': '||p_status||' '||coalesce(p_note,''));
end $$;

create or replace function public.review_operator_application(p_id uuid,p_version bigint,p_decision text,p_note text)
returns public.operator_applications language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; v public.operator_vehicles;
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','changes_requested','rejected') then raise exception 'Invalid review decision'; end if;
 if length(coalesce(p_note,''))>3000 or (p_decision<>'approved' and length(trim(coalesce(p_note,'')))=0) then raise exception 'Explain the requested changes or rejection'; end if;
 select * into a from public.operator_applications where id=p_id for update;
 if a.id is null then raise exception 'Application not found'; end if;
 if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 if a.status<>'submitted' then raise exception 'Only submitted applications can be reviewed'; end if;
 if p_decision='approved' then
  if not exists(select 1 from public.users where id=a.owner_id and email_confirmed_at is not null)
   then raise exception 'Operator must verify their email before approval'; end if;
  if not private.documents_complete(a.id,null,true) then raise exception 'Approve each required document before approving the operator'; end if;
  select * into v from public.operator_vehicles where operator_id=a.owner_id order by created_at,id limit 1 for update;
  if v.id is null then raise exception 'Add the first van before initial approval'; end if;
  if not private.documents_complete(a.id,null,true) or not private.documents_complete(a.id,v.id,true)
   then raise exception 'Approve required shared and first-van documents before initial approval'; end if;
  if v.status='rejected' or not exists(select 1 from public.operator_vehicle_photos where vehicle_id=v.id and position='front')
   then raise exception 'Complete the first van verification before initial approval'; end if;
 end if;
 update public.operator_applications set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),review_note=trim(coalesce(p_note,'')) where id=a.id returning * into a;
 if p_decision='approved' then update public.operator_vehicles set status='published',available_for_requests=false where id=v.id; end if;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 values(a.id,auth.uid(),'submitted',p_decision,case when p_decision='approved' then 'Initial approval: operator and first van '||v.plate_number||'. ' else '' end||trim(coalesce(p_note,'')));
 return a;
end $$;

create or replace function public.set_vehicle_status(p_id uuid,p_version bigint,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.operator_vehicles; a public.operator_applications;
begin
 select * into v from public.operator_vehicles where id=p_id;
 select * into a from public.operator_applications where owner_id=v.operator_id for update;
 select * into v from public.operator_vehicles where id=p_id for update;
 if v.id is null then raise exception 'Vehicle not found'; end if;
 if v.version is distinct from p_version then raise exception 'Vehicle changed' using errcode='40001'; end if;
 if private.is_admin() then
  if p_status is null or p_status not in ('draft','published','rejected') then raise exception 'Invalid status'; end if;
 elsif v.operator_id=auth.uid() and private.is_approved_operator() then
  if p_status is distinct from 'submitted' or v.status not in ('draft','rejected') then raise exception 'Only draft or rejected listings can be submitted'; end if;
 else raise exception 'Access denied' using errcode='42501'; end if;
 if not private.operator_is_approved(v.operator_id) then raise exception 'Operator must be approved'; end if;
 if p_status='published' and (not private.documents_complete(a.id,v.id,true)
  or not exists(select 1 from public.operator_vehicle_photos where vehicle_id=v.id and position='front'))
 then raise exception 'Approve required van documents and verify its photos before publishing'; end if;
 update public.operator_vehicles set status=p_status where id=v.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 values(a.id,auth.uid(),a.status,a.status,'Van '||v.plate_number||': '||p_status);
end $$;

create or replace function public.get_operator_review_vehicles(p_owner uuid) returns setof public.operator_vehicles
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select * from public.operator_vehicles where operator_id=p_owner order by created_at,id limit 200;
end $$;

create function private.pending_van_count(p_owner uuid) returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::int from public.operator_vehicles v where v.operator_id=p_owner
 and v.status in ('draft','submitted') and (private.is_admin() or p_owner=(select auth.uid()))
$$;
revoke all on function private.pending_van_count(uuid) from public,anon,authenticated;
grant execute on function private.pending_van_count(uuid) to authenticated;
create view public.operator_verification_queue with(security_invoker=true) as
 select a.*,private.pending_van_count(a.owner_id) as pending_vehicle_count
 from public.operator_applications a;
revoke all on public.operator_verification_queue from public,anon,authenticated;
grant select on public.operator_verification_queue to authenticated;

-- Scoped registration, replacement and vehicle-save functions follow below.

create or replace function public.finalize_operator_registration(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.operator_applications;
begin
 select * into a from public.operator_applications where id=p_id for update;
 if a.id is null or a.status<>'draft' or not exists(select 1 from public.users r where r.id=a.owner_id and r.role='operator') then raise exception 'Invalid registration'; end if;
 if length(trim(a.business_name))=0 or length(trim(a.contact_name))=0 or a.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or a.contact_phone !~ '^[+0-9() -]{7,30}$' or length(trim(a.operating_base))=0 or cardinality(a.service_areas)=0 then raise exception 'Complete required business fields'; end if;
 if not private.documents_complete(a.id,null) or exists(select 1 from public.operator_vehicles v
 where v.operator_id=a.owner_id and not private.documents_complete(a.id,v.id)) then raise exception 'Upload required documents'; end if;
 update public.operator_applications set status='submitted',submitted_at=now() where id=a.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status) values(a.id,a.owner_id,'draft','submitted');
end $$;

create or replace function public.operator_resubmit_application(p_id uuid,p_version bigint,p_details jsonb,p_documents jsonb default '[]') returns void
language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; item jsonb;
begin
 if not private.is_operator_account() then raise exception 'Operator access required' using errcode='42501'; end if;
 select * into a from public.operator_applications where id=p_id and owner_id=auth.uid() for update;
 if a.id is null then raise exception 'Application not found' using errcode='42501'; end if;
 if a.version is distinct from p_version then raise exception 'Application changed' using errcode='40001'; end if;
 if a.status not in ('submitted','changes_requested','draft') then raise exception 'This application cannot be edited'; end if;
 if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents)>12 then raise exception 'Invalid documents'; end if;
 if length(trim(coalesce(p_details->>'business_name','')))=0 or length(trim(coalesce(p_details->>'contact_name','')))=0
 or coalesce(p_details->>'contact_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or coalesce(p_details->>'contact_phone','') !~ '^[+0-9() -]{7,30}$' or length(trim(coalesce(p_details->>'operating_base','')))=0
 or jsonb_array_length(coalesce(p_details->'service_areas','[]'::jsonb))=0 then raise exception 'Complete required business fields'; end if;
 for item in select * from jsonb_array_elements(p_documents) loop
  if not exists(select 1 from public.operator_document_requirements where code=item->>'category' and active and scope='user')
  or split_part(item->>'storage_path','/',1) is distinct from auth.uid()::text or split_part(item->>'storage_path','/',2) is distinct from a.id::text
  or not exists(select 1 from storage.objects where bucket_id='operator-documents' and name=item->>'storage_path')
  then raise exception 'Invalid document upload'; end if;
  delete from public.operator_documents where application_id=a.id and vehicle_id is null and category=item->>'category';
  insert into public.operator_documents(application_id,storage_path,category,file_name,content_type,size_bytes)
  values(a.id,item->>'storage_path',item->>'category',item->>'file_name',item->>'content_type',(item->>'size_bytes')::int);
 end loop;
 if not private.documents_complete(a.id,null) then raise exception 'Upload required documents'; end if;
 if exists(select 1 from public.operator_documents where application_id=a.id and vehicle_id is null and review_status='changes_requested')
 then raise exception 'Replace documents marked for resubmission'; end if;
 update public.operator_applications set business_name=trim(p_details->>'business_name'),registration_number=coalesce(p_details->>'registration_number',''),
 contact_name=trim(p_details->>'contact_name'),contact_email=trim(p_details->>'contact_email'),contact_phone=trim(p_details->>'contact_phone'),
 operating_base=trim(p_details->>'operating_base'),service_areas=array(select jsonb_array_elements_text(p_details->'service_areas')),
 notes=coalesce(p_details->>'notes',''),status='submitted',operator_updated_at=now(),resubmitted_at=now(),submitted_at=now(),
 reviewed_at=null,reviewed_by=null,review_note='' where id=a.id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 values(a.id,auth.uid(),a.status,'submitted','Operator updated and resubmitted their application');
end $$;

drop function public.save_operator_vehicle(uuid,bigint,jsonb,jsonb);
create function public.save_operator_vehicle(p_id uuid,p_version bigint,p_details jsonb,p_photos jsonb default '[]',p_documents jsonb default '[]') returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.operator_vehicles; photo jsonb; item jsonb; saved_id uuid; app_id uuid;
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
 if jsonb_typeof(p_photos) is distinct from 'array' or jsonb_array_length(p_photos)>4 then raise exception 'Invalid vehicle photos'; end if;
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
  if split_part(photo->>'storage_path','/',1) is distinct from auth.uid()::text or split_part(photo->>'storage_path','/',2) is distinct from app_id::text
  or not exists(select 1 from storage.objects where bucket_id='operator-documents' and name=photo->>'storage_path') then raise exception 'Invalid photo upload'; end if;
  insert into public.operator_vehicle_photos(vehicle_id,storage_path,position,file_name,content_type,size_bytes)
  values(saved_id,photo->>'storage_path',photo->>'position',photo->>'file_name',photo->>'content_type',(photo->>'size_bytes')::int)
  on conflict(vehicle_id,position) do update set storage_path=excluded.storage_path,file_name=excluded.file_name,
  content_type=excluded.content_type,size_bytes=excluded.size_bytes,created_at=now();
 end loop;
 if not exists(select 1 from public.operator_vehicle_photos where vehicle_id=saved_id and position='front') then raise exception 'Upload a front photo'; end if;
 if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents)>12 then raise exception 'Invalid documents'; end if;
 for item in select * from jsonb_array_elements(p_documents) loop
  if not exists(select 1 from public.operator_document_requirements where code=item->>'category' and active and scope='van')
  or split_part(item->>'storage_path','/',1) is distinct from auth.uid()::text or split_part(item->>'storage_path','/',2) is distinct from app_id::text
  or not exists(select 1 from storage.objects where bucket_id='operator-documents' and name=item->>'storage_path') then raise exception 'Invalid van document upload'; end if;
  delete from public.operator_documents where application_id=app_id and vehicle_id=saved_id and category=item->>'category';
  insert into public.operator_documents(application_id,vehicle_id,storage_path,category,file_name,content_type,size_bytes)
  values(app_id,saved_id,item->>'storage_path',item->>'category',item->>'file_name',item->>'content_type',(item->>'size_bytes')::int);
 end loop;
 if not private.documents_complete(app_id,saved_id) then raise exception 'Upload required van documents'; end if;
 if exists(select 1 from public.operator_documents where vehicle_id=saved_id and review_status='changes_requested') then raise exception 'Replace van documents marked for resubmission'; end if;
 update public.operator_applications set operator_updated_at=now() where id=app_id;
 insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note)
 select app_id,auth.uid(),status,status,'Operator submitted van for verification: '||trim(p_details->>'plate_number') from public.operator_applications where id=app_id;
 return saved_id;
end $$;
revoke all on function public.save_operator_vehicle(uuid,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_operator_vehicle(uuid,bigint,jsonb,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
