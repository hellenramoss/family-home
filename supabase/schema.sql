-- Family Home shared sync schema for Supabase
-- Run this in the Supabase SQL editor after creating the project.

create schema if not exists private;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (family_id,user_id)
);

create table if not exists public.family_documents (
  family_id uuid not null references public.families(id) on delete cascade,
  doc_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (family_id,doc_key)
);

create index if not exists family_members_user_id_idx on public.family_members(user_id);
create index if not exists family_documents_updated_at_idx on public.family_documents(family_id,updated_at desc);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_documents enable row level security;

create or replace function private.user_family_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = (select auth.uid())
$$;

revoke all on function private.user_family_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.user_family_ids() to authenticated;

revoke all on table public.families from anon, authenticated;
revoke all on table public.family_members from anon, authenticated;
revoke all on table public.family_documents from anon, authenticated;
grant select on table public.families to authenticated;
grant select on table public.family_members to authenticated;
grant select,insert,update,delete on table public.family_documents to authenticated;

drop policy if exists "family members read family" on public.families;
create policy "family members read family"
on public.families for select to authenticated
using (id in (select private.user_family_ids()));

drop policy if exists "family members read members" on public.family_members;
create policy "family members read members"
on public.family_members for select to authenticated
using (family_id in (select private.user_family_ids()));

drop policy if exists "family members read documents" on public.family_documents;
create policy "family members read documents"
on public.family_documents for select to authenticated
using (family_id in (select private.user_family_ids()));

drop policy if exists "family members create documents" on public.family_documents;
create policy "family members create documents"
on public.family_documents for insert to authenticated
with check (
  family_id in (select private.user_family_ids())
  and updated_by = (select auth.uid())
);

drop policy if exists "family members update documents" on public.family_documents;
create policy "family members update documents"
on public.family_documents for update to authenticated
using (family_id in (select private.user_family_ids()))
with check (
  family_id in (select private.user_family_ids())
  and updated_by = (select auth.uid())
);

drop policy if exists "family members delete documents" on public.family_documents;
create policy "family members delete documents"
on public.family_documents for delete to authenticated
using (family_id in (select private.user_family_ids()));

create or replace function public.create_family(p_name text,p_display_name text default '')
returns table(family_id uuid,invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := gen_random_uuid();
  v_code text := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.families(id,name,invite_code,owner_id)
  values(v_family,coalesce(nullif(trim(p_name),''),'Minha família'),v_code,v_user);
  insert into public.family_members(family_id,user_id,display_name,role)
  values(v_family,v_user,coalesce(trim(p_display_name),''),'owner');
  return query select v_family,v_code;
end
$$;

create or replace function public.join_family(p_invite_code text,p_display_name text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select f.id into v_family
  from public.families f
  where f.invite_code = upper(trim(p_invite_code));
  if v_family is null then raise exception 'Invalid family code'; end if;
  insert into public.family_members(family_id,user_id,display_name,role)
  values(v_family,v_user,coalesce(trim(p_display_name),''),'member')
  on conflict(family_id,user_id) do update set display_name=excluded.display_name;
  return v_family;
end
$$;

revoke all on function public.create_family(text,text) from public,anon;
revoke all on function public.join_family(text,text) from public,anon;
grant execute on function public.create_family(text,text) to authenticated;
grant execute on function public.join_family(text,text) to authenticated;

-- Enable Realtime for shared document changes once. Safe to rerun.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='family_documents'
  ) then
    alter publication supabase_realtime add table public.family_documents;
  end if;
end $$;