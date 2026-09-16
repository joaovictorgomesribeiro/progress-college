# Documentação técnica — Meu Sistema de Estudos

Este documento explica **como cada parte do código funciona**. Para instruções de instalação e deploy, veja o [README.md](README.md).

## Visão geral

SPA (single-page app) sem framework: um único HTML carrega vários arquivos `.js`, cada um "registra" uma página num roteador simples baseado no hash da URL (`#/disciplinas`, `#/tarefas`, etc). O backend é uma API REST em Flask que fala com um banco SQLite via queries SQL cruas (sem ORM).

```
static/js/*.js  →  fetch("/api/...")  →  app.py (Flask)  →  database.py  →  database.db (SQLite)
```

---

## 1. Banco de dados (`schema.sql` + `database.py`)

### Tabelas

| Tabela | Para quê serve | Isolamento por usuário |
|---|---|---|
| `usuarios` | Contas: nome, e-mail (único), `senha_hash`, `ativo`. Raiz de todo o isolamento multiusuário. | — |
| `disciplinas` | As matérias do usuário: nome, professor, período, sala, status, nota (`media`), frequência, cor de identificação. | Direto: coluna `usuario_id`. |
| `disciplinas_catalogo` | Tabela "preparada para o futuro" — ainda não é usada por nenhuma tela. Serviria para um catálogo oficial de disciplinas por universidade/curso, **compartilhado entre todos os usuários** (por isso não tem `usuario_id`). | Nenhum — global. |
| `horarios` | Grade de horários de cada disciplina: dia da semana (`0`=domingo … `6`=sábado), hora início/fim. Uma disciplina pode ter vários horários. | Indireto, via `disciplina_id → disciplinas.usuario_id`. |
| `pre_requisitos` | Relação N:N entre disciplinas (quais são pré-requisito de quais), usada na Grade curricular. | Indireto, via `disciplina_id`/`requisito_id` (ambos sempre do mesmo dono). |
| `avaliacoes` | Provas/trabalhos/listas de uma disciplina: tipo, título, data, `peso` (valor em pontos), `nota` (pontos obtidos), status, prioridade. | Indireto, via `disciplina_id`. |
| `tarefas` | Itens de afazeres, opcionalmente ligados a uma disciplina (`disciplina_id` pode ser `NULL` = tarefa geral). | Direto: coluna `usuario_id` (obrigatório porque a tarefa pode não ter disciplina). |
| `conteudos` | Tópicos do conteúdo programático de uma disciplina, cada um com status (`pendente`/`andamento`/`concluido`) — é a base do cálculo de **progresso** da disciplina. | Indireto, via `disciplina_id`. |
| `sessoes_estudo` | Registros de tempo estudado (data, duração em minutos, tipo: estudo/revisão/exercícios/pomodoro). | Direto: coluna `usuario_id` (obrigatório porque a sessão pode não ter disciplina). |
| `metas` | Metas do usuário (horas, exercícios, conteúdos ou disciplina), com valor atual e alvo. | Direto: coluna `usuario_id` (obrigatório porque a meta pode não ter disciplina). |
| `grade_curricular` | Posição (período/ordem) de cada disciplina na grade — hoje redundante com `disciplinas.periodo`, mantida para permitir reordenar dentro do mesmo período no futuro. | Indireto, via `disciplina_id`. |
| `configuracoes` | Tabela chave-valor genérica (hoje sem uso visível na UI além do tema, que na verdade fica em `localStorage` do navegador). | Nenhum — global, não há tela que grave dados pessoais nela hoje. |

Tabelas com isolamento **indireto** não têm coluna `usuario_id` própria: a posse é sempre resolvida checando se a `disciplina_id` referenciada pertence ao usuário da sessão (`disciplina_pertence_ao_usuario()` em `app.py`). Isso evita ter duas colunas (`usuario_id` duplicado + `disciplina_id`) que poderiam ficar dessincronizadas.

### `database.py`

Camada fininha sobre `sqlite3`, sem ORM:

- `get_connection()`: abre conexão, ativa `PRAGMA foreign_keys = ON` (sem isso o SQLite ignora `ON DELETE CASCADE`/`SET NULL` do schema).
- `init_db()`: roda `schema.sql` inteiro com `CREATE TABLE IF NOT EXISTS` toda vez que o app sobe — por isso é seguro chamar sempre, nunca apaga dados existentes.
- `_migrar_colunas_novas()`: como `CREATE TABLE IF NOT EXISTS` não adiciona coluna nova a uma tabela que já existe, esse é o mecanismo manual de migração — cuida da coluna `catalogo_disciplina_id` e, via `_migrar_usuario_id()`, da introdução do multiusuário: adiciona `usuario_id` a `disciplinas`/`tarefas`/`sessoes_estudo`/`metas` em bancos antigos e associa todos os registros órfãos a um usuário inicial (criado automaticamente com e-mail `celjoaogomes22@gmail.com` e senha temporária impressa no log, na primeira execução após a atualização). Se um dia você adicionar uma coluna nova ao schema, é aqui que entra um `ALTER TABLE` equivalente para bancos já existentes (como o de produção).
- `query_all` / `query_one` / `execute`: cada chamada abre e fecha sua própria conexão (simples, sem pool — adequado pro volume de uso de um sistema pessoal).

---

## 2. Backend (`app.py`)

Rotas REST agrupadas por recurso, todas sob `/api/...`, todas devolvendo/recebendo JSON. Padrão em cada recurso: `_validar_X(data)` centraliza validação e normalização antes de qualquer INSERT/UPDATE.

### Disciplinas (`/api/disciplinas`)
- **GET lista**: aceita filtros `?periodo=` e `?status=`; calcula `progresso` de cada disciplina como `100 × conteúdos concluídos / total de conteúdos` (0% se não há conteúdo cadastrado).
- **GET detalhe**: além dos campos da disciplina, também devolve `horarios` e `pre_requisitos` (relacionados).
- **POST/PUT**: salvam os campos da disciplina e, se vierem no corpo, também `horarios` (substitui todos: apaga os antigos e insere os novos — `salvar_horarios()`) e `pre_requisitos` (idem, `salvar_prerequisitos()`).
- **DELETE**: `ON DELETE CASCADE`/`SET NULL` do schema cuidam de limpar avaliações, conteúdos, horários etc. relacionados.

### Avaliações (`/api/avaliacoes`)
- Cada avaliação pertence a uma disciplina (`disciplina_id` obrigatório).
- `peso` = quantos pontos a avaliação vale; `nota` = quantos pontos foram obtidos (0 a 100).
- Toda vez que uma avaliação é criada, editada ou excluída, `recalcular_media(disciplina_id)` roda e **soma** as notas de todas as avaliações com nota lançada daquela disciplina, salvando em `disciplinas.media`. Ver seção 4 (regra de notas) para o porquê da soma em vez de média ponderada.

### Tarefas (`/api/tarefas`)
- `disciplina_id` é opcional (tarefa "geral", sem matéria).
- CRUD simples, sem side effects em outras tabelas.

### Conteúdos (`/api/conteudos`)
- Ao marcar um conteúdo como `concluido` sem informar `data_conclusao`, o backend preenche a data de hoje automaticamente.
- Quando um conteúdo passa a `concluido` pela primeira vez, chama `atualizar_metas_conteudo()`, que incrementa qualquer meta ativa do tipo `conteudos` compatível com a disciplina.

### Sessões de estudo (`/api/estudos`)
- Só cria e lista (não tem PUT — uma sessão é editada excluindo e recriando).
- Ao criar, chama `atualizar_metas_horas()`, que soma a duração (em horas) a qualquer meta ativa do tipo `horas` cujo período (`data_inicio`/`data_fim`) e disciplina sejam compatíveis com a sessão registrada, e marca a meta como concluída se o alvo for atingido.
- **Paginado**: aceita `?pagina=` (padrão 1) e `?por_pagina=` (padrão 20, máx. 100), além dos filtros `disciplina_id`/`desde`. A resposta vem no formato `{itens, total, pagina, por_pagina, paginas}` em vez de uma lista solta — é a tabela que mais cresce com o tempo (uma linha por sessão registrada), então era o candidato mais óbvio a ficar pesado sem paginação.

### Metas (`/api/metas`)
- Tipos: `horas`, `exercicios`, `conteudos`, `disciplina`.
- No PUT, se `atual >= alvo` a meta vira `concluida` automaticamente.

### Grade curricular (`/api/grade`)
- Agrupa as disciplinas por período e calcula um `status_efetivo` para cada uma (diferente do `status` bruto salvo no banco):
  - Se a disciplina já está `concluida` ou `andamento`, o status efetivo é esse mesmo.
  - Senão, se ela tem algum pré-requisito ainda não concluído, o status efetivo vira `bloqueada`.
  - Senão, `planejada`.
- Essa é a lógica que colore os pontinhos na tela **Grade curricular**.

### Dashboard (`/api/dashboard`)
Consolida tudo que aparece na página Início:
- `tarefas_total` / `tarefas_concluidas`, `avaliacoes_proximas` (pendentes com data nos próximos **15 dias**), `horas_semana` (soma de `sessoes_estudo` desde segunda-feira), `disciplinas_andamento` (matérias com status "Cursando").
- `aulas_hoje`: consulta `horarios` cruzado com `disciplinas` filtrando pelo dia da semana de hoje (conversão `(hoje.weekday() + 1) % 7`, porque o Python conta segunda=0 e o schema conta domingo=0).
- `foco_do_dia`: uma lista unificada de até 8 itens (avaliações próximas + tarefas com prazo + metas estagnadas), cada um com um `nivel` de urgência (`alta`/`media`/`baixa`) calculado a partir de quantos dias faltam, ordenada por urgência.

### Estatísticas (`/api/estatisticas`)
- Horas por disciplina, série dos últimos 14 dias de estudo, evolução das notas lançadas, contagem de conteúdos/tarefas por status, e percentual de disciplinas concluídas no curso. Tudo consumido pela página **Estatísticas** para desenhar barras em CSS puro (sem lib de gráficos).
- O campo `evolucao_notas` também é **paginado** (mesmos parâmetros `pagina`/`por_pagina` do `/api/estudos`, mesmo formato de resposta `{itens, total, pagina, por_pagina, paginas}`) — cresce a cada avaliação lançada, sem limite de tempo, então também se beneficia de não vir inteiro a cada carregamento da página.
- O helper genérico de paginação (`paginacao_args()` / `paginar_resposta()`, em `app.py`) é reutilizado pelas duas rotas — qualquer endpoint futuro que precise paginar usa o mesmo padrão.

### Importar/Exportar (`/api/importar`, `/api/exportar`)
- Delegado inteiramente para `xlsx_io.py` (seção 3). O arquivo enviado é salvo temporariamente em `uploads/` e apagado logo depois de processado, com ou sem erro (`finally`).

---

## 2.1 Autenticação e isolamento multiusuário (`app.py`)

- `session["usuario_id"]` (sessão do Flask, cookie assinado com `app.secret_key`) identifica o usuário logado. A chave de assinatura é gerada uma vez e persistida em `secret.key` (fora do Git) por `_carregar_secret_key()` — sem isso, cada reinício do servidor invalidaria todas as sessões abertas.
- `current_user_id()`: lê `session.get("usuario_id")`.
- `login_required`: decorator aplicado a toda rota `/api/...` de dados. Sem sessão válida, devolve `401` antes de tocar no banco.
- `disciplina_pertence_ao_usuario(disciplina_id, usuario_id)`: usado por todas as rotas de avaliações/conteúdos/horários/pré-requisitos/grade para confirmar posse antes de ler ou escrever, já que essas tabelas não têm `usuario_id` próprio.
- Rotas de conta: `POST /api/cadastro`, `POST /api/login`, `POST /api/logout`, `GET /api/me` — nenhuma delas exige `login_required` (exceto `/me`, que devolve 401 se não houver sessão, usado pelo frontend para saber se deve mostrar a tela de login).
- **O frontend nunca decide quem é o dono.** Nenhuma rota lê `usuario_id` do corpo da requisição — sempre vem de `current_user_id()` (a sessão). Um `usuario_id` enviado pelo `fetch` é simplesmente ignorado.
- Toda query de listagem/detalhe/update/delete filtra por `usuario_id` (direto) ou por posse da disciplina (indireto) — ver a tabela da seção 1.

## 2.2 Tela de login (frontend)

Como a SPA é toda client-side, o login não é uma rota do roteador de hash (`#/login`) — é uma tela separada (`#auth-screen` em `templates/index.html`), escondida ou mostrada por JavaScript puro em `app.js`:

- No `DOMContentLoaded`, `Api.me()` é chamado; se der 401, `mostrarTelaAuth()` esconde `#app-shell` e mostra `#auth-screen`. Se der certo, `iniciarApp(usuario)` mostra o app normalmente.
- O mesmo formulário (`#form-auth`) serve para login e cadastro — `authModo` alterna qual modo está ativo e ajusta os textos/campos visíveis.
- Se a sessão expirar em uso (qualquer chamada de API devolver 401), `api.js` dispara um evento `window` customizado `auth:required`, que `app.js` escuta para chamar `mostrarTelaAuth()` de novo — sem precisar espalhar tratamento de 401 em cada página.
- Botão de logout fica no `#topbar`, ao lado do alternador de tema.

---

## 3. Import/Export XLSX (`xlsx_io.py`)

O XLSX **nunca** é o banco principal — é só um formato de intercâmbio. Uma planilha tem uma aba por tabela (disciplinas, grade, avaliações, tarefas, conteúdos, estudos, metas, config).

- `validar_arquivo()`: checa extensão `.xlsx` e tamanho (10MB).
- `importar_xlsx(caminho, modo, usuario_id)`: lê cada aba e faz upsert linha a linha via `_upsert_by_match()`, que decide se INSERT ou UPDATE comparando colunas-chave (ex: para avaliações, `disciplina_id + titulo + data`) **sempre dentro do escopo do `usuario_id`** — `_find_disciplina_id()` só encontra disciplinas do próprio usuário, então uma planilha importada nunca cria vínculo com dados de outra conta.
  - Resolver "disciplina" por nome/código a cada linha da planilha seria um `SELECT` por linha (N+1 real numa importação de centenas de linhas). Por isso `importar_xlsx()` monta um mapa `{codigo/nome → id}` uma única vez no início (`_carregar_mapa_disciplinas()`) e mantém ele atualizado em memória conforme `_importar_disciplinas()` cria/atualiza disciplinas — as demais abas (avaliações, tarefas, conteúdos, estudos, metas, grade) resolvem a disciplina com uma busca em dicionário, sem tocar no banco. O `SELECT`+`INSERT`/`UPDATE` por linha feito pelo próprio `_upsert_by_match()` na tabela de destino continua existindo (é inerente ao modelo de upsert por comparação de colunas) — só o lookup de disciplina foi eliminado.
  - O parâmetro `modo` controla o comportamento:
  - `add`: só insere o que não existe ainda.
  - `update`: insere novo e atualiza o que já existe (é o modo padrão).
  - `replace`: apaga os dados **desse usuário** (disciplinas/tarefas/sessões/metas — o resto cai em cascata) antes de importar; nunca toca nos dados de outra conta.
- `exportar_xlsx(caminho_destino, usuario_id)`: gera um `.xlsx` novo em memória (`BytesIO`) a partir do estado atual do SQLite, filtrado só pelos dados do usuário — é o snapshot que sai pelo botão "Exportar dados". A aba `Config` não é mais exportada, pois `configuracoes` é uma tabela global, não pessoal.
- Tem sua **própria cópia** de `_recalcular_media()` (mesma lógica de soma de pontos do `app.py`), porque a importação também precisa recalcular a nota final da disciplina depois de inserir avaliações em lote.

---

## 4. Regra de notas (pontos, não média)

Cada disciplina vale **100 pontos no total**, distribuídos entre as avaliações a critério do professor (ex: 3 provas de 28 + 1 trabalho de 16). Por isso:

- `avaliacoes.peso` = quantos pontos aquela avaliação **vale** (não é peso relativo).
- `avaliacoes.nota` = quantos pontos o usuário **conquistou** naquela avaliação (0 a 100, mas normalmente até o valor de `peso`).
- `disciplinas.media` = **soma direta** das notas lançadas (`recalcular_media()` em `app.py:74` e `xlsx_io.py:372`), não uma média ponderada — porque os `peso`s já somam 100 por construção, somar as notas já dá a nota final na mesma escala.
- A calculadora "Quanto preciso tirar?" (aba Notas de cada disciplina, `static/js/disciplinas.js`) segue a mesma lógica: `pontos necessários = meta desejada − pontos já obtidos`, comparado contra os pontos ainda disponíveis nas avaliações pendentes.

Aprovação mínima usada como padrão na calculadora: **60 pontos**.

---

## 5. Frontend (SPA sem framework)

### Arquitetura de roteamento (`static/js/app.js`)

- Cada módulo de página chama `registerPage("nome", { render(container, param) {...} })` no carregamento do script.
- `App.render()` lê `location.hash` (ex: `#/disciplinas/7` → rota `disciplinas`, parâmetro `7`), monta um `<div id="page-{rota}">` vazio e chama `Pages[rota].render(...)`.
- Navegação é 100% client-side: trocar o hash dispara `hashchange` → `App.render()` de novo. Não há recarregamento de página nem histórico de rotas fora do hash do navegador.
- `App.refresh()` é só um apelido para re-renderizar a rota atual — chamado depois de qualquer operação de salvar/excluir, pra tela sempre refletir o estado mais recente do banco.

### Camada de API (`static/js/api.js`)

Um wrapper único sobre `fetch`: monta a URL com `/api` na frente, serializa o corpo como JSON (exceto `FormData`, usado só no upload de planilha), e converte respostas de erro (`{error: "..."}`) em `Error` do JavaScript, capturado por cada tela com `try/catch` e mostrado via `UI.showToast`.

### `UI` (modal, toast, tema — dentro de `app.js`)

- `UI.openModal({title, bodyHtml, actionsHtml})`: injeta HTML puro num `#modal-root` e devolve controle pro chamador — não há data-binding, cada formulário lê os valores dos campos manualmente no momento de salvar (`document.getElementById(...).value`).
- `UI.showToast(msg)`: mensagem temporária no rodapé.
- Tema (claro/escuro/sistema) é salvo em `localStorage` (chave `tema`) e aplicado via atributo `data-theme` no `<html>`, sem chamada ao backend.

### Páginas (`static/js/*.js`)

| Arquivo | Rota | O que faz |
|---|---|---|
| `dashboard.js` | `#/dashboard` (Início) | Resumo do dia: cards de estatística, aulas de hoje, próximas avaliações, tarefas pendentes, progresso das disciplinas em andamento. Tudo vem de `/api/dashboard`. |
| `disciplinas.js` | `#/disciplinas` e `#/disciplinas/:id` | Lista (com busca, filtro por status, modo lista/tabela) + detalhe com abas: Resumo, Notas (calculadora de pontos), Conteúdos (checklist que alimenta o progresso), Avaliações, Tarefas, Estudos. Também tem o formulário de criar/editar matéria, incluindo o editor de horários (linhas dinâmicas de dia/início/fim). |
| `avaliacoes.js` | `#/avaliacoes` | Lista todas as avaliações (filtro pendente/concluída) e formulário de criar/editar (matéria, tipo, valor em pontos, nota obtida, prioridade, status). |
| `tarefas.js` | `#/tarefas` | Lista com checkbox rápido de concluir, filtro por status, formulário completo. Tem um FAB (botão flutuante) próprio via `onFab()`. |
| `estudos.js` | `#/estudos` (Plano de estudos) | Meta semanal de horas + lista de metas (qualquer tipo) + histórico de sessões de estudo registradas manualmente. |
| `pomodoro.js` | `#/pomodoro` | Timer de foco/pausa client-side (`setInterval`). Ao completar um ciclo de foco, registra automaticamente uma sessão de estudo tipo `pomodoro` via API. Estado do timer vive numa variável de módulo (`pomodoro`), por isso sobrevive a troca de aba mas é perdido ao recarregar a página. |
| `calendario.js` | `#/calendario` (Agenda) | Calendário mensal client-side que marca dias com avaliação (data) ou tarefa (prazo), e lista os eventos do dia selecionado. Não bate na API de novo ao trocar de dia — já carregou tudo de uma vez. |
| `grade.js` | `#/grade` (Grade curricular) | Visualização por período com o `status_efetivo` calculado no backend (ver seção 2) e nota de qual pré-requisito está bloqueando cada matéria. |
| `estatisticas.js` | `#/estatisticas` | Gráficos simples em CSS puro (barras via `width`/`height` proporcional) a partir de `/api/estatisticas` — sem biblioteca externa de charts. |
| `app.js` (rota `config`) | `#/config` | Tema, importar planilha (com escolha de modo: adicionar/atualizar/substituir) e exportar planilha. |

---

## 6. Fluxo típico de uma tela (exemplo: criar uma tarefa)

1. Usuário clica em "Nova tarefa" → `abrirFormTarefa()` em `tarefas.js` monta o modal com `UI.openModal`.
2. Ao clicar em "Salvar", o handler lê os campos do DOM, monta o objeto `dados` e chama `Api.criarTarefa(dados)`.
3. `api.js` faz `POST /api/tarefas` com o JSON.
4. `app.py` roda `_validar_tarefa()`; se inválido, devolve `{error: "..."}` com status 400, que vira uma `Error` lançada no `fetch` wrapper.
5. Se válido, insere no SQLite e devolve a tarefa criada com status 201.
6. Frontend fecha o modal, mostra um toast de sucesso e chama `App.refresh()`, que re-renderiza a página atual buscando os dados atualizados do backend — não há nenhum estado de tarefas guardado em memória entre navegações.
