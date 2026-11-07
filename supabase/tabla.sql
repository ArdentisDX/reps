-- REPS · tabla de sincronización (pegar en Supabase → SQL Editor → Run)
-- Una fila por clave de datos de REPS por usuario. RLS: cada quien SOLO ve
-- y escribe sus filas (por eso la llave pública puede ir en la app).

create table if not exists public.reps_datos (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave       text not null,
  valor       text,
  hash        text,
  schema      int  not null default 6,
  actualizado timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.reps_datos enable row level security;

create policy "reps: leer lo mío"      on public.reps_datos for select to authenticated using ((select auth.uid()) = user_id);
create policy "reps: crear lo mío"     on public.reps_datos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reps: cambiar lo mío"   on public.reps_datos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reps: borrar lo mío"    on public.reps_datos for delete to authenticated using ((select auth.uid()) = user_id);
