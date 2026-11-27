-- Read-only checks after 00100_create_schema.sql and bootstrap-admin.sql.
select jsonb_pretty(jsonb_build_object(
 'all_six_tables_have_rls',(select count(*)=6 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('users','operator_applications','operator_documents','operator_document_requirements','operator_application_events','operator_vehicles')),
 'users_table_exists',to_regclass('public.users') is not null,
 'obsolete_role_tables_removed',to_regclass('public.account_roles') is null and to_regclass('public.platform_admins') is null,
 'all_auth_accounts_have_profiles',not exists(select 1 from auth.users a left join public.users u on u.id=a.id where u.id is null),
 'super_admin_configured',exists(select 1 from public.users where lower(email)='admin@vanbook.ph' and role='super_admin' and email_confirmed_at is not null),
 'operator_bucket_private',(select not public from storage.buckets where id='operator-documents'),
 'authenticated_can_change_roles',has_column_privilege('authenticated','public.users','role','UPDATE'),
 'authenticated_can_self_approve',has_column_privilege('authenticated','public.operator_applications','status','UPDATE'),
 'anonymous_can_read_user_emails',has_column_privilege('anon','public.users','email','SELECT'),
 'browser_can_provision_admins',has_function_privilege('authenticated','public.reserve_admin_invitation(text,uuid)','EXECUTE')
)) as setup_checks;
select id,email,full_name,role,email_confirmed_at,created_at from public.users order by created_at;
