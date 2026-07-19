-- ============================================================
-- TABLA: academic_snapshots
-- Guarda una copia sincronizada del estado académico del usuario.
-- Cada usuario autenticado puede acceder únicamente a su propia fila.
-- ============================================================

create table if not exists public.academic_snapshots (
    user_id uuid primary key
        references auth.users(id)
        on delete cascade,

    academic_data jsonb not null
        default '{}'::jsonb,

    schema_version integer not null
        default 1
        check (schema_version >= 1),

    created_at timestamptz not null
        default now(),

    updated_at timestamptz not null
        default now()
);

comment on table public.academic_snapshots is
    'Estado académico sincronizado de cada usuario del pensum interactivo.';

comment on column public.academic_snapshots.user_id is
    'Identificador del usuario autenticado en Supabase Auth.';

comment on column public.academic_snapshots.academic_data is
    'Información del pensum, materias, notas, horario, repitencias e historial académico.';

comment on column public.academic_snapshots.schema_version is
    'Versión de la estructura almacenada dentro de academic_data.';


-- ============================================================
-- ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- ============================================================

create or replace function public.set_academic_snapshot_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();

    return new;
end;
$$;

drop trigger if exists
    set_academic_snapshot_updated_at
    on public.academic_snapshots;

create trigger set_academic_snapshot_updated_at
before update on public.academic_snapshots
for each row
execute function public.set_academic_snapshot_updated_at();


-- ============================================================
-- SEGURIDAD RLS
-- ============================================================

alter table public.academic_snapshots
enable row level security;


-- Los visitantes sin iniciar sesión no pueden acceder a la tabla.

revoke all
on table public.academic_snapshots
from anon;


-- Los usuarios autenticados pueden ejecutar estas operaciones.
-- Las políticas posteriores limitan cada operación a su propia fila.

grant select, insert, update, delete
on table public.academic_snapshots
to authenticated;


-- ============================================================
-- POLÍTICA DE LECTURA
-- ============================================================

drop policy if exists
    "Users can read their academic snapshot"
    on public.academic_snapshots;

create policy
    "Users can read their academic snapshot"
on public.academic_snapshots
for select
to authenticated
using (
    (select auth.uid()) = user_id
);


-- ============================================================
-- POLÍTICA DE CREACIÓN
-- ============================================================

drop policy if exists
    "Users can create their academic snapshot"
    on public.academic_snapshots;

create policy
    "Users can create their academic snapshot"
on public.academic_snapshots
for insert
to authenticated
with check (
    (select auth.uid()) = user_id
);


-- ============================================================
-- POLÍTICA DE ACTUALIZACIÓN
-- ============================================================

drop policy if exists
    "Users can update their academic snapshot"
    on public.academic_snapshots;

create policy
    "Users can update their academic snapshot"
on public.academic_snapshots
for update
to authenticated
using (
    (select auth.uid()) = user_id
)
with check (
    (select auth.uid()) = user_id
);


-- ============================================================
-- POLÍTICA DE ELIMINACIÓN
-- ============================================================

drop policy if exists
    "Users can delete their academic snapshot"
    on public.academic_snapshots;

create policy
    "Users can delete their academic snapshot"
on public.academic_snapshots
for delete
to authenticated
using (
    (select auth.uid()) = user_id
);