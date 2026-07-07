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

---

# v1.6 — Treino ativo repaginado (mobile first)

**Hierarquia visual nova.** A tela foi reordenada para o essencial: exercício
atual no topo (nome grande + meta + último desempenho), temporizador logo
abaixo, série atual com inputs grandes (h-12, texto centralizado) e o botão
gigante "✅ Concluir série" (h-14). Informações secundárias viraram chips
compactos. Largura max-md no celular, sem rolagem para as ações principais.

**Temporizador protagonista.** Ao concluir a série, o timer assume o centro:
anel de progresso SVG animado, contagem em 4xl, destaque com ring colorido,
pulso nos 5 segundos finais e verde ao terminar. Controles rápidos: pausar/
continuar, reiniciar, +15s, +30s e pular. A contagem agora é por **timestamp**
(endsAt), então continua exata mesmo com a aba em segundo plano — o modelo
antigo de decremento por intervalo atrasava quando o navegador acelerava.

**Alerta sonoro.** Novo sistema de som sintetizado via Web Audio (sem
arquivos): 3 sons (Beep clássico, Sino, Digital), volume ajustável e botão
"Testar som" — tudo em Perfil → "Alerta de fim do descanso" (liga/desliga).
O áudio é destravado no toque em "Concluir série" (regra dos navegadores),
toca em segundo plano, vibra no celular e troca o título da aba por
"✅ Descanso concluído!". Preferências salvas no perfil (sincronizam).

**Botões principais.** Concluir Série (h-14), Anterior/Pular/Próximo (h-12,
três colunas, polegar-friendly) e Finalizar Treino sempre acessível no fim —
com destaque quando é o último exercício.

---

# v1.6.1 — Correção do som ao fim do descanso

**Sintoma:** o som tocava no "Testar som" (Perfil) mas não ao terminar o
temporizador. **Causas (três, combinadas):**

1. **AudioContext suspenso na hora de tocar.** Durante a contagem, o navegador
   re-suspende o contexto; `playAlert` chamava `resume()` e disparava os tons
   no mesmo instante — antes do contexto voltar, então saíam mudos. Agora os
   tons só são agendados **dentro do `.then()` do resume**. (O "Testar som"
   funcionava porque tocava no mesmo gesto que mantinha o contexto ativo.)
2. **Closure congelado no timer.** O `setInterval` capturava o `profile` e o
   `rest` do render em que foi criado; quando o tempo zerava, lia preferências
   antigas. O efeito virou um intervalo único de vida longa que lê tudo de
   `refs` sempre atuais.
3. **Unlock frágil.** O `unlockAudio` agora também toca um buffer silencioso no
   gesto de "Concluir série", aquecendo o contexto para tocar em segundo plano.

**Validação:** teste com AudioContext simulado iniciando suspenso — resume()
chamado e tons emitidos (4/4 cenários). ESLint 0, TypeScript 0, build ok.

---

# v1.7 — Reordenar exercícios, múltiplos grupos por dia e ajustes

**1. Reordenar exercícios.** Cada exercício no plano ganhou botões mover ↑/↓ e
arrastar-e-soltar (alça de grip). A ordem é salva por exercício (campo `order`)
e respeitada no plano e no treino ativo. Sem excluir/recadastrar.

**2. Botão "Revisar" explicado.** Virou "Revisar ✓" com tooltip e uma legenda
fixa quando é o último exercício: abre o resumo do treino (volume, recordes,
duração) para conferência antes de salvar — enquanto "Finalizar treino" salva
direto.

**3. Vírgula no peso (mobile).** O campo de peso era `type="number"`, que no
teclado do celular brasileiro rejeita a vírgula. Agora é `type="text"` +
`inputMode="decimal"` + máscara, aceitando "58,5" e convertendo para 58.5 ao
salvar. Mesma correção nas medidas corporais (peito/cintura).

**4. Múltiplos grupos por dia.** O cronograma evoluiu de um grupo por dia para
**uma lista de grupos por dia** (ex.: Sábado = Pull + Legs). O editor de semana
virou uma grade de toggles (liga/desliga Push, Pull, Legs em cada dia). Um dia
com vários grupos mostra todos os exercícios, agrupados e com badge do grupo.
A ocorrência (slot) é contada por grupo ao longo da semana, então a Rosca de
Punho (2º dia de pull) aparece corretamente mesmo quando o 2º pull é num dia
combinado. Totalmente retrocompatível: dias salvos como string única
continuam funcionando.

**Validação:** dayGroups (4 formatos), Sábado Pull+Legs com 13 exercícios na
ordem certa, ocorrência por grupo, reordenação manual — todos testados.
ESLint 0 · TypeScript 0 · build ok.

---

# v1.8 — 1RM de exercícios de peso corporal

**Problema.** Em paralela, barra fixa e flexão, a carga movida é o peso do
corpo (+ peso extra). O 1RM antigo tratava o número digitado como carga pura,
distorcendo a estimativa.

**Solução.** Novo campo "Exercício de peso corporal" no cadastro. Quando
marcado, o campo de carga vira o **peso adicional** (0 se for só o corpo) e o
1RM passa a ser `epley(pesoCorporal × fração + pesoAdicional, reps)`.

- A fração por exercício: paralela/barra/mergulho = 100%, flexão = 66%,
  tríceps no banco = 40% (baseado na biomecânica de cada movimento).
- O **peso do corpo é gravado na sessão** (do histórico de peso, ou do
  perfil), então o 1RM histórico usa o peso da época — não o atual.
- O catálogo já marca automaticamente os exercícios de peso corporal ao serem
  selecionados na busca inteligente.
- O modal de histórico mostra a etiqueta "peso corporal NNkg" no exercício.

**Compatível com o passado:** sessões antigas (sem a flag) continuam
calculando como antes; se faltar o peso corporal, degrada com segurança.

**Validação:** paralela só corpo (58×14 = 85,1 kg), com extra (58+20 = 114,4),
frações por exercício, e o caso real (95,3 kg agora significa 58 corpo + 7
extra). ESLint 0 · TypeScript 0 · build ok.

---

# v1.9 — Correções de consistência e verificação do treino ativo

**Ponto 1 — treino ativo lê o plano atualizado (verificado, OK).** O treino
ativo carrega os exercícios de forma reativa e reconstrói a lista quando os
ids mudam e nenhuma série foi registrada ainda. Apagar/adicionar exercício e
depois iniciar o treino daquele dia já reflete o plano novo. (Editar o plano
no meio de um treino em andamento, com séries lançadas, é intencionalmente
ignorado para não perder o que já foi registrado.)

**Ponto 2 — streak corrigido (era bug).** A dica "7 dias sem descanso" usava
as últimas 7 *sessões* e checava se tinham 7 datas distintas — ignorando os
buracos. Sete treinos espalhados (com quinta e domingo de folga no meio)
marcavam 7 indevidamente. Agora conta **dias consecutivos reais no
calendário** (`consecutiveTrainingStreak`), que para no primeiro buraco. Além
disso, cruzando com o cronograma, o app agora reconhece **dia de treino sem
registro** ("hoje é dia de treino e não há registro") e folgas não contam
como falha.

**Ponto 3 — painel de Consistência reformulado.** Agora tem: três números no
topo (dias seguidos, treinos em 84 dias, % de adesão ao plano), rótulos dos
dias da semana, e **quatro estados distintos** com legenda — verde = treino,
vermelho = era dia de treino e faltou, cinza = descanso planejado, e futuro.
Antes era só "treinou / não treinou", sem distinguir folga de falta.

**Validação:** streak com folgas = 3 (não 7), 7 reais = 7, para no 1º buraco,
e detecção de dia de treino sem registro. ESLint 0 · TypeScript 0 · build ok.

---

# v1.9.1 — Versão visível + acesso direto às análises

- Rodapé corrigido para mostrar a versão real (estava fixo em "v1.1" desde o
  início, mesmo com todo o código novo no ar — por isso parecia não ter
  mudado nada).
- A página de Análise exigia 4+ semanas de dados OU preencher o formulário de
  calibração antes de mostrar os gráficos. Adicionado o link "Pular e ver
  minhas análises agora" para acessar os painéis (consistência reformulada,
  volume por músculo, equilíbrio, etc.) imediatamente.

---

# v1.10 — Confirmações no treino ativo + pontas soltas

**Confirmações pedidas:**
1. **Finalizar treino** (durante a sessão) agora abre um diálogo de confirmação
   mostrando quantas séries foram concluídas (e avisa se há pendentes), evitando
   toque acidental. Opções: "Continuar treinando" ou "Finalizar e revisar".
2. **Revisão (tela de resumo)** ganhou o botão **"← Voltar e ajustar"**, que
   retorna ao treino para corrigir séries/cargas sem perder nada.
3. **Salvar progresso** abre uma segunda confirmação com o resumo (volume,
   duração, PRs) antes de gravar. "Descartar treino sem salvar" foi movido para
   um link discreto, separado da ação principal.

**Pontas soltas corrigidas na varredura:**
- **Treino vazio:** finalizar sem nenhuma série registrada não cria mais uma
  sessão fantasma no histórico (avisa e descarta).
- **Excluir foto de evolução:** agora pede confirmação (antes apagava no toque).
- O botão "Revisar ✓" no último exercício leva ao resumo (não salva direto); a
  legenda foi ajustada para refletir isso.
- Reset de perfil mantém a dupla confirmação já existente.
- Exclusão de exercício mantém o "Desfazer" via toast (já adequado).

ESLint 0 · TypeScript 0 · build ok.

---

# v1.11 — 7 novas ferramentas de acompanhamento

**1. Comparação treino-a-treino (treino ativo).** Ao registrar séries, o card
do exercício mostra o 1RM de hoje vs a última sessão, com seta e cor
(▲ verde / ▼ vermelho / = cinza) e há quantos dias foi a última vez.

**2. Resumo semanal (Dashboard).** Card "Esta semana" (dom–sáb): treinos,
volume (t e kg), tempo total e recordes, com comparação % vs semana passada e
projeção de fechamento no ritmo atual.

**3. RPE por série.** Seletor 1–10 (opcional) que aparece durante o descanso,
colorido por intensidade. No Analytics, gráfico de RPE médio por sessão com
linha de "zona de fadiga" — sobe com carga estável = sinal de deload.

**4. Alerta de estagnação (treino ativo).** Se um exercício não bate 1RM há N
sessões (padrão 4), um aviso mostra há quanto tempo e as cargas recentes,
sugerindo variar reps / deload / recuperação.

**5. Backup automático.** Snapshot JSON semanal para o bucket "backups" do
Supabase Storage (rotativo, 10 cópias). Status e botão manual em Perfil →
Backup automático. Requer criar o bucket (SQL atualizado no schema).

**6. Metas de mesociclo (Analytics).** Defina alvo de 1RM de um exercício ou
peso corporal em 4–8 semanas. Barra de progresso com marcador de "ritmo
necessário" (linha vertical = onde deveria estar hoje), status no ritmo/atrasado
e troféu ao bater. Conecta com a meta de peso 58→62kg.

**7. Sugestão de carga (treino ativo).** Antes de digitar, o app sugere o peso
por dupla progressão: bateu o topo da faixa de reps → subir (com botão "usar");
ficou no meio → manter e buscar mais reps.

**Validação:** testes de comparação, estagnação (detecta após 4 sessões),
sugestão (subir/manter), semana. ESLint 0 · TypeScript 0 · build ok.

---

# v1.12 — Análise anatômica por sub-região (Peito · Ombros · Tríceps)

Nova camada de análise que vai além do grupo muscular, mapeando sub-regiões
para evitar assimetrias ("deformação anatômica"). Baseado em biomecânica
clássica (divisões tipo ExRx) — é estimativa educada, não eletromiografia.

**Detecção inteligente por nome + ângulo** (src/lib/hlt/subMuscles.ts): em vez
de tabela fixa por exercício (que ignoraria exercícios digitados à mão), a
sub-região é inferida do nome. "Supino" → peito médio; "Supino inclinado" →
peito superior; "Tríceps corda" → cabeça lateral; "Tríceps testa/francês" →
cabeça longa; "Elevação lateral" → deltoide lateral; "Face pull / crucifixo
invertido" → deltoide posterior. Funciona para exercícios do catálogo E
personalizados. Validado com 100% dos exercícios reais do app.

**7 sub-regiões:** Peito Superior / Médio-Inferior · Deltoide Anterior /
Lateral / Posterior · Tríceps Cabeça Longa / Lateral-Medial.

**Ativação primária + sinergia:** cada exercício conta séries "diretas" (foco)
e "efetivas" (inclui estímulo indireto ponderado, ex.: supino inclinado dá
bônus ao deltoide anterior e tríceps).

**Mapa visual no Analytics:** barras por sub-região agrupadas por Peito/Ombros/
Tríceps, com cor por cobertura (verde ok / amarelo baixo / vermelho zero).

**Alerta de ponto cego:** quando um grupo é treinado mas uma sub-região fica
sem trabalho direto, aviso com sugestão concreta (ex.: "0 séries de Tríceps
Cabeça Longa — adicione Tríceps Testa ou Francês"). Só cobra sub-região se o
grupo pai teve volume real (>=3 séries).

**Catálogo expandido:** Crucifixo Invertido, Desenvolvimento Arnold e Tríceps
Francês Unilateral adicionados (as sugestões dos alertas viram exercícios
cadastráveis).

**Validação:** detecção 16/16 nos exercícios existentes + 3/3 novos, alerta de
ponto cego reproduzindo o caso corda-sem-testa. ESLint 0 · TypeScript 0 · build ok.

---

# v1.13 — Análise anatômica do corpo inteiro + UI mais limpa

**Expansão para todos os grupos.** A análise por sub-região passou de 3 grupos
(v1.12) para o corpo inteiro — 20 sub-regiões:
- Peito: Superior · Médio/Inferior
- Costas: Dorsal (largura) · Trapézio/Romboides (espessura) · Lombar
- Ombros: Deltoide Anterior · Lateral · Posterior · Trapézio Superior
- Bíceps: Cabeça Longa · Curta · Braquial/Braquiorradial · Antebraço
- Tríceps: Cabeça Longa · Lateral/Medial
- Pernas: Quadríceps · Posterior · Glúteo · Panturrilha
- Core: Abdômen

Detecção por nome + ângulo/pegada, alinhada aos exercícios do sistema
(31/31 classificados corretamente nos testes). Todas as 20 sub-regiões são
alcançáveis por algum exercício.

**Pontas soltas corrigidas:**
- "Levantamento Terra Romeno" ia para Costas (tinha "terra") — agora vai para
  Posterior de Coxa corretamente.
- Rosca direta/elevação lateral genéricas agora contam como trabalho DIRETO
  (não ficavam em nenhuma sub-região, distorcendo o alerta de ponto cego).
- Card "Volume por músculo" (barras longas) e o novo card anatômico eram
  redundantes: o primeiro virou "Volume por grupo" compacto (grade de números
  com faixa 10–20), o anatômico ganhou o detalhe.
- Variável `maxMuscleVol` órfã removida.

**UI mais limpa e visual (pedido):** a análise anatômica deixou de usar barras
longas empilhadas e passou a usar **chips compactos** por sub-região, agrupados
por grupo pai, com cor por status (verde ok / amarelo pouco / vermelho zerado)
e o número de séries diretas. Pontos cegos aparecem em destaque no topo com
ícone e sugestão de exercício. Legenda enxuta no rodapé.

ESLint 0 · TypeScript 0 · build ok · 31/31 exercícios · 20/20 sub-regiões.

---

# v1.14 — Accordion de exercícios, streak corrigido, explicações

**Ponto 3 — streak do Dashboard corrigido.** O card "Streak" usava uma lógica
própria que exigia atividade HOJE para contar — se você treinou ontem e
anteontem mas ainda não fez nada hoje, mostrava 0. Agora usa
`consecutiveTrainingStreak` (a mesma do painel de Consistência), que tolera
"hoje ainda não treinei" e conta os dias consecutivos de treino reais até o
primeiro buraco. Também passou a contar só treino (antes misturava treino +
refeição + peso, inflando o número).

**Ponto 2 — accordion na análise anatômica.** Cada sub-região agora é
clicável: toca e expande abaixo uma lista de exercícios sugeridos para aquele
músculo (SUB_EXERCISES, 3–4 por região); toca de novo e recolhe. Seta que gira
indica o estado. Só uma aberta por vez, mantendo a interface limpa.

---

# v1.15 — Dropdown sem duplicatas, heatmap correto, atribuição inteligente

**1. Progressão de carga sem nomes repetidos.** O dropdown listava todos os
exercícios de `exercises` — e quando há variações do mesmo grupo (Push A/Push B)
ou duplicatas de edições antigas, o mesmo nome aparecia várias vezes. Agora a
lista é deduplicada por nome, mantendo, entre os homônimos, o exercício com mais
sessões no histórico (o mais relevante para o gráfico).

**2. Heatmap de consistência não reescreve o passado.** Ao marcar um novo dia de
treino (ex.: quinta), o cronograma ATUAL era aplicado retroativamente a todas as
quintas passadas, pintando de vermelho ("faltou") dias que na época eram
descanso. Corrigido: só a SEMANA ATUAL pode marcar "faltou" (onde o cronograma
vigente realmente se aplica); dias passados sem treino são apenas "descanso".

**3. Atribuição Inteligente de Treino.** Ao ligar um grupo num dia pelo editor de
semana, se o grupo tiver variações (exercícios com `slot` distintos), abre um
modal "Qual variação de X você deseja usar?" listando cada variação com seus
exercícios. Ao escolher, o dia é vinculado à variação (clonando os exercícios da
variação para a nova ocorrência quando necessário, sem afetar a original).

ESLint 0 · TypeScript 0 · build ok.

---

# v1.16 — Correção de dia com múltiplos grupos (ex.: Sábado Legs + Push)

**Bug:** um dia com dois grupos (ex.: sábado = Legs + Push) era lido só pelo
grupo PRIMÁRIO. O treino ativo recebia apenas "legs" e filtrava exercícios só
desse grupo — os de Push (e suas variações) não apareciam, e não dava para
escolher a variação de Push naquele dia.

**Causa:** o treino ativo filtrava `exercises` por um único `type` (o grupo
primário passado na URL), em vez de usar todos os grupos do dia.

**Correções:**
- Treino ativo agora usa `exercisesForDay(exercises, dayInfo)` quando vem de um
  dia do cronograma — lê TODOS os grupos do dia, respeitando o slot por
  ocorrência de cada grupo. Sábado Legs + Push mostra os exercícios dos dois.
- A página de Treino mostra um badge para CADA grupo do dia (antes só o
  primário aparecia).
- Confirmado por teste: sábado [legs, push] resolve occ legs=1, push=2, e a
  variação de push (slot) aparece junto com legs.

ESLint 0 · TypeScript 0 · build ok.

---

# v1.17 — Correção de fuso horário (datas), gráfico de peso e dicas expansíveis

**1+2. Bug de fuso horário (a causa dos dois problemas de data).** Todo o app
usava `toISOString()`, que converte para UTC. Para quem está no Brasil (UTC-3),
um treino às 21h de 04/07 virava 05/07 em UTC — então o treino "pulava" para o
dia seguinte no calendário de consistência, e o streak quebrava porque as datas
não batiam com "hoje". Criadas as funções `toLocalISO()` e `localDayOf()` no
calc.ts, que extraem a data no fuso LOCAL. Aplicadas no streak
(`consecutiveTrainingStreak`) e no heatmap de consistência. Teste com TZ do
Brasil confirma: treino às 21h de 04/07 fica em 04/07, e 4 dias seguidos = streak
4 (antes 1).

**3. Gráfico de peso com decimais.** A linha de média mostrava o valor bruto
(ex.: 58,428571…). Arredondada para 1 casa no gráfico, e o tooltip agora
formata peso e média como "58,4 kg".

**4. Dicas inteligentes expansíveis.** Cada dica virou um accordion: título curto
+ seta; ao clicar, expande um parágrafo com o contexto completo (o porquê e o
que fazer). Antes eram frases soltas sem explicação.

ESLint 0 · TypeScript 0 · build ok.

---

# v1.18 — Análise micro de RPE por exercício (carga × esforço)

Substitui o gráfico de RPE médio DIÁRIO (que mascarava picos — ex.: Hack Squat
RPE 10 + Mesa Flexora RPE 6 virava média ilusória 8) por uma análise focada em
UM exercício:

- **Seletor de exercício** (só lista os que têm RPE registrado).
- **Gráfico combinado (ComposedChart):** linha de RPE médio do exercício +
  barras de volume (carga × reps) do dia, em eixos duplos (RPE à esquerda,
  volume à direita).
- **Correlação carga × esforço:** insight automático — volume estável + RPE
  caindo = ganho de força; volume estável + RPE subindo = fadiga acumulando.
- **Alerta de série crítica:** pontos com série RPE ≥ 9,5 ficam vermelhos e
  maiores no gráfico, independentemente da média; lista das séries no limite
  (data, carga × reps, RPE) abaixo do gráfico.

Novos helpers em progression.ts: `rpeVolumeByExercise`, `rpeVolumeInsight`.
Testado: série crítica detectada apesar de média baixa; força vs fadiga
distinguidas com volume idêntico. ESLint 0 · TypeScript 0 · build ok.

---

# v1.18.1 — Limpeza de código morto (correção do erro de build do Lovable)

O template Lovable vinha com 37 componentes shadcn/ui NÃO usados (o kit
completo). Vários importavam bibliotecas pesadas (chart.tsx→recharts inteiro
via `import *`, carousel→embla, drawer→vaul, form→react-hook-form, etc.).
Esse código morto aumentava a superfície de bundle e era um candidato ao erro
`handleInvalidResolvedId` no build SSR de produção do Lovable (que é mais
estrito que o build local).

Removidos 37 componentes ui não referenciados por nenhum arquivo; restaram só
os 9 realmente usados (alert-dialog, button, dialog, input, select, slider,
sonner, switch, tabs). Nenhuma funcionalidade afetada.

Validado com bun (mesma ferramenta do Lovable): build passa. ESLint 0 ·
TypeScript 0.

---

# v1.19 — Planos de treino pré-definidos por grupo (resolve conflito de variações)

**Problema:** as "variações" ao adicionar um grupo mais de uma vez na semana
eram derivadas do campo `slot` dos exercícios — frágil. Quando os slots não
estavam bem definidos, as variações colapsavam e Variação 1 e 2 mostravam o
mesmo plano.

**Solução (ideia do usuário):** planos NOMEADOS e explícitos por grupo.
- Nova seção "Meus planos" (botão no topo da página de Treino) com seletor de
  grupo (Push/Pull/Legs) — os "botõezinhos no topo".
- Para cada grupo, o usuário cria planos nomeados (ex.: "Push A força", "Push B
  volume") com seus próprios exercícios (nome, séries, reps, ordem). Pode
  duplicar, editar e excluir. Salvos em KEYS.plans.
- Ao montar a semana (Editar semana) e ligar um grupo num dia, se houver planos
  salvos daquele grupo, o modal "Qual plano usar?" lista os planos nomeados —
  não mais variações genéricas idênticas.
- Ao escolher, os exercícios do plano são materializados naquele dia (com slot =
  ocorrência do grupo no dia), substituindo qualquer conjunto anterior da mesma
  ocorrência (sem duplicar).

Novo tipo WorkoutPlan + PlanExercise. Componente WorkoutPlans.tsx.
ESLint 0 · TypeScript 0 · build (bun) ok.

---

# v1.19.1 — Importar exercícios atuais para um plano

No editor de plano, botão "Importar exercícios atuais deste grupo": pré-preenche
o plano com os exercícios já cadastrados naquele grupo (nome, séries, reps,
carga, etc.), pulando os que já estão no plano. Poupa digitação ao criar o
primeiro plano a partir do treino existente.

ESLint 0 · TypeScript 0 · build (bun) ok.

---

# v1.20 — Histórico por nome + sugestões com dados salvos

**Problema:** o histórico/análise era vinculado ao ID do exercício. Ao excluir e
recriar um exercício com o mesmo nome (novo ID), a Análise não puxava mais nada —
o histórico "sumia".

**Correção:** todas as buscas de histórico agora casam por ID OU por nome
normalizado (ignora acento, caixa e espaços). Assim, recriar um exercício com o
mesmo nome reaproveita toda a progressão, recordes e RPE anteriores. Novo helper
`normExerciseName` + `sessionExerciseMatches` no progression.ts; aplicado em
exerciseHistory, compareToLast, detectStagnation, suggestLoad,
rpeVolumeByExercise, loadHistory (analytics) e MesoGoals.

**Sugestões melhoradas no cadastro:**
- Seção "Já treinados (mantêm seu histórico e progressão)" — os exercícios que
  você já usou, com ícone ↺, priorizados no topo do formulário.
- Ao digitar um nome que casa com histórico existente, aviso verde confirmando
  que a progressão será reaproveitada.
- Catálogo de exercícios famosos continua nas sugestões conforme você digita.

ESLint 0 · TypeScript 0 · build (bun) ok. Testado: histórico recuperado após
recriar exercício com mesmo nome; nomes diferentes não se misturam.

---

# v1.20.1 — Correção: dia de grupo secundário + gráfico de progressão

**Bug 1 — grupo secundário não reconhecia o dia.** No "Editar exercício", o
dropdown "Dia do grupo" filtrava por d.group (grupo PRIMÁRIO do dia). Num dia
misto (ex.: sábado = Legs + Pull), o Pull é secundário, então não aparecia a
opção "Apenas Sábado" — só "Apenas Quarta" (errado). Corrigido para usar
d.groups.includes(group) e a ocorrência d.occ[group] daquele grupo. Agora Pull
reconhece Terça E Sábado.

**Bug 2 — gráfico de progressão abria "vazio" e perdia datas recentes.**
- O estado inicial era exercises[0]?.id, mas o dropdown lista progressionOptions
  (deduplicado/ordenado) — divergiam, então abria sem seleção coerente. Agora usa
  effectiveExId (cai no 1º item do dropdown por padrão), igual ao gráfico de RPE.
- O loadHistory não ordenava as sessões por data; se o array estava fora de
  ordem, datas recentes sumiam/desalinhavam. Agora usa exerciseHistory (casa por
  ID/nome e já ordena cronologicamente). Todas as datas aparecem, inclusive as
  mais recentes.

ESLint 0 · TypeScript 0 · build (bun) ok. Testado: Pull em ter+sáb; histórico
completo e ordenado.
