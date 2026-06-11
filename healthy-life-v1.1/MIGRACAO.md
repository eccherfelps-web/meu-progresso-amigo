# Healthy Life Tracker · v1.1 — Migração e novos recursos

## O que mudou (sem quebrar nada)

**Armazenamento permanente (IndexedDB).** O app saiu do `localStorage` (limite
de ~5 MB, fácil de perder) para o IndexedDB via Dexie. **Seus dados migram
sozinhos na primeira abertura** — os valores antigos continuam no localStorage
como cópia de segurança. As telas não mudaram: a API `useLocalStorage` foi
mantida, só o motor por baixo é novo (`src/lib/hlt/db.ts` + `storage.ts`).

**Sincronização em nuvem (opcional).** Com um projeto Supabase configurado
(`supabase/schema.sql` + variáveis no `.env`), cada alteração sobe
automaticamente (push de chaves "dirty", debounce de 4 s) e desce no boot, a
cada 3 min e ao voltar a conexão. Conflitos: vence o `updated_at` mais
recente. Sem `.env`, o app segue 100% offline como antes. Status visível na
sidebar e em Perfil → Sincronização.

**Novos recursos**
- Busca de alimentos **online (Open Food Facts)** no diálogo de adicionar
  alimento — qualquer produto, além da tabela local.
- **1RM estimado (Epley)** no gráfico de progressão de carga do Analytics
  (20 kg × 10 reps → 26,7 kg).
- **Sistema de conquistas** (8 medalhas: primeiro treino, streaks 7/30,
  25/100 treinos, primeiro PR, meta 62 kg, supino 100 kg) com toast ao
  desbloquear e galeria no Analytics. Sincroniza entre aparelhos.
- **Fotos de evolução** na página Peso: frontal/lateral/traseira, comprimidas
  no aparelho, galeria por data e comparação lado a lado. (Ficam locais por
  enquanto; upload para bucket entra na Fase 2.)

## Como ativar a nuvem (5 min)
1. Crie um projeto grátis em supabase.com.
2. SQL Editor → cole e execute `supabase/schema.sql`.
3. No Lovable (Settings → Environment) ou no `.env` local, defina
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Abra o app: o ícone de nuvem na sidebar deve mostrar "nuvem ok".

## Próximas fases
- **Fase 2 — contas:** Supabase Auth, RLS, normalizar o kv_store em tabelas
  relacionais, upload das fotos para Storage.
- **Fase 3 — Android/iOS:** o app é TanStack Start (SSR); para Capacitor é
  preciso gerar build estático (prerender) ou extrair o SPA. Caminho
  recomendado: publicar como PWA primeiro (já funciona offline) e empacotar
  com Capacitor na sequência.
- **Fase 4 — refino:** metas semanais, relatórios automáticos, previsão de
  evolução (peso estimado em 30/90 dias por regressão sobre o histórico).
