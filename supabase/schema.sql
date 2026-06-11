-- HEALTHY LIFE TRACKER · sincronização v1 (sem contas)
-- Armazena cada chave do app como um documento JSON por aparelho.
-- Rode este arquivo no SQL Editor do Supabase.

create table if not exists kv_store (
  device_id  text not null,
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (device_id, key)
);
create index if not exists idx_kv_updated on kv_store(device_id, updated_at);

-- Fase 2 (quando contas/Auth entrarem):
--   1. migrar device_id -> user_id uuid references auth.users
--   2. normalizar as chaves em tabelas (sessions, sets, weights, meals...)
--   3. ativar RLS:
-- alter table kv_store enable row level security;
-- create policy "own rows" on kv_store for all
--   using (user_id = auth.uid()) with check (user_id = auth.uid());
