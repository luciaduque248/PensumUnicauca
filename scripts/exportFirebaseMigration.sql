-- Read-only export for the authorized migration. The result contains personal
-- data and password hashes: never print it or commit it to the repository.
-- Store the export encrypted, outside the checkout, before any target writes.
select jsonb_build_object(
  'source_project', 'kdyjjbzahmyhbmuwrwzr',
  'target_project', 'mi-pensum-unicauca',
  'exported_at', now(),
  'other_provider_identities', (select count(*) from auth.identities where provider <> 'email'),
  'mfa_factors', (select count(*) from auth.mfa_factors),
  'users', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'email', email, 'encrypted_password', encrypted_password,
    'email_confirmed_at', email_confirmed_at, 'created_at', created_at,
    'last_sign_in_at', last_sign_in_at, 'banned_until', banned_until,
    'deleted_at', deleted_at, 'is_anonymous', is_anonymous
  ) order by id) from auth.users), '[]'::jsonb),
  'snapshots', coalesce((select jsonb_agg(jsonb_build_object(
    'user_id', user_id, 'academic_data', academic_data,
    'schema_version', schema_version, 'created_at', created_at,
    'updated_at', updated_at
  ) order by user_id) from public.academic_snapshots), '[]'::jsonb)
) as migration_export;
