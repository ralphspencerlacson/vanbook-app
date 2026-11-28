begin;

-- Sorting the paginated verification queue must use complete vehicle counts.
-- Ownership remains private; the helper reveals a count only to owners/admins.
create function private.operator_van_count(p_owner uuid) returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.operator_vehicles v
 where v.operator_id=p_owner and (private.is_admin() or p_owner=(select auth.uid()))
$$;
revoke all on function private.operator_van_count(uuid) from public,anon,authenticated;
grant execute on function private.operator_van_count(uuid) to authenticated;

create or replace view public.operator_verification_queue with(security_invoker=true) as
 select a.*,private.pending_van_count(a.owner_id) as pending_vehicle_count,
 private.operator_van_count(a.owner_id) as vehicle_count
 from public.operator_applications a;
revoke all on public.operator_verification_queue from public,anon,authenticated;
grant select on public.operator_verification_queue to authenticated;

notify pgrst, 'reload schema';
commit;
