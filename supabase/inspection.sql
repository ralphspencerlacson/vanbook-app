-- Run in the SQL Editor for project pphyhsdpdsycfaleflyv.
-- SELECT only: reads schema metadata and storage bucket configuration.
-- Does not read customer/operator records, auth.users, or stored documents.
-- Application details below cover public; schema_names identifies any other
-- schemas that may need a separate inspection before migrations are designed.

select jsonb_pretty(jsonb_build_object(
  'schema_names', (
    select coalesce(jsonb_agg(nspname order by nspname), '[]'::jsonb)
    from pg_namespace
    where nspname not like 'pg_%' and nspname <> 'information_schema'
  ),
  'public_relations', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'kind', c.relkind,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'options', c.reloptions
    ) order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  ),
  'public_columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name, 'column', column_name,
      'position', ordinal_position, 'type', data_type,
      'type_schema', udt_schema, 'type_name', udt_name,
      'nullable', is_nullable, 'default', column_default,
      'identity', is_identity, 'generated', is_generated
    ) order by table_name, ordinal_position), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public'
  ),
  'public_constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', k.conname,
      'definition', pg_get_constraintdef(k.oid)
    ) order by c.relname, k.conname), '[]'::jsonb)
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  ),
  'public_indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', indexname, 'definition', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
    from pg_indexes where schemaname = 'public'
  ),
  'public_and_storage_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'table', tablename, 'name', policyname,
      'permissive', permissive, 'roles', roles, 'command', cmd,
      'using', qual, 'with_check', with_check
    ) order by schemaname, tablename, policyname), '[]'::jsonb)
    from pg_policies where schemaname in ('public', 'storage')
  ),
  'public_table_grants', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name, 'role', grantee, 'privilege', privilege_type
    ) order by table_name, grantee, privilege_type), '[]'::jsonb)
    from information_schema.table_privileges
    where table_schema = 'public'
  ),
  'public_functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'returns', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef, 'settings', p.proconfig,
      'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_can_execute',
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) order by p.proname, p.oid), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  ),
  'storage_buckets', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types
    ) order by id), '[]'::jsonb)
    from storage.buckets
  )
)) as inspection_report;
