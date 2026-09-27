-- Slice B increment 2 (D-050): the facts the catalog asks about, invitations, target markets, and
-- CSV import. Same rules as 0001: RLS on everything, column-level grants, audited, and the hard
-- rule — unknown is never stored as "no" — enforced in the schema, not just in the UI.

-- ---------------------------------------------------------------------------------------------
-- Facts. The catalog evaluates a flat bag of dotted fact paths (packages/catalog/src/facts.ts)
-- where an ABSENT key means unknown and a JSON null means "we know there is none". A jsonb object
-- keeps that distinction exactly, which typed nullable columns cannot.
--
-- Typed columns stay the source of truth for their own paths (listed as reserved below, so a
-- fact can't shadow them), and keys are scoped: organisation-level facts on the organisation,
-- product-level facts on the product. Derived paths the catalog computes itself are reserved too
-- — storing one would be silently ignored by the evaluator, which is worse than refusing it.
-- ---------------------------------------------------------------------------------------------

-- The importer maps "country of origin" / "made in" to manufacturer.country
-- (packages/import/src/mapping.ts); the column is named for the fact it holds.
alter table public.product rename column country_of_origin to manufacturer_country;

create function private.is_fact_bag(facts jsonb, allowed_prefixes text[], reserved text[])
returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(facts) = 'object'
    and octet_length(facts::text) <= 16000
    and not exists (
      select 1 from jsonb_each(facts) as e (key, value)
      where e.key !~ '^[a-z]+\.[a-z0-9_]+$'
         or not (split_part(e.key, '.', 1) = any (allowed_prefixes))
         or e.key = any (reserved)
         or jsonb_typeof(e.value) not in ('string', 'number', 'boolean', 'null')
    )
$$;

alter table public.product
  add column facts jsonb not null default '{}'::jsonb
  constraint product_facts_valid check (private.is_fact_bag(
    facts,
    array['product', 'manufacturer', 'rp'],
    array['product.sku', 'product.title', 'product.brand', 'product.category_code', 'product.gtin',
          'product.has_battery', 'product.is_electrical', 'product.is_toy', 'product.has_packaging',
          'manufacturer.country', 'manufacturer.country_in_eu']
  ));

alter table public.organisation
  add column facts jsonb not null default '{}'::jsonb
  constraint organisation_facts_valid check (private.is_fact_bag(
    facts,
    array['organisation', 'packaging'],
    array['organisation.establishment_country', 'organisation.established_in_eu',
          'organisation.established_in_market']
  )),
  -- The markets the organisation sells into — what readiness is assessed against. Empty means
  -- not chosen yet, and the app asks rather than assuming.
  add column target_markets text[] not null default '{}'
  constraint organisation_target_markets_valid check (
    array_to_string(target_markets, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$' and cardinality(target_markets) <= 40
  );

grant update (facts) on public.product to authenticated;
grant update (facts, target_markets) on public.organisation to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Invitations. Owners and admins invite an email address with a role; the person accepts by
-- signing in with that address. No token to leak: signing in by magic link is the proof of
-- owning the address, and acceptance also requires auth.users.email_confirmed_at, so it holds
-- even if another sign-in method is ever enabled without confirmation. The owner role is never
-- invited — owners are made by promotion, which the membership guard (0001) restricts to owners.
-- ---------------------------------------------------------------------------------------------

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisation (id) on delete cascade,
  email text not null check (
    email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254
  ),
  role text not null check (role in ('admin', 'member', 'viewer')),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  unique (organisation_id, email)
);

revoke all on public.invitation from anon, authenticated;
grant select, delete on public.invitation to authenticated;
-- invited_by and expires_at are not grantable: they come from the defaults, so an invitation
-- can't claim to be from someone else or to last forever.
grant insert (organisation_id, email, role) on public.invitation to authenticated;

alter table public.invitation enable row level security;

create policy invitation_select on public.invitation
  for select to authenticated using (private.has_role(organisation_id, array['owner', 'admin']));
create policy invitation_insert on public.invitation
  for insert to authenticated with check (private.has_role(organisation_id, array['owner', 'admin']));
create policy invitation_delete on public.invitation
  for delete to authenticated using (private.has_role(organisation_id, array['owner', 'admin']));

create trigger invitation_audit after insert or update or delete on public.invitation
  for each row execute function private.audit();

-- What the signed-in person has been invited to. SECURITY DEFINER because they are not yet a
-- member and can't read the organisation's name through RLS — this shows exactly that much.
create function public.my_invitations()
returns table (id uuid, organisation_id uuid, organisation_name text, role text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.organisation_id, o.name, i.role, i.expires_at
  from public.invitation i
  join public.organisation o on o.id = i.organisation_id
  join auth.users u on u.id = (select auth.uid())
  where i.email = lower(u.email) and u.email_confirmed_at is not null and i.expires_at > now()
  order by i.created_at
$$;

create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  actor_email text;
  confirmed_at timestamptz;
  inv public.invitation%rowtype;
begin
  if actor is null then
    raise exception 'must be signed in to accept an invitation';
  end if;
  select lower(u.email), u.email_confirmed_at into actor_email, confirmed_at
    from auth.users u where u.id = actor;
  if confirmed_at is null then
    raise exception 'confirm your email address before accepting an invitation';
  end if;

  select * into inv from public.invitation i
    where i.id = p_invitation_id and i.email = actor_email and i.expires_at > now()
    for update;
  if not found then
    raise exception 'invitation not found, expired, or addressed to a different email';
  end if;

  -- Already a member: keep the existing role; an invitation never silently changes one.
  insert into public.membership (organisation_id, user_id, role)
    values (inv.organisation_id, actor, inv.role)
    on conflict (organisation_id, user_id) do nothing;
  delete from public.invitation where id = inv.id;
  return inv.organisation_id;
end
$$;

create function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'must be signed in';
  end if;
  delete from public.invitation i
    using auth.users u
    where i.id = p_invitation_id and u.id = actor and i.email = lower(u.email);
end
$$;

revoke all on function public.my_invitations() from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
revoke all on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.my_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- CSV import. An import can add knowledge and correct it, never erase it: a blank cell arrives
-- as NULL (typed columns) or an absent key (facts), and COALESCE / jsonb || keep what was already
-- known. A JSON null inside facts is a positive "none" and does replace. All-or-nothing: one
-- statement, so a bad row fails the whole import rather than half-applying it.
--
-- SECURITY INVOKER: it runs with the caller's rights, so RLS decides — a viewer can't import, and
-- nobody can import into an organisation they don't belong to.
-- ---------------------------------------------------------------------------------------------

create function public.import_products(p_organisation_id uuid, p_rows jsonb)
returns table (inserted integer, updated integer)
language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'import at most 5000 products at a time';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r (sku text)
    group by btrim(r.sku) having count(*) > 1
  ) then
    raise exception 'the same SKU appears more than once in this import';
  end if;

  return query
  with incoming as (
    select * from jsonb_to_recordset(p_rows) as r (
      sku text, title text, brand text, category_code text, gtin text,
      has_battery boolean, is_electrical boolean, is_toy boolean, has_packaging boolean,
      manufacturer_country text, facts jsonb
    )
  ), upserted as (
    insert into public.product as p (
      organisation_id, sku, title, brand, category_code, gtin,
      has_battery, is_electrical, is_toy, has_packaging, manufacturer_country, facts
    )
    select p_organisation_id, btrim(i.sku), i.title, i.brand, i.category_code, i.gtin,
           i.has_battery, i.is_electrical, i.is_toy, i.has_packaging, i.manufacturer_country,
           coalesce(i.facts, '{}'::jsonb)
    from incoming i
    on conflict (organisation_id, sku) do update set
      title = coalesce(excluded.title, p.title),
      brand = coalesce(excluded.brand, p.brand),
      category_code = coalesce(excluded.category_code, p.category_code),
      gtin = coalesce(excluded.gtin, p.gtin),
      has_battery = coalesce(excluded.has_battery, p.has_battery),
      is_electrical = coalesce(excluded.is_electrical, p.is_electrical),
      is_toy = coalesce(excluded.is_toy, p.is_toy),
      has_packaging = coalesce(excluded.has_packaging, p.has_packaging),
      manufacturer_country = coalesce(excluded.manufacturer_country, p.manufacturer_country),
      facts = p.facts || excluded.facts
    returning (xmax = 0) as was_inserted
  )
  select (count(*) filter (where was_inserted))::integer,
         (count(*) filter (where not was_inserted))::integer
  from upserted;
end
$$;

revoke all on function public.import_products(uuid, jsonb) from public, anon;
grant execute on function public.import_products(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Member list with email addresses. Addresses live in auth.users, which RLS'd clients can't read;
-- this returns them to members of the same organisation only — to anyone else, an empty list.
-- ---------------------------------------------------------------------------------------------

create function public.organisation_members(p_organisation_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email, m.role, m.created_at
  from public.membership m
  join auth.users u on u.id = m.user_id
  where m.organisation_id = p_organisation_id and private.is_member(p_organisation_id)
  order by m.created_at
$$;

revoke all on function public.organisation_members(uuid) from public, anon;
grant execute on function public.organisation_members(uuid) to authenticated;
