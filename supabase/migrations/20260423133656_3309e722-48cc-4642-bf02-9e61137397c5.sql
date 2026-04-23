
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'resident');
create type public.user_status as enum ('resident_pending', 'external_pending', 'approved', 'rejected');

-- ============ PLOTS ============
create table public.plots (
  id uuid primary key default gen_random_uuid(),
  plot_number text not null unique,
  owner_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plots enable row level security;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  plot_id uuid references public.plots(id) on delete set null,
  status public.user_status not null default 'external_pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- ============ DATASET ENTRIES (uploaded Excel) ============
create table public.dataset_entries (
  id uuid primary key default gen_random_uuid(),
  plot_number text not null,
  owner_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
create index on public.dataset_entries (lower(email));
create index on public.dataset_entries (phone);
alter table public.dataset_entries enable row level security;

-- ============ APPROVALS ============
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.user_status not null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz default now(),
  notes text
);
alter table public.approvals enable row level security;

-- ============ SETTINGS ============
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
insert into public.settings (key, value) values ('admin_limit', '7'::jsonb);

-- ============ AUDIT LOGS ============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;

-- ============ HAS ROLE FUNCTION ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ============ UPDATED_AT TRIGGER ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger plots_touch before update on public.plots
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============ SIGNUP HANDLER ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_email text;
  v_match record;
  v_status public.user_status;
  v_plot_id uuid;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
  v_phone := new.raw_user_meta_data ->> 'phone';
  v_email := new.email;

  -- Try to match against uploaded dataset
  select * into v_match
  from public.dataset_entries
  where (v_email is not null and lower(email) = lower(v_email))
     or (v_phone is not null and phone = v_phone)
  limit 1;

  if v_match.id is not null then
    v_status := 'resident_pending';
    -- ensure plot exists
    insert into public.plots (plot_number, owner_name)
    values (v_match.plot_number, v_match.owner_name)
    on conflict (plot_number) do update set owner_name = coalesce(public.plots.owner_name, excluded.owner_name)
    returning id into v_plot_id;
    if v_plot_id is null then
      select id into v_plot_id from public.plots where plot_number = v_match.plot_number;
    end if;
  else
    v_status := 'external_pending';
  end if;

  insert into public.profiles (id, name, email, phone, plot_id, status)
  values (new.id, v_name, v_email, v_phone, v_plot_id, v_status);

  insert into public.approvals (user_id, status) values (new.id, v_status);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ BOOTSTRAP FIRST ADMIN ============
create or replace function public.bootstrap_first_admin(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count int;
begin
  select count(*) into v_admin_count from public.user_roles where role = 'admin';
  if v_admin_count = 0 then
    insert into public.user_roles (user_id, role) values (_user_id, 'admin')
      on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;

-- ============ APPROVE USER FUNCTION ============
create or replace function public.approve_user(_user_id uuid, _approve boolean, _notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_status public.user_status;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can approve users';
  end if;

  v_new_status := case when _approve then 'approved'::public.user_status else 'rejected'::public.user_status end;

  update public.profiles set status = v_new_status where id = _user_id;
  insert into public.approvals (user_id, status, reviewed_by, notes)
  values (_user_id, v_new_status, auth.uid(), _notes);

  -- Auto-grant resident role on approval
  if _approve then
    insert into public.user_roles (user_id, role) values (_user_id, 'resident')
      on conflict do nothing;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'approve_user', 'profiles', _user_id, jsonb_build_object('approved', _approve, 'notes', _notes));
end;
$$;

-- ============ ASSIGN/REMOVE ADMIN FUNCTION ============
create or replace function public.set_admin_role(_user_id uuid, _make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count int;
  v_limit int;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can manage admin roles';
  end if;

  if _make_admin then
    select (value::text)::int into v_limit from public.settings where key = 'admin_limit';
    select count(*) into v_admin_count from public.user_roles where role = 'admin';
    if v_admin_count >= coalesce(v_limit, 7) then
      raise exception 'Admin limit reached (%).', v_limit;
    end if;
    insert into public.user_roles (user_id, role) values (_user_id, 'admin')
      on conflict do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = 'admin';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), case when _make_admin then 'grant_admin' else 'revoke_admin' end, 'user_roles', _user_id, '{}'::jsonb);
end;
$$;

-- ============ RLS POLICIES ============

-- profiles
create policy "users view own profile" on public.profiles for select
  to authenticated using (auth.uid() = id);
create policy "admins view all profiles" on public.profiles for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins update profiles" on public.profiles for update
  to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "users update own profile" on public.profiles for update
  to authenticated using (auth.uid() = id);

-- user_roles
create policy "users view own roles" on public.user_roles for select
  to authenticated using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));
-- Mutations only via SECURITY DEFINER functions; no direct insert/update/delete policy.

-- plots
create policy "approved users view plots" on public.plots for select
  to authenticated using (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
  );
create policy "admins manage plots" on public.plots for all
  to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- dataset_entries
create policy "admins manage dataset" on public.dataset_entries for all
  to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- approvals
create policy "users view own approvals" on public.approvals for select
  to authenticated using (auth.uid() = user_id);
create policy "admins view all approvals" on public.approvals for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));

-- settings
create policy "anyone read settings" on public.settings for select
  to authenticated using (true);
create policy "admins manage settings" on public.settings for all
  to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- audit_logs
create policy "admins view audit logs" on public.audit_logs for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));
