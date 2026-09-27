-- Slice B increment 3 (D-051): documents, their extractions, and which products each one covers.
--
-- The trust boundary: a client can READ its organisation's documents and extraction results but
-- can never WRITE them. Documents are created by the Worker after it has stored the file and
-- hashed it; extractions are written by the Worker after the deterministic pass, the model call and
-- the confidence gate (@cfm/documents gateExtraction), or after a human review that passed the same
-- validators. Evidence — and so a "met" cell — can only come from rows no client can forge.
-- Which products a document covers is the seller's own statement, so members write that directly
-- (audited), but only within their own organisation — enforced by composite foreign keys, not code.

-- Composite keys so link rows can reference (id, organisation_id) pairs.
alter table public.product add constraint product_id_organisation_unique unique (id, organisation_id);

create table public.document (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisation (id) on delete cascade,
  -- Slice B's two types (D-012). The uploader declares it: the cheapest reliable source of what a
  -- document is, is the person holding it — no classification call (D-051).
  doc_type text not null check (doc_type in ('rp_mandate', 'epr_certificate')),
  filename text not null check (length(filename) between 1 and 255),
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text not null unique check (storage_key like organisation_id::text || '/%'),
  uploaded_by uuid references auth.users (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'accepted', 'needs_review', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, sha256),
  unique (id, organisation_id)
);
create index document_organisation_idx on public.document (organisation_id, created_at);

create table public.extraction (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  organisation_id uuid not null,
  doc_type text not null,
  -- gateExtraction's decision and full verdict, stored as returned — the evidence builder
  -- (@cfm/evidence evidenceFromVerdict) reads it back and refuses anything but "accept".
  decision text not null check (decision in ('accept', 'review')),
  verdict jsonb not null check (jsonb_typeof(verdict) = 'object'),
  source text not null check (source in ('pipeline', 'human')),
  reviewed_by uuid references auth.users (id) on delete set null,
  used_model boolean not null,
  provider text,
  model text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(12, 6),
  created_at timestamptz not null default now(),
  foreign key (document_id, organisation_id) references public.document (id, organisation_id) on delete cascade,
  -- A human-sourced extraction names its reviewer; a pipeline one never claims to have been reviewed.
  check ((source = 'human') = (reviewed_by is not null))
);
create index extraction_document_idx on public.extraction (document_id, created_at);

create table public.document_product (
  document_id uuid not null,
  product_id uuid not null,
  organisation_id uuid not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (document_id, product_id),
  -- Both ends must belong to the same organisation as the link. A member of two organisations
  -- still can't point one organisation's certificate at the other's product.
  foreign key (document_id, organisation_id) references public.document (id, organisation_id) on delete cascade,
  foreign key (product_id, organisation_id) references public.product (id, organisation_id) on delete cascade
);
create index document_product_product_idx on public.document_product (product_id);

-- Privileges: documents and extractions are read-only to clients. The Worker writes them with the
-- service role, after its own membership check and its own processing.
revoke all on public.document, public.extraction, public.document_product from anon, authenticated;
grant select on public.document, public.extraction to authenticated;
grant select, delete on public.document_product to authenticated;
grant insert (document_id, product_id, organisation_id) on public.document_product to authenticated;

alter table public.document enable row level security;
alter table public.extraction enable row level security;
alter table public.document_product enable row level security;

create policy document_select on public.document
  for select to authenticated using (private.is_member(organisation_id));
create policy extraction_select on public.extraction
  for select to authenticated using (private.is_member(organisation_id));

create policy document_product_select on public.document_product
  for select to authenticated using (private.is_member(organisation_id));
create policy document_product_insert on public.document_product
  for insert to authenticated
  with check (private.has_role(organisation_id, array['owner', 'admin', 'member']));
create policy document_product_delete on public.document_product
  for delete to authenticated
  using (private.has_role(organisation_id, array['owner', 'admin', 'member']));

create trigger document_touch before update on public.document
  for each row execute function private.touch_updated_at();

create trigger document_audit after insert or update or delete on public.document
  for each row execute function private.audit();
create trigger extraction_audit after insert or update or delete on public.extraction
  for each row execute function private.audit();
create trigger document_product_audit after insert or update or delete on public.document_product
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------------------------
-- The Worker's write surface. The Worker holds the service role, but it doesn't write these tables
-- directly: it calls these four functions, which only the service role may execute. Each one
-- re-checks the acting user's role in the database (defence in depth — the Worker checks too) and
-- records that verified user as the actor, so the audit log names who uploaded, deleted or reviewed
-- a document rather than "the system". The pipeline's own extraction passes no actor, and is logged
-- as the system, which is what it is.
-- ---------------------------------------------------------------------------------------------

grant usage on schema private to service_role;

create function private.act_as(p_actor uuid) returns void
language sql set search_path = '' as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_actor::text, 'role', 'service_role')::text, true);
$$;
revoke all on function private.act_as(uuid) from public;
grant execute on function private.act_as(uuid) to service_role;

create function private.require_role(p_actor uuid, p_organisation_id uuid, p_roles text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.membership m
    where m.organisation_id = p_organisation_id and m.user_id = p_actor and m.role = any (p_roles)
  ) then
    raise exception 'not permitted for this organisation';
  end if;
end
$$;
revoke all on function private.require_role(uuid, uuid, text[]) from public;
grant execute on function private.require_role(uuid, uuid, text[]) to service_role;

create function public.register_document(
  p_actor uuid, p_organisation_id uuid, p_doc_type text, p_filename text, p_mime text,
  p_byte_size integer, p_sha256 text, p_storage_key text, p_product_ids uuid[] default '{}'
) returns uuid
language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  perform private.require_role(p_actor, p_organisation_id, array['owner', 'admin', 'member']);
  perform private.act_as(p_actor);
  insert into public.document (organisation_id, doc_type, filename, mime, byte_size, sha256, storage_key, uploaded_by)
    values (p_organisation_id, p_doc_type, p_filename, p_mime, p_byte_size, p_sha256, p_storage_key, p_actor)
    returning id into new_id;
  insert into public.document_product (document_id, product_id, organisation_id, created_by)
    select new_id, pid, p_organisation_id, p_actor from unnest(p_product_ids) as pid;
  return new_id;
end
$$;

create function public.delete_document(p_actor uuid, p_document_id uuid) returns text
language plpgsql set search_path = '' as $$
declare
  doc record;
begin
  select id, organisation_id, storage_key into doc from public.document where id = p_document_id;
  if not found then
    raise exception 'document not found';
  end if;
  perform private.require_role(p_actor, doc.organisation_id, array['owner', 'admin']);
  perform private.act_as(p_actor);
  delete from public.document where id = doc.id;
  return doc.storage_key;
end
$$;

-- An extraction and the document status it implies, in one transaction. p_actor is the reviewer
-- for a human review (who must be a member+), or NULL for the pipeline.
create function public.record_extraction(p_actor uuid, p_extraction jsonb, p_status text, p_error text default null)
returns void
language plpgsql set search_path = '' as $$
declare
  row public.extraction;
begin
  row := jsonb_populate_record(null::public.extraction, p_extraction);
  if p_actor is not null then
    perform private.require_role(p_actor, row.organisation_id, array['owner', 'admin', 'member']);
    perform private.act_as(p_actor);
  end if;
  insert into public.extraction (
    document_id, organisation_id, doc_type, decision, verdict, source, reviewed_by, used_model,
    provider, model, prompt_version, input_tokens, output_tokens, cost_usd
  ) values (
    row.document_id, row.organisation_id, row.doc_type, row.decision, row.verdict, row.source, row.reviewed_by,
    row.used_model, row.provider, row.model, row.prompt_version, row.input_tokens, row.output_tokens, row.cost_usd
  );
  update public.document set status = p_status, error = p_error where id = row.document_id;
end
$$;

create function public.set_document_status(p_document_id uuid, p_status text, p_error text default null)
returns void
language sql set search_path = '' as $$
  update public.document set status = p_status, error = p_error where id = p_document_id;
$$;

revoke all on function public.register_document(uuid, uuid, text, text, text, integer, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_document(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_extraction(uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.set_document_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_document(uuid, uuid, text, text, text, integer, text, text, uuid[]) to service_role;
grant execute on function public.delete_document(uuid, uuid) to service_role;
grant execute on function public.record_extraction(uuid, jsonb, text, text) to service_role;
grant execute on function public.set_document_status(uuid, text, text) to service_role;
