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

---

# v1.2 — Treinos por dia da semana + varredura de estabilidade

## Treinos organizados por dia (correção solicitada)
A página Treino deixou de agrupar por Push/Pull/Legs e passou a mostrar
**5 abas: Seg · Ter · Qua · Sex · Sáb**, com o dia de hoje marcado. Cada dia
exibe seu treino real (Segunda/Sexta: peito-ombro-tríceps · Terça/Sábado:
costas-bíceps · Quarta: pernas), a Rosca de Punho aparece apenas no sábado, e
"Adicionar exercício" agora adiciona ao dia selecionado. O treino ativo
("Iniciar Treino") usa a lista do dia. Exercícios já salvos continuam
funcionando (aparecem em todos os dias do seu grupo até serem editados).

## Bugs encontrados e corrigidos na varredura
1. **Conquistas podiam ser perdidas** se a verificação rodasse antes do cache
   hidratar (gravava só as novas por cima das antigas). Agora a lista completa
   é lida do banco e gravada de forma absoluta.
2. **Sincronização era por aparelho, não por usuário**: cada navegador gerava
   um ID próprio e os dados não se encontravam entre celular e PC. Agora todos
   os aparelhos usam o namespace fixo `felps-principal` — sincronização real
   entre dispositivos (vira o user_id do Auth na Fase 2).
3. **Erros de sync eram opacos**: agora Perfil → Sincronização mostra a causa,
   incluindo a dica específica quando a tabela `kv_store` não existe.

## Validação executada
Testes de lógica: Epley (20×10 → 26,7 ✓), Brzycki, mapeamento dos 5 dias =
WEEK_PLAN ✓, filtro por dia (Sáb inclui rosca de punho, Ter não ✓),
compatibilidade com exercícios sem o campo `days` ✓. TypeScript sem erros e
build completo (cliente + SSR) passando.

## Se a tabela kv_store estiver vazia no Supabase
1. **Ela não aparece na lista de tabelas?** O SQL ainda não foi executado:
   SQL Editor → New query → cole o conteúdo de `supabase/schema.sql` → Run.
2. **Existe mas está sem linhas?** Normal até o app atualizado rodar: as
   linhas só aparecem depois que você abrir o app (com este código publicado)
   e ele fizer o primeiro push. Registre algo, aguarde ~5 s e recarregue o
   Table Editor.
