-- Tenancy: organisations, memberships, products, and an append-only audit log (D-048, `02-` §4).
--
-- Every tenant row carries organisation_id and is filtered by row-level security. The app's own
-- code also scopes every query, but RLS is the layer that refuses a cross-organisation read even
-- when that code has a bug — the reason D-048 chose Supabase over D1. Tests: apps/web/test/rls.test.ts.
--
-- Supabase grants every new public table to anon and authenticated by default. Each table below
-- revokes that first and grants back only what its policies are meant to allow, column by column
-- where an update must not be able to move a row between organisations.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.organisation (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  -- ISO 3166-1 alpha-2. NULL means "not yet stated", which the catalog evaluates as unknown —
  -- never as "established in the EU". The hard rule, applied at the storage boundary.
  establishment_country text check (establishment_country ~ '^[A-Z]{2}$'),
  is_agency boolean,
  created_at timestamptz not null default now()
);

create table public.membership (
  organisation_id uuid not null references public.organisation (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);
create index membership_user_idx on public.membership (user_id);

create table public.product (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisation (id) on delete cascade,
  sku text not null check (length(btrim(sku)) between 1 and 200),
  title text,
  brand text,
  category_code text,
  gtin text,
  -- Tri-state on purpose: NULL means nobody has told us, which is not the same as false. There is
  -- no DEFAULT false anywhere in this table — a default would silently answer a question the
  -- seller never answered, and the catalog would mark requirements "not applicable" on it.
  has_battery boolean,
  is_electrical boolean,
  is_toy boolean,
  has_packaging boolean,
  country_of_origin text check (country_of_origin ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, sku)
);
create index product_organisation_idx on public.product (organisation_id);

-- No foreign key to organisation on purpose: the log has to outlive the rows it describes.
create table public.audit_log (
  id bigint generated always as identity primary key,
  organisation_id uuid not null,
  actor uuid,                        -- auth.uid() at the time; NULL for system/service actions
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_organisation_idx on public.audit_log (organisation_id, at);

-- ---------------------------------------------------------------------------------------------
-- Membership checks used by the policies. SECURITY DEFINER so a policy on membership can consult
-- membership without recursing into its own RLS; search_path pinned so nothing can shadow them.
-- ---------------------------------------------------------------------------------------------

create function private.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membership m
    where m.organisation_id = org and m.user_id = (select auth.uid())
  )
$$;

create function private.has_role(org uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membership m
    where m.organisation_id = org and m.user_id = (select auth.uid()) and m.role = any (roles)
  )
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_role(uuid, text[]) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Privileges: nothing for anon; column-level updates so organisation_id / user_id never move.
-- ---------------------------------------------------------------------------------------------

revoke all on public.organisation, public.membership, public.product, public.audit_log
  from anon, authenticated;

grant select on public.organisation to authenticated;
grant update (name, establishment_country, is_agency) on public.organisation to authenticated;

grant select, delete on public.membership to authenticated;
grant update (role) on public.membership to authenticated;

grant select, insert, delete on public.product to authenticated;
grant update (sku, title, brand, category_code, gtin, has_battery, is_electrical, is_toy,
              has_packaging, country_of_origin) on public.product to authenticated;

grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------

alter table public.organisation enable row level security;
alter table public.membership enable row level security;
alter table public.product enable row level security;
alter table public.audit_log enable row level security;

create policy organisation_select on public.organisation
  for select to authenticated using (private.is_member(id));
create policy organisation_update on public.organisation
  for update to authenticated
  using (private.has_role(id, array['owner', 'admin']))
  with check (private.has_role(id, array['owner', 'admin']));
-- No insert policy: organisations are created only by public.create_organisation(), which makes
-- the caller the owner in the same transaction. No delete policy: deleting an organisation is the
-- written deletion procedure D-013 requires, not a button.

create policy membership_select on public.membership
  for select to authenticated using (private.is_member(organisation_id));
create policy membership_update on public.membership
  for update to authenticated
  using (private.has_role(organisation_id, array['owner', 'admin']))
  with check (private.has_role(organisation_id, array['owner', 'admin']));
create policy membership_delete on public.membership
  for delete to authenticated
  using (private.has_role(organisation_id, array['owner', 'admin']) or user_id = (select auth.uid()));
-- No insert policy: a client-side insert would let anyone who learns an organisation's id add
-- themselves to it. Members join through an invitation function (next increment).

create policy product_select on public.product
  for select to authenticated using (private.is_member(organisation_id));
create policy product_insert on public.product
  for insert to authenticated
  with check (private.has_role(organisation_id, array['owner', 'admin', 'member']));
create policy product_update on public.product
  for update to authenticated
  using (private.has_role(organisation_id, array['owner', 'admin', 'member']))
  with check (private.has_role(organisation_id, array['owner', 'admin', 'member']));
create policy product_delete on public.product
  for delete to authenticated
  using (private.has_role(organisation_id, array['owner', 'admin', 'member']));

create policy audit_log_select on public.audit_log
  for select to authenticated using (private.has_role(organisation_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------------------------
-- Creating an organisation
-- ---------------------------------------------------------------------------------------------

create function public.create_organisation(p_name text, p_establishment_country text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  new_id uuid;
begin
  if actor is null then
    raise exception 'must be signed in to create an organisation';
  end if;
  insert into public.organisation (name, establishment_country)
    values (p_name, p_establishment_country)
    returning id into new_id;
  insert into public.membership (organisation_id, user_id, role) values (new_id, actor, 'owner');
  return new_id;
end
$$;

revoke all on function public.create_organisation(text, text) from public, anon;
grant execute on function public.create_organisation(text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Membership guard: the owner role is only granted, changed or removed by an owner, and an
-- organisation never loses its last owner. Skipped for system/service actions (no auth.uid()),
-- so a cascade from deleting an organisation or a user account is not blocked by it.
-- ---------------------------------------------------------------------------------------------

create function private.guard_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  actor_is_owner boolean;
  other_owners integer;
begin
  if actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and (new.organisation_id <> old.organisation_id or new.user_id <> old.user_id) then
    raise exception 'a membership cannot be moved to another organisation or user';
  end if;

  select exists (
    select 1 from public.membership m
    where m.organisation_id = old.organisation_id and m.user_id = actor and m.role = 'owner'
  ) into actor_is_owner;

  if (old.role = 'owner' or (tg_op = 'UPDATE' and new.role = 'owner')) and not actor_is_owner then
    raise exception 'only an owner can grant, change or remove the owner role';
  end if;

  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into other_owners from public.membership m
    where m.organisation_id = old.organisation_id and m.role = 'owner' and m.user_id <> old.user_id;
    if other_owners = 0 then
      raise exception 'an organisation must keep at least one owner';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger membership_guard before update or delete on public.membership
  for each row execute function private.guard_membership();

-- ---------------------------------------------------------------------------------------------
-- updated_at, and the audit trail
-- ---------------------------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger product_touch before update on public.product
  for each row execute function private.touch_updated_at();

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  after_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_data jsonb := coalesce(after_row, before_row);
begin
  insert into public.audit_log (organisation_id, actor, action, entity, entity_id, before, after)
  values (
    case when tg_table_name = 'organisation' then (row_data ->> 'id')::uuid
         else (row_data ->> 'organisation_id')::uuid end,
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'user_id'),
    before_row,
    after_row
  );
  return null;
end
$$;

create trigger organisation_audit after insert or update or delete on public.organisation
  for each row execute function private.audit();
create trigger membership_audit after insert or update or delete on public.membership
  for each row execute function private.audit();
create trigger product_audit after insert or update or delete on public.product
  for each row execute function private.audit();

-- Append-only, and not only for app users: this trigger fires for the service role too, so the
-- only way to change history is a migration that visibly drops it.
create function private.audit_log_is_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end
$$;

create trigger audit_log_no_update_or_delete before update or delete on public.audit_log
  for each row execute function private.audit_log_is_append_only();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_is_append_only();
