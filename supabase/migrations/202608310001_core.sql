-- Comex Control - Skip · schema consolidado para Supabase PostgreSQL
-- Baseado no modelo oficial do projeto original. Não contém dados nem segredos.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin create type public.company_role as enum ('OWNER','ADMIN','AUDITOR','OPERATOR','VIEWER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.import_stage as enum ('IMPORT_STARTED','IN_TRANSIT','PENDING','COMPLETED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.customs_channel as enum ('NOT_ASSIGNED','GREEN','YELLOW','RED','GRAY'); exception when duplicate_object then null; end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.handle_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles(user_id,email,display_name,last_login_at)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),now())
  on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name,last_login_at=now(),updated_at=now();
  update public.company_memberships set user_id=new.id,updated_at=now()
    where user_id is null and lower(user_email::text)=lower(new.email);
  return new;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  legal_name text not null,
  trade_name text not null,
  tax_id citext,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_code_shape check (upper(code::text) ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$')
);
create unique index if not exists companies_tax_id_uidx on public.companies(tax_id) where tax_id is not null;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text not null,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_email citext not null,
  role public.company_role not null default 'VIEWER',
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, user_email)
);
create unique index if not exists company_memberships_user_uidx on public.company_memberships(company_id,user_id) where user_id is not null;
create index if not exists company_memberships_lookup_idx on public.company_memberships(user_id,user_email,active);

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform_email citext not null,
  google_subject text not null,
  google_email citext not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create table if not exists public.carrier_registry (
  code text primary key,
  display_name text not null,
  organization_type text not null default 'OCEAN_CARRIER',
  tracking_url text,
  api_portal_url text,
  official_source_url text,
  integration_mode text not null default 'MANUAL',
  dcsa boolean not null default false,
  active boolean not null default true,
  notes text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.carrier_aliases (
  alias_normalized text primary key,
  alias_display text not null,
  carrier_code text not null references public.carrier_registry(code) on delete cascade,
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists carrier_aliases_carrier_idx on public.carrier_aliases(carrier_code);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  internal_reference text not null,
  declaration_type text not null default 'NOT_REGISTERED',
  declaration_number text,
  declaration_registered_at timestamptz,
  importer_name text not null,
  supplier_name text,
  origin_port_code text,
  origin_port_name text,
  destination_port_code text,
  destination_port_name text,
  eta timestamptz,
  bill_of_lading text,
  booking_reference text,
  carrier_code text references public.carrier_registry(code),
  tracking_reference_type text,
  incoterm text,
  notes text,
  stage public.import_stage not null default 'IMPORT_STARTED',
  status_label text not null default 'Início da importação',
  status_color text not null default '#38BDF8',
  customs_channel public.customs_channel not null default 'NOT_ASSIGNED',
  channel_assigned_at timestamptz,
  source text not null default 'APP',
  source_sheet_row_key text,
  sync_version integer not null default 1 check (sync_version > 0),
  sheet_sync_status text not null default 'PENDING',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,internal_reference),
  unique(company_id,id)
);
create unique index if not exists imports_company_declaration_uidx on public.imports(company_id,declaration_number) where declaration_number is not null;
create index if not exists imports_company_status_eta_idx on public.imports(company_id,stage,eta);
create index if not exists imports_company_updated_idx on public.imports(company_id,updated_at desc);

create table if not exists public.import_details (
  import_id uuid primary key references public.imports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  broker_trade text,
  purchase_order text,
  proforma_number text,
  proforma_date date,
  exporter_name text,
  product_name text,
  quantity numeric,
  quantity_unit text,
  merchandise_value numeric,
  currency_code char(3),
  payment_terms text,
  payment_due_date date,
  payment_status text,
  transit_time_days numeric,
  free_time_days numeric,
  pickup_deadline date,
  documentation_status text,
  shipping_company_raw text,
  vessel_name text,
  container_count numeric,
  etd timestamptz,
  tax_benefit text,
  gru_amount numeric,
  siscomex_amount numeric,
  icms_amount numeric,
  ii_amount numeric,
  pis_amount numeric,
  cofins_amount numeric,
  afrmm_amount numeric,
  demurrage_amount numeric,
  storage_amount numeric,
  bl_release_amount numeric,
  invoice_number text,
  total_product_value numeric,
  invoice_value numeric,
  invoice_check_value numeric,
  exchange_base_value numeric,
  exchange_rate numeric,
  payment_date date,
  exchange_difference numeric,
  exchange_difference_type text,
  exchange_contract text,
  operational_status text,
  customs_channel_label text,
  customs_channel_code integer,
  garlic_grade_55_60 numeric,
  garlic_grade_60_65 numeric,
  garlic_grade_65_70 numeric,
  package_count numeric,
  raw_container_reference text,
  source_workbook text,
  source_fingerprint text,
  source_sheet text,
  source_row_number integer,
  data_quality_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,import_id),
  foreign key(company_id,import_id) references public.imports(company_id,id) on delete cascade
);
create index if not exists import_details_source_idx on public.import_details(source_fingerprint,source_sheet,source_row_number);

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  container_number text not null,
  carrier_code text references public.carrier_registry(code),
  carrier_name text,
  provider text,
  provider_url text,
  tracking_reference text,
  tracking_reference_type text,
  stage public.import_stage not null default 'IMPORT_STARTED',
  status_label text not null default 'Início da importação',
  status_color text not null default '#38BDF8',
  status_raw text not null default 'REGISTERED',
  current_location text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  eta timestamptz,
  origin_port_code text,
  origin_port_name text,
  origin_country text,
  origin_latitude double precision,
  origin_longitude double precision,
  destination_port_code text,
  destination_port_name text,
  destination_country text,
  destination_latitude double precision,
  destination_longitude double precision,
  vessel_name text,
  vessel_imo text,
  vessel_mmsi text,
  voyage_number text,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  position_source text not null default 'UNKNOWN',
  position_confidence text not null default 'UNKNOWN',
  position_observed_at timestamptz,
  last_provider_update_at timestamptz,
  last_auto_checked_at timestamptz,
  last_manual_checked_at timestamptz,
  last_check_source text not null default 'automatic',
  sync_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,container_number),
  unique(company_id,id),
  constraint containers_iso_shape check (container_number ~ '^[A-Z]{3}[UJZ][0-9]{7}$')
);
create index if not exists containers_company_stage_idx on public.containers(company_id,stage);
create index if not exists containers_company_eta_idx on public.containers(company_id,eta);

create table if not exists public.import_containers (
  company_id uuid not null references public.companies(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  source text not null default 'APP',
  linked_at timestamptz not null default now(),
  primary key(company_id,import_id,container_id),
  foreign key(company_id,import_id) references public.imports(company_id,id) on delete cascade,
  foreign key(company_id,container_id) references public.containers(company_id,id) on delete cascade
);

create table if not exists public.container_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_name text,
  recorded_at timestamptz not null,
  source text not null,
  position_source text not null default 'UNKNOWN',
  position_confidence text not null default 'UNKNOWN',
  vessel_imo text,
  vessel_mmsi text,
  event_code text,
  un_location_code text,
  provider_event_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key(company_id,container_id) references public.containers(company_id,id) on delete cascade
);
create unique index if not exists container_positions_event_uidx on public.container_positions(company_id,container_id,provider_event_id) where provider_event_id is not null;
create index if not exists container_positions_history_idx on public.container_positions(company_id,container_id,recorded_at desc);

create table if not exists public.container_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  from_stage public.import_stage,
  to_stage public.import_stage not null,
  provider_status text,
  status_label text not null,
  status_color text not null,
  source text not null,
  synthetic_transition boolean not null default false,
  note text,
  changed_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  foreign key(company_id,container_id) references public.containers(company_id,id) on delete cascade
);
create index if not exists container_status_history_idx on public.container_status_history(company_id,container_id,changed_at desc);

create table if not exists public.import_customs_channel_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  from_channel public.customs_channel not null,
  to_channel public.customs_channel not null,
  source text not null,
  note text,
  changed_at timestamptz not null default now(),
  foreign key(company_id,import_id) references public.imports(company_id,id) on delete cascade
);
create index if not exists import_channel_history_idx on public.import_customs_channel_history(company_id,import_id,changed_at desc);

create table if not exists public.tracking_receipts (
  company_id uuid not null references public.companies(id) on delete cascade,
  idempotency_key text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key(company_id,idempotency_key)
);

create table if not exists public.tracking_dispatches (
  job_key text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  last_attempt_at timestamptz not null,
  next_attempt_at timestamptz,
  last_success_at timestamptz,
  failure_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists tracking_dispatches_company_idx on public.tracking_dispatches(company_id,next_attempt_at);

create table if not exists public.integration_errors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  container_number text,
  source text not null,
  failed_node text not null,
  error_message text not null,
  execution_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists integration_errors_company_idx on public.integration_errors(company_id,created_at desc);

create table if not exists public.access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email citext,
  action text not null,
  target_type text not null,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists access_audit_company_created_idx on public.access_audit_logs(company_id,created_at desc);

create table if not exists public.import_source_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  workbook_name text not null,
  source_fingerprint text not null,
  worksheet_name text not null,
  source_row_number integer not null,
  source_row_key text not null,
  values_json jsonb not null,
  normalized_json jsonb not null,
  link_method text not null,
  conflicts_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_fingerprint,worksheet_name,source_row_number),
  foreign key(company_id,import_id) references public.imports(company_id,id) on delete cascade
);

create table if not exists public.import_reference_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null,
  value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  unique(company_id,category,value)
);

create table if not exists public.official_data_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_fingerprint text not null,
  workbook_name text not null,
  canonical_worksheet text not null,
  import_count integer not null,
  source_row_count integer not null,
  status text not null,
  imported_at timestamptz not null default now(),
  unique(company_id,source_fingerprint)
);

create table if not exists public.sheet_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  operation text not null default 'UPSERT',
  payload_json jsonb not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
  ,foreign key(company_id,import_id) references public.imports(company_id,id) on delete cascade
);
create index if not exists sheet_sync_outbox_pending_idx on public.sheet_sync_outbox(status,created_at) where status = 'PENDING';

create or replace function public.import_before_update()
returns trigger language plpgsql set search_path = public as $$
begin new.sync_version=old.sync_version+1; new.updated_by=coalesce(auth.uid(),new.updated_by); return new; end $$;

create or replace function public.enqueue_import_sheet_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sheet_sync_outbox(import_id,company_id,operation,payload_json)
  values(new.id,new.company_id,'UPSERT',to_jsonb(new));
  return new;
end $$;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.active
      and (m.user_id = auth.uid() or lower(m.user_email::text) = lower(coalesce(auth.jwt()->>'email',''))));
$$;

create or replace function public.has_company_role(p_company_id uuid, p_roles public.company_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.active and m.role = any(p_roles)
      and (m.user_id = auth.uid() or lower(m.user_email::text) = lower(coalesce(auth.jwt()->>'email',''))));
$$;

create or replace function public.guard_membership_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_company uuid; owner_count integer;
begin
  target_company := case when tg_op='DELETE' then old.company_id else new.company_id end;
  if auth.uid() is null or auth.role() = 'service_role' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='INSERT' then
    if new.role='OWNER' and not public.has_company_role(target_company,array['OWNER']::public.company_role[]) then raise exception 'OWNER_REQUIRED'; end if;
    return new;
  end if;
  if tg_op='UPDATE' then
    if (old.role='OWNER' or new.role='OWNER') and not public.has_company_role(target_company,array['OWNER']::public.company_role[]) then raise exception 'OWNER_REQUIRED'; end if;
    if old.role='OWNER' and (new.role<>'OWNER' or not new.active) then
      select count(*) into owner_count from public.company_memberships where company_id=target_company and role='OWNER' and active and id<>old.id;
      if owner_count=0 then raise exception 'LAST_OWNER_REQUIRED'; end if;
    end if;
    return new;
  end if;
  if old.role='OWNER' then
    if not public.has_company_role(target_company,array['OWNER']::public.company_role[]) then raise exception 'OWNER_REQUIRED'; end if;
    select count(*) into owner_count from public.company_memberships where company_id=target_company and role='OWNER' and active and id<>old.id;
    if owner_count=0 then raise exception 'LAST_OWNER_REQUIRED'; end if;
  end if;
  return old;
end $$;
drop trigger if exists company_memberships_owner_guard on public.company_memberships;
create trigger company_memberships_owner_guard before insert or update or delete on public.company_memberships for each row execute function public.guard_membership_owner();
drop trigger if exists on_auth_user_changed on auth.users;
create trigger on_auth_user_changed after insert or update of email,raw_user_meta_data on auth.users for each row execute function public.handle_auth_user();
drop trigger if exists imports_version_guard on public.imports;
create trigger imports_version_guard before update on public.imports for each row execute function public.import_before_update();
drop trigger if exists imports_sheet_outbox on public.imports;
create trigger imports_sheet_outbox after insert or update on public.imports for each row execute function public.enqueue_import_sheet_sync();

do $$ declare t text; begin
  foreach t in array array['companies','user_profiles','company_memberships','identity_verifications','carrier_registry','carrier_aliases','imports','import_details','containers','import_containers','container_positions','container_status_history','import_customs_channel_history','tracking_receipts','tracking_dispatches','integration_errors','access_audit_logs','import_source_rows','import_reference_options','official_data_batches','sheet_sync_outbox'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated using (public.is_company_member(id));
drop policy if exists carrier_registry_select on public.carrier_registry;
create policy carrier_registry_select on public.carrier_registry for select to authenticated using (true);
drop policy if exists carrier_aliases_select on public.carrier_aliases;
create policy carrier_aliases_select on public.carrier_aliases for select to authenticated using (true);
drop policy if exists user_profiles_self on public.user_profiles;
create policy user_profiles_self on public.user_profiles for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists memberships_select on public.company_memberships;
create policy memberships_select on public.company_memberships for select to authenticated using (public.is_company_member(company_id));
drop policy if exists memberships_manage on public.company_memberships;
create policy memberships_manage on public.company_memberships for all to authenticated using (public.has_company_role(company_id,array['OWNER','ADMIN']::public.company_role[])) with check (public.has_company_role(company_id,array['OWNER','ADMIN']::public.company_role[]));

do $$ declare t text; begin
  foreach t in array array['imports','import_details','containers','import_containers','container_positions','container_status_history','import_customs_channel_history','import_source_rows','import_reference_options','official_data_batches'] loop
    execute format('drop policy if exists tenant_select on public.%I',t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_company_member(company_id))',t);
  end loop;
  foreach t in array array['imports','import_details','containers','import_containers','import_customs_channel_history','import_reference_options'] loop
    execute format('drop policy if exists tenant_write on public.%I',t);
    execute format('create policy tenant_write on public.%I for all to authenticated using (public.has_company_role(company_id,array[''OWNER'',''ADMIN'',''OPERATOR'']::public.company_role[])) with check (public.has_company_role(company_id,array[''OWNER'',''ADMIN'',''OPERATOR'']::public.company_role[]))',t);
  end loop;
end $$;

drop policy if exists identity_self_select on public.identity_verifications;
create policy identity_self_select on public.identity_verifications for select to authenticated using (user_id=auth.uid() and public.is_company_member(company_id));
drop policy if exists audit_privileged_select on public.access_audit_logs;
create policy audit_privileged_select on public.access_audit_logs for select to authenticated using (public.has_company_role(company_id,array['OWNER','ADMIN','AUDITOR']::public.company_role[]));
drop policy if exists integration_errors_privileged_select on public.integration_errors;
create policy integration_errors_privileged_select on public.integration_errors for select to authenticated using (public.has_company_role(company_id,array['OWNER','ADMIN','AUDITOR']::public.company_role[]));
drop policy if exists tracking_dispatches_privileged_select on public.tracking_dispatches;
create policy tracking_dispatches_privileged_select on public.tracking_dispatches for select to authenticated using (public.has_company_role(company_id,array['OWNER','ADMIN','AUDITOR']::public.company_role[]));
drop policy if exists tracking_receipts_privileged_select on public.tracking_receipts;
create policy tracking_receipts_privileged_select on public.tracking_receipts for select to authenticated using (public.has_company_role(company_id,array['OWNER','ADMIN','AUDITOR']::public.company_role[]));
drop policy if exists sheet_outbox_privileged_select on public.sheet_sync_outbox;
create policy sheet_outbox_privileged_select on public.sheet_sync_outbox for select to authenticated using (public.has_company_role(company_id,array['OWNER','ADMIN','AUDITOR']::public.company_role[]));

do $$ declare t text; begin
  foreach t in array array['companies','user_profiles','company_memberships','identity_verifications','imports','import_details','containers','tracking_dispatches'] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I',t,t);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t,t);
  end loop;
end $$;

comment on table public.import_source_rows is 'Cópia auditável das linhas da planilha; nunca usar como tabela operacional principal.';
comment on table public.container_positions is 'Somente posições comprovadas. Proibido criar coordenadas fictícias ou interpoladas como fato.';
comment on table public.access_audit_logs is 'Append-only; gravação somente por backend/service_role.';
