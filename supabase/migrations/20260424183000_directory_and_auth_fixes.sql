-- Let approved residents view dataset directory contacts
create policy "approved users view dataset entries"
on public.dataset_entries
for select
to authenticated
using (public.is_approved(auth.uid()) or public.has_role(auth.uid(), 'admin'));

-- Signup handler: also match / map plot by provided plot number
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
  v_plot_number text;
  v_match record;
  v_status public.user_status;
  v_plot_id uuid;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  v_email := new.email;
  v_plot_number := nullif(trim(coalesce(new.raw_user_meta_data ->> 'plot_number', '')), '');

  -- Try to match against uploaded dataset
  select * into v_match
  from public.dataset_entries
  where (v_email is not null and lower(email) = lower(v_email))
     or (v_phone is not null and phone = v_phone)
     or (v_plot_number is not null and lower(plot_number) = lower(v_plot_number))
  limit 1;

  if v_match.id is not null then
    v_status := 'resident_pending';
    v_plot_number := coalesce(v_match.plot_number, v_plot_number);
  else
    v_status := 'external_pending';
  end if;

  if v_plot_number is not null then
    insert into public.plots (plot_number, owner_name)
    values (v_plot_number, coalesce(v_match.owner_name, v_name))
    on conflict (plot_number) do update set owner_name = coalesce(public.plots.owner_name, excluded.owner_name)
    returning id into v_plot_id;

    if v_plot_id is null then
      select id into v_plot_id from public.plots where plot_number = v_plot_number;
    end if;
  end if;

  insert into public.profiles (id, name, email, phone, plot_id, status)
  values (new.id, v_name, v_email, v_phone, v_plot_id, v_status);

  insert into public.approvals (user_id, status) values (new.id, v_status);

  return new;
end;
$$;

-- Admin hard delete user to prevent future sign-ins
create or replace function public.admin_delete_user(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can delete users';
  end if;

  delete from auth.users where id = _user_id;
end;
$$;
