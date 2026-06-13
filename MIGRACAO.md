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

---

# v1.3 — Correções críticas + recursos de análise

**1. Perfil (bug crítico corrigido).** O formulário era preenchido com os
valores padrão ANTES dos dados salvos carregarem do banco e nunca era
re-semeado — a página exibia os padrões e, ao salvar, sobrescrevia os dados
reais. Agora o formulário é semeado após a hidratação e o botão Salvar fica
bloqueado até os dados carregarem. Nutrição e Dashboard recalculam na hora
(eles derivam tudo do perfil a cada render — o problema era só a persistência).

**2. Open Food Facts.** A busca agora usa dois endpoints em cadeia (o novo
Search-a-licious e o legado), com timeout de 9 s, tratamento do limite de
~10 buscas/min e mensagens de erro específicas (sem conexão / lento / limite).

**3. Pular Exercício (novo).** No treino ativo, o botão "Pular exercício"
move o exercício atual para o fim da fila — séries e cargas registradas são
preservadas (os logs agora são presos ao exercício, não à posição). De
quebra, corrigiu-se outra corrida: os logs nasciam dos exercícios padrão
antes dos personalizados carregarem.

**4. Equilíbrio Muscular (novo).** Score 0–100% com barra colorida, 4 pares
antagonistas (Peito×Costas, Quadríceps×Posterior, Bíceps×Tríceps,
Empurrar×Puxar) com razão ideal e sugestões automáticas de ajuste.

**5. Volume por Músculo (novo).** 10 músculos (Peito, Costas, Ombros, Bíceps,
Tríceps, Antebraço, Quadríceps, Posterior, Panturrilha, Abdômen) com séries
semanais, volume total e % do treino, em barras. O gráfico de volume semanal
ganhou os percentuais por grupo (Push/Pull/Legs).

**6. Peso × Calorias modernizado.** Gradientes, linhas suavizadas, média
móvel de 7 dias, chip de tendência (kg/semana por regressão), linha de meta
calórica e tooltip/legenda refinados — legível no celular e no desktop.

**Validação:** classificador muscular 21/21 casos + todos os 20 exercícios do
plano padrão classificados; percentuais somando 100%; desequilíbrio 4:1
detectado com sugestão correta; TypeScript limpo; build completo passando.

---

# v1.4 — Nutrição robusta, cadastro completo e semana flexível

**3. Busca nutricional (estratégia híbrida).** Em vez de depender de uma API
instável: (a) tabela **TACO embutida com 68 alimentos brasileiros** — busca
instantânea e offline, é a primeira camada; (b) **cache local de 24 h** das
buscas online (até 80 consultas guardadas — repetir uma busca não vai à
internet); (c) Open Food Facts continua como complemento, com os dois
endpoints e mensagens de erro específicas. Feedback visual: spinner durante a
busca, aviso "⚡ resultado do cache" e mensagem clara quando nada é encontrado.

**4. Adicionar exercício (reestruturado).** O prompt() virou um formulário
completo: nome com **busca inteligente no catálogo** (38 exercícios com
auto-preenchimento de grupo/músculo/equipamento), chips de **recentes**,
músculo principal* e secundário, séries*, repetições*, carga com **kg/lb**
(converte), descanso*, tipo (composto/isolado), equipamento e observações.
Validações bloqueiam séries/reps vazias, carga inválida e músculo ausente.

**5. Edição completa.** O lápis agora abre o mesmo formulário com tudo
editável. Como gráficos e estatísticas derivam dos dados reativamente, tudo
atualiza na hora, sem recarregar.

**6. Exclusão com Desfazer.** Ao excluir: toast "removido — Desfazer?" por
6 segundos restaura o exercício intacto.

**7. Semana flexível (drag-and-drop).** Botão "Reorganizar semana" abre os 7
dias: arraste um sobre o outro (ou toque em dois) para trocá-los — ex.: Leg
na terça e Pull na quarta. Os exercícios seguem o grupo automaticamente
(incluindo os fixados num dia específico, via "ocorrência do grupo"), e
histórico/estatísticas ficam intactos. Dashboard e treino ativo respeitam o
cronograma novo. "Restaurar padrão" volta ao PPL original.

**8–9. Gráfico de volume e análises.** Bucketização semanal corrigida (antes
misturava meses), barras empilhadas das últimas 8 semanas com **tooltip
detalhado** (kg + % por grupo + total), chip de **comparação vs semana
anterior** (total e por grupo), destaque 🏆 para o grupo mais treinado e ⚠
para negligenciados (<15%). No volume por músculo, cada músculo ganhou o
indicador da **faixa recomendada de 10–20 séries/semana** (amarelo abaixo,
verde na faixa, azul acima).

**Validação:** cronograma com troca Ter⇄Qua testado (exemplo da spec), slot
do 2º dia de pull seguindo a reorganização, catálogo e TACO com macros
coerentes, TypeScript limpo, build completo passando.

---

# v1.4.1 — Varredura completa pré-deploy

Auditoria executada antes da publicação:
- **ESLint do projeto**: 536 apontamentos de formatação corrigidos automaticamente → 0 problemas.
- **Teste da camada de dados com IndexedDB simulado (5/5)**: migração do
  localStorage com dirty=1; salvar→reler retorna o valor novo (cenário do bug
  do perfil); fila de sync correta com cache excluído e markClean; LWW não
  deixa timestamp antigo da nuvem vencer; reset definitivo sem reimportação.
- **Correções da revisão manual**: (a) trocar o grupo no formulário agora
  recalcula as opções de "dia do grupo" e um slot inválido nunca esconde o
  exercício (clamp duplo, no efeito e no salvar); (b) conquistas passam a ser
  verificadas também ao finalizar o treino, com toast imediato; (c) a dica de
  gordura no Analytics usa o limite configurado no perfil, não 50 g fixo;
  (d) removido import duplicado.
- TypeScript: 0 erros · Build completo (cliente + SSR): ok · Lógica de
  cronograma/slots revalidada após o autofix.

---

# v1.5 — Treino ativo refinado, histórico completo e busca em português

**1. Editar séries concluídas.** Cada série registrada ganhou um lápis: toca,
edita peso/reps inline, OK — volume e recordes são **recalculados do zero** a
partir de todos os logs (os PRs deixaram de ser acumulados série a série,
eliminando duplicatas e garantindo consistência após edições).

**2. Exercício Anterior.** Botão "← Anterior" ao lado de Pular/Próximo. Como
as séries são presas ao exercício (não à posição), navegar para trás e para
frente preserva tudo que já foi registrado.

**3–4. Histórico de treinos.** Nova seção na página Treino mostrando o
**último treino de cada dia da semana** (Seg→Dom): dia, tipo com badge
colorida, data, duração, volume e troféu quando houve PR. Clicar abre um
**modal amplo e responsivo** com: estatísticas da sessão (duração, volume
total, séries, melhor 1RM por Epley), recordes atingidos, e cada exercício
com volume próprio e a grade de séries (#, kg × reps). Tudo derivado das
sessões já salvas — zero duplicação de dados.

**5. Busca de alimentos em português.** A busca agora prioriza o catálogo
**br.openfoodfacts.org** (nomes em pt-BR), usa o campo `product_name_pt`
quando existe, filtra por idioma no endpoint novo e aplica um filtro
heurístico de espanhol. Correção importante sobre a primeira tentativa:
"arroz" e "para" são palavras portuguesas e estavam derrubando produtos
brasileiros — o filtro agora usa só marcadores exclusivos do espanhol
(pollo, leche, queso, sin, del…), validado com 10 casos de teste.

**Validação:** ESLint 0 · TypeScript 0 · build completo ok · filtro de idioma
5 PT mantidos / 5 ES removidos.
