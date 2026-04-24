-- Helper: is the user approved (and therefore allowed to see community content)
create or replace function public.is_approved(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and status = 'approved'
  )
$$;

-- Complaint status enum
do $$ begin
  create type public.complaint_status as enum ('open', 'in_progress', 'closed');
exception when duplicate_object then null; end $$;

-- Complaints
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  title text not null,
  description text not null,
  status public.complaint_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_complaints_status on public.complaints(status);
create index idx_complaints_author on public.complaints(author_id);

alter table public.complaints enable row level security;

-- Approved residents (and admins) can view all complaints
create policy "approved view complaints"
on public.complaints for select to authenticated
using (public.is_approved(auth.uid()) or public.has_role(auth.uid(), 'admin'));

-- Approved residents can create their own complaints
create policy "approved create own complaints"
on public.complaints for insert to authenticated
with check (
  auth.uid() = author_id
  and (public.is_approved(auth.uid()) or public.has_role(auth.uid(), 'admin'))
);

-- Authors can edit their own complaints (but not change author)
create policy "authors update own complaints"
on public.complaints for update to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- Admins can edit any complaint (including closing it)
create policy "admins update any complaint"
on public.complaints for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Admins can delete complaints (residents cannot)
create policy "admins delete complaints"
on public.complaints for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

create trigger trg_complaints_touch
before update on public.complaints
for each row execute function public.touch_updated_at();

-- Announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_announcements_created on public.announcements(created_at desc);

alter table public.announcements enable row level security;

create policy "approved view announcements"
on public.announcements for select to authenticated
using (public.is_approved(auth.uid()) or public.has_role(auth.uid(), 'admin'));

create policy "admins create announcements"
on public.announcements for insert to authenticated
with check (public.has_role(auth.uid(), 'admin') and auth.uid() = author_id);

create policy "admins update announcements"
on public.announcements for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "admins delete announcements"
on public.announcements for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

create trigger trg_announcements_touch
before update on public.announcements
for each row execute function public.touch_updated_at();

-- Push subscriptions for admin notifications
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "users manage own push subs"
on public.push_subscriptions for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "admins view all push subs"
on public.push_subscriptions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Notify admins on new signup (calls edge function via pg_net)
create or replace function public.notify_admins_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Best-effort notification; never block signup if it fails
  begin
    perform net.http_post(
      url := 'https://mxfjpauvhitvnwdzmvud.supabase.co/functions/v1/notify-admins-new-signup',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('user_id', new.id, 'name', new.name, 'status', new.status)
    );
  exception when others then
    -- swallow errors so signup still succeeds
    null;
  end;
  return new;
end;
$$;

create trigger trg_notify_admins_new_signup
after insert on public.profiles
for each row
when (new.status in ('resident_pending', 'external_pending'))
execute function public.notify_admins_new_signup();

-- Enable pg_net for the notification trigger
create extension if not exists pg_net with schema extensions;