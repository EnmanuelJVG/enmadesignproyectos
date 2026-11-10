-- ENMA DESIGN · Studio Manager
-- Ejecutar completo en Supabase > SQL Editor.
-- Tablas privadas por usuario autenticado (RLS). No crea usuarios automáticamente.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  whatsapp text,
  city text,
  instagram text,
  website text,
  description text,
  status text not null default 'Activo' check (status in ('Activo','Archivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  website text,
  instagram text,
  facebook text,
  tiktok text,
  colors text,
  typography text,
  description text,
  logo_path text,
  brand_guide_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  category text,
  status text not null default 'Solicitud recibida',
  priority text not null default 'Media' check (priority in ('Alta','Media','Baja')),
  start_date date,
  due_date date,
  agreed_usd numeric(12,2) not null default 0 check (agreed_usd >= 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'Media' check (priority in ('Alta','Media','Baja')),
  status text not null default 'Pendiente' check (status in ('Pendiente','En proceso','Completada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  description text not null,
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  original_amount numeric(14,2),
  original_currency text not null default 'USD' check (original_currency in ('USD','VES')),
  exchange_rate numeric(14,4),
  paid_at date not null default current_date,
  status text not null default 'Recibido' check (status in ('Recibido','Pendiente')),
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  category text,
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  original_amount numeric(14,2),
  original_currency text not null default 'USD' check (original_currency in ('USD','VES')),
  exchange_rate numeric(14,4),
  spent_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  event_type text not null default 'General',
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activar RLS y crear políticas de aislamiento de datos por propietario.
do $$
declare t text;
begin
  foreach t in array array['clients','brands','projects','tasks','payments','expenses','calendar_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format(
      'create policy "Users manage own %I" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create index if not exists clients_user_idx on public.clients(user_id);
create index if not exists brands_user_idx on public.brands(user_id);
create index if not exists projects_user_due_idx on public.projects(user_id, due_date);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists payments_user_date_idx on public.payments(user_id, paid_at);
create index if not exists expenses_user_date_idx on public.expenses(user_id, spent_at);
create index if not exists calendar_user_date_idx on public.calendar_events(user_id, due_date);

-- Almacenamiento privado para recursos propios y de marcas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'enma-files', 'enma-files', false, 52428800,
  array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf','application/zip']
)
on conflict (id) do nothing;

drop policy if exists "ENMA read own files" on storage.objects;
create policy "ENMA read own files" on storage.objects
for select to authenticated
using (bucket_id = 'enma-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ENMA upload own files" on storage.objects;
create policy "ENMA upload own files" on storage.objects
for insert to authenticated
with check (bucket_id = 'enma-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ENMA update own files" on storage.objects;
create policy "ENMA update own files" on storage.objects
for update to authenticated
using (bucket_id = 'enma-files' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'enma-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ENMA delete own files" on storage.objects;
create policy "ENMA delete own files" on storage.objects
for delete to authenticated
using (bucket_id = 'enma-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Crear la cuenta del propietario manualmente en Supabase > Authentication > Users.
