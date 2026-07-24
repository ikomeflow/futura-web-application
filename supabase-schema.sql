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

create index if not exists rent_records_user_id_idx on public.rent_records(user_id);
create index if not exists rent_records_due_date_idx on public.rent_records(due_date desc);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
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

alter table public.profiles enable row level security;
alter table public.rent_records enable row level security;

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

revoke all on public.profiles from anon;
revoke all on public.rent_records from anon;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update, delete on public.rent_records to authenticated;

-- After creating your first user in Authentication > Users, make that user
-- the administrator by replacing the email below and running this statement:
--
-- update public.profiles
-- set role = 'admin'
-- where email = 'admin@example.com';
