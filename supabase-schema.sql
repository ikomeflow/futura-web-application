-- Futura Group secure portal schema
-- Run this entire file in the Supabase SQL Editor for a new project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_name text not null,
  property text not null,
  amount numeric(14, 0) not null check (amount >= 0),
  due_date date not null,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  property_type text not null default 'Residential property',
  address text not null default '',
  monthly_target numeric(14, 0) not null default 0 check (monthly_target >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rent_reminders (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.rent_records(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('upcoming', 'overdue')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed')),
  scheduled_for date not null default current_date,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (record_id, reminder_type)
);

create index if not exists rent_records_user_id_idx on public.rent_records(user_id);
create index if not exists rent_records_due_date_idx on public.rent_records(due_date desc);
create index if not exists rent_reminders_status_idx on public.rent_reminders(status, scheduled_for);

insert into public.properties (name, property_type)
values
  ('Executive Hotel', 'Hotel property'),
  ('Bakweri Town House', 'Town house'),
  ('Orange Entrance Likomba Tiko', 'Residential building'),
  ('Bimbia Bonabile', 'Residential building')
on conflict (name) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists rent_records_set_updated_at on public.rent_records;
create trigger rent_records_set_updated_at
before update on public.rent_records
for each row execute function public.set_updated_at();

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := (select auth.uid());
  requester_role text;
  administrator_count integer;
begin
  if requester_id is null then
    raise exception 'You must be signed in to delete an account.';
  end if;

  select role into requester_role
  from public.profiles
  where id = requester_id;

  if requester_role = 'admin' then
    select count(*) into administrator_count
    from public.profiles
    where role = 'admin';

    if administrator_count <= 1 then
      raise exception 'The final administrator account cannot be deleted.';
    end if;
  end if;

  delete from auth.users where id = requester_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if target_user_id is null then
    raise exception 'A customer account is required.';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'Use Account settings to delete your own account.';
  end if;

  select role into target_role
  from public.profiles
  where id = target_user_id;

  if target_role is null then
    raise exception 'The customer account was not found.';
  end if;

  if target_role = 'admin' then
    raise exception 'Administrator accounts cannot be deleted from customer management.';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

create or replace function public.refresh_rent_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  delete from public.rent_reminders reminder
  using public.rent_records record
  where reminder.record_id = record.id
    and reminder.status = 'pending'
    and record.paid_date is not null;

  insert into public.rent_reminders (record_id, user_id, reminder_type, scheduled_for)
  select record.id, record.user_id, 'overdue', current_date
  from public.rent_records record
  where record.paid_date is null
    and record.due_date < current_date
  on conflict (record_id, reminder_type) do nothing;

  insert into public.rent_reminders (record_id, user_id, reminder_type, scheduled_for)
  select record.id, record.user_id, 'upcoming', current_date
  from public.rent_records record
  where record.paid_date is null
    and record.due_date between current_date and current_date + 5
  on conflict (record_id, reminder_type) do nothing;
end;
$$;

revoke all on function public.refresh_rent_reminders() from public;
grant execute on function public.refresh_rent_reminders() to authenticated;

alter table public.profiles enable row level security;
alter table public.rent_records enable row level security;
alter table public.properties enable row level security;
alter table public.rent_reminders enable row level security;

drop policy if exists "Users read own profile and admins read all profiles" on public.profiles;
create policy "Users read own profile and admins read all profiles"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "Users update own basic profile and admins update profiles" on public.profiles;
create policy "Users update own basic profile and admins update profiles"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id or (select public.is_admin()))
with check ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "Customers read own rent records and admins read all" on public.rent_records;
create policy "Customers read own rent records and admins read all"
on public.rent_records
for select
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Admins create rent records" on public.rent_records;
create policy "Admins create rent records"
on public.rent_records
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Admins update rent records" on public.rent_records;
create policy "Admins update rent records"
on public.rent_records
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins delete rent records" on public.rent_records;
create policy "Admins delete rent records"
on public.rent_records
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Authenticated users read properties" on public.properties;
create policy "Authenticated users read properties"
on public.properties
for select
to authenticated
using (true);

drop policy if exists "Admins create properties" on public.properties;
create policy "Admins create properties"
on public.properties
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Admins update properties" on public.properties;
create policy "Admins update properties"
on public.properties
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins delete properties" on public.properties;
create policy "Admins delete properties"
on public.properties
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins manage rent reminders" on public.rent_reminders;
create policy "Admins manage rent reminders"
on public.rent_reminders
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on public.profiles from anon;
revoke all on public.rent_records from anon;
revoke all on public.properties from anon;
revoke all on public.rent_reminders from anon;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update, delete on public.rent_records to authenticated;
grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.rent_reminders to authenticated;

-- After creating your first user in Authentication > Users, make that user
-- the administrator by replacing the email below and running this statement:
--
-- update public.profiles
-- set role = 'admin'
-- where email = 'admin@example.com';
