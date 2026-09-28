-- Organisation erasure (D-054). The audit log keeps full before/after copies of every change, and
-- until now refused deletion by every role — so an organisation's personal data outlived the
-- organisation, and a GDPR erasure request could not be honoured.
--
-- Decided by Tabeen (PR #14 review): the log stays append-only for everyone during an
-- organisation's life, and one service-role function can erase a whole organisation, history
-- included, when it offboards or asks to be erased. The append-only trigger now allows exactly
-- one kind of delete: rows of an organisation that no longer exists, inside erase_organisation.
-- A living organisation's history still cannot be edited, deleted or truncated by any role — not
-- the service role, not the database owner — short of a migration that visibly changes this.

create or replace function private.audit_log_is_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('cfm.erasing_organisation', true) = old.organisation_id::text
       and not exists (select 1 from public.organisation o where o.id = old.organisation_id) then
      return old;
    end if;
  end if;
  raise exception 'audit_log is append-only';
end
$$;

-- Deletes the organisation (cascading to memberships, products, invitations, documents,
-- extractions and document links), then every audit row about it, and leaves one tombstone —
-- the organisation's id, the date, no content — so the log still shows that it existed and was
-- erased. Returns the storage keys of its documents, for the operator to confirm the R2 prefix
-- is empty (legal/deletion-procedure.md). Accounts in auth.users are Supabase's and are deleted
-- separately; an account may belong to other organisations.
create function public.erase_organisation(p_organisation_id uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  storage_keys text[];
  erased_rows bigint;
begin
  if not exists (select 1 from public.organisation where id = p_organisation_id) then
    raise exception 'organisation not found';
  end if;

  -- A system action, not a user's: no actor in the audit rows the cascade writes, and the
  -- membership owner guard (which only applies to signed-in users) stands aside.
  perform set_config('request.jwt.claims', '', true);

  select coalesce(array_agg(storage_key order by storage_key), '{}') into storage_keys
  from public.document where organisation_id = p_organisation_id;

  delete from public.organisation where id = p_organisation_id;

  perform set_config('cfm.erasing_organisation', p_organisation_id::text, true);
  delete from public.audit_log where organisation_id = p_organisation_id;
  get diagnostics erased_rows = row_count;
  perform set_config('cfm.erasing_organisation', '', true);

  insert into public.audit_log (organisation_id, actor, action, entity, entity_id)
  values (p_organisation_id, null, 'DELETE', 'erasure', p_organisation_id::text);

  return jsonb_build_object('storage_keys', to_jsonb(storage_keys), 'audit_rows_erased', erased_rows);
end
$$;

revoke all on function public.erase_organisation(uuid) from public, anon, authenticated;
grant execute on function public.erase_organisation(uuid) to service_role;
