/* Meu Sistema de Estudos - Disciplinas (lista, detalhe, CRUD) */

const STATUS_DISC_LABEL = { concluida: "Concluída", andamento: "Cursando", planejada: "Planejada", bloqueada: "Bloqueada" };
const STATUS_DISC_BADGE = { concluida: "badge-success", andamento: "badge-info", planejada: "badge-neutral", bloqueada: "badge-danger" };
let disciplinasViewMode = "lista";
let disciplinasBusca = "";
let disciplinasFiltroStatus = "";

registerPage("disciplinas", {
  async render(container, param) {
    if (param) {
      await renderDisciplinaDetail(container, param);
    } else {
      await renderDisciplinasLista(container);
    }
  },
});

async function renderDisciplinasLista(container) {
  const todasDisciplinas = await Api.listarDisciplinas();

  container.innerHTML = `
    <div class="page-header">
      <h1>Matérias</h1>
      <button class="btn btn-primary btn-sm" id="btn-nova-disciplina">${icon("plus")} Nova matéria</button>
    </div>
    <p class="page-subtitle">${todasDisciplinas.length} disciplina${todasDisciplinas.length === 1 ? "" : "s"} cadastrada${todasDisciplinas.length === 1 ? "" : "s"}.</p>

    ${todasDisciplinas.length ? `
      <div class="search-row">
        <div class="search-box">${icon("search")}<input type="search" id="busca-disciplina" placeholder="Buscar matéria..." value="${disciplinasBusca}"></div>
        <div class="view-toggle">
          <button data-mode="lista" class="${disciplinasViewMode === "lista" ? "active" : ""}">Lista</button>
          <button data-mode="tabela" class="${disciplinasViewMode === "tabela" ? "active" : ""}">Tabela</button>
        </div>
      </div>
      <div class="filter-row">
        ${["", "andamento", "concluida", "planejada", "bloqueada"].map((s) => `
          <button class="filter-chip ${disciplinasFiltroStatus === s ? "active" : ""}" data-status="${s}">${s === "" ? "Todas" : STATUS_DISC_LABEL[s]}</button>
        `).join("")}
      </div>
    ` : ""}

    <div id="disc-conteudo"></div>
  `;

  if (!todasDisciplinas.length) {
    container.querySelector("#disc-conteudo").innerHTML = `
      <div class="empty-state">
        <p>Você ainda não possui matérias cadastradas.<br>Comece adicionando sua primeira disciplina.</p>
        <button class="btn btn-primary" id="btn-nova-disciplina-vazio">${icon("plus")} Adicionar matéria</button>
      </div>`;
    container.querySelector("#btn-nova-disciplina-vazio").addEventListener("click", () => abrirFormDisciplina());
  } else {
    renderDisciplinasConteudo(container, todasDisciplinas);
  }

  container.querySelector("#btn-nova-disciplina").addEventListener("click", () => abrirFormDisciplina());
}

function normalizarBusca(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function renderDisciplinasConteudo(container, todasDisciplinas) {
  const termo = normalizarBusca(disciplinasBusca.trim());
  const filtradas = todasDisciplinas.filter((d) => {
    const bateStatus = !disciplinasFiltroStatus || d.status === disciplinasFiltroStatus;
    const bateBusca = !termo || normalizarBusca(d.nome).includes(termo) || normalizarBusca(d.codigo).includes(termo);
    return bateStatus && bateBusca;
  });

  const alvo = container.querySelector("#disc-conteudo");
  if (!filtradas.length) {
    alvo.innerHTML = `<p class="empty-state">Nenhuma matéria encontrada para esse filtro.</p>`;
  } else if (disciplinasViewMode === "tabela") {
    alvo.innerHTML = `<div class="scroll-x"><table class="data-table">
      <thead><tr><th>Nome</th><th>Código</th><th>Período</th><th>Status</th><th>Média</th><th>Frequência</th></tr></thead>
      <tbody>${filtradas.map((d) => `
        <tr data-id="${d.id}" style="cursor:pointer;">
          <td>${d.nome}</td>
          <td>${d.codigo || "—"}</td>
          <td>${d.periodo}º</td>
          <td><span class="badge ${STATUS_DISC_BADGE[d.status] || ""}">${STATUS_DISC_LABEL[d.status] || d.status}</span></td>
          <td>${d.media != null ? d.media.toFixed(1) : "—"}</td>
          <td>${d.frequencia != null ? d.frequencia + "%" : "—"}</td>
        </tr>`).join("")}</tbody>
    </table></div>`;
    alvo.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", () => { location.hash = `#/disciplinas/${row.dataset.id}`; });
    });
  } else {
    const porPeriodo = {};
    filtradas.forEach((d) => { (porPeriodo[d.periodo] = porPeriodo[d.periodo] || []).push(d); });
    const periodos = Object.keys(porPeriodo).map(Number).sort((a, b) => a - b);
    alvo.innerHTML = periodos.map((p) => `
      <div class="periodo-group">
        <div class="periodo-group-label">${p}º período</div>
        <div class="list">${porPeriodo[p].map(disciplinaRowHtml).join("")}</div>
      </div>`).join("");
    alvo.querySelectorAll(".list-row").forEach((row) => {
      row.addEventListener("click", () => { location.hash = `#/disciplinas/${row.dataset.id}`; });
    });
  }

  container.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      disciplinasViewMode = btn.dataset.mode;
      renderDisciplinasLista(container);
    });
  });
  container.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      disciplinasFiltroStatus = btn.dataset.status;
      renderDisciplinasLista(container);
    });
  });
  const busca = container.querySelector("#busca-disciplina");
  if (busca) {
    busca.addEventListener("input", () => {
      disciplinasBusca = busca.value;
      renderDisciplinasConteudo(container, todasDisciplinas);
    });
  }
}

function disciplinaRowHtml(d) {
  return `<div class="list-row" data-id="${d.id}">
    <span class="disciplina-row-color" style="background:${d.cor || "var(--text-faint)"}"></span>
    <div class="list-row-main">
      <div class="list-row-title">${d.nome}</div>
      <div class="list-row-sub">${d.codigo || "Sem código"}${d.professor ? " · " + d.professor : ""}</div>
    </div>
    <div class="list-row-meta">
      <span class="badge ${STATUS_DISC_BADGE[d.status] || ""}">${STATUS_DISC_LABEL[d.status] || d.status}</span>
      <span>${d.media != null ? d.media.toFixed(1) : "—"}</span>
    </div>
  </div>`;
}

/* ---------- Formulário criar/editar disciplina ---------- */
async function abrirFormDisciplina(disciplina = null) {
  const todasDisciplinas = await Api.listarDisciplinas();
  const opcoesPrereq = todasDisciplinas
    .filter((d) => !disciplina || d.id !== disciplina.id)
    .map((d) => `<option value="${d.id}" ${disciplina && (disciplina.pre_requisitos || []).some((p) => p.id === d.id) ? "selected" : ""}>${d.nome}</option>`)
    .join("");

  UI.openModal({
    title: disciplina ? "Editar matéria" : "Nova matéria",
    bodyHtml: `
      <form id="form-disciplina">
        <div class="field"><label for="f-nome">Nome *</label><input id="f-nome" required value="${disciplina?.nome || ""}"></div>
        <div class="field-row">
          <div class="field"><label for="f-codigo">Código</label><input id="f-codigo" value="${disciplina?.codigo || ""}"></div>
          <div class="field"><label for="f-periodo">Período</label><input id="f-periodo" type="number" min="1" value="${disciplina?.periodo || 1}"></div>
        </div>
        <div class="field"><label for="f-professor">Professor</label><input id="f-professor" value="${disciplina?.professor || ""}"></div>
        <div class="field-row">
          <div class="field"><label for="f-carga">Carga horária</label><input id="f-carga" type="number" value="${disciplina?.carga_horaria ?? ""}"></div>
          <div class="field"><label for="f-creditos">Créditos</label><input id="f-creditos" type="number" value="${disciplina?.creditos ?? ""}"></div>
        </div>
        <div class="field"><label for="f-sala">Sala</label><input id="f-sala" value="${disciplina?.sala || ""}"></div>
        <div class="field"><label for="f-status">Status</label>
          <select id="f-status">
            ${Object.entries(STATUS_DISC_LABEL).map(([v, l]) => `<option value="${v}" ${disciplina?.status === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label for="f-media">Média</label><input id="f-media" type="number" step="0.1" min="0" max="10" value="${disciplina?.media ?? ""}"></div>
          <div class="field"><label for="f-frequencia">Frequência (%)</label><input id="f-frequencia" type="number" step="0.1" min="0" max="100" value="${disciplina?.frequencia ?? ""}"></div>
        </div>
        <div class="field"><label for="f-cor">Cor de identificação</label><input id="f-cor" type="color" value="${disciplina?.cor || "#2563eb"}"></div>
        <div class="field"><label for="f-prereq">Pré-requisitos</label>
          <select id="f-prereq" multiple size="4">${opcoesPrereq}</select>
        </div>
        <div class="field"><label for="f-obs">Observações</label><textarea id="f-obs">${disciplina?.observacoes || ""}</textarea></div>
      </form>
    `,
    actionsHtml: `
      ${disciplina ? `<button class="btn btn-danger" id="btn-excluir-disciplina">Excluir</button>` : ""}
      <button class="btn btn-primary" id="btn-salvar-disciplina">Salvar</button>
    `,
  });

  document.getElementById("btn-salvar-disciplina").addEventListener("click", async () => {
    const dados = {
      nome: document.getElementById("f-nome").value.trim(),
      codigo: document.getElementById("f-codigo").value.trim(),
      periodo: document.getElementById("f-periodo").value,
      professor: document.getElementById("f-professor").value.trim(),
      carga_horaria: document.getElementById("f-carga").value,
      creditos: document.getElementById("f-creditos").value,
      sala: document.getElementById("f-sala").value.trim(),
      status: document.getElementById("f-status").value,
      media: document.getElementById("f-media").value,
      frequencia: document.getElementById("f-frequencia").value,
      cor: document.getElementById("f-cor").value,
      observacoes: document.getElementById("f-obs").value.trim(),
      pre_requisitos: Array.from(document.getElementById("f-prereq").selectedOptions).map((o) => o.value),
    };
    if (!dados.nome) { UI.showToast("Informe o nome da matéria."); return; }
    try {
      if (disciplina) await Api.atualizarDisciplina(disciplina.id, dados);
      else await Api.criarDisciplina(dados);
      UI.closeModal();
      UI.showToast("Matéria salva.");
      App.refresh();
    } catch (e) { UI.showToast(e.message); }
  });

  const btnExcluir = document.getElementById("btn-excluir-disciplina");
  if (btnExcluir) {
    btnExcluir.addEventListener("click", async () => {
      if (!UI.confirmar("Excluir esta matéria e todos os dados relacionados?")) return;
      try {
        await Api.excluirDisciplina(disciplina.id);
        UI.closeModal();
        UI.showToast("Matéria excluída.");
        location.hash = "#/disciplinas";
      } catch (e) { UI.showToast(e.message); }
    });
  }
}

/* ---------- Detalhe da disciplina ---------- */
const DISC_TABS = ["Resumo", "Notas", "Conteúdos", "Avaliações", "Tarefas", "Estudos"];
let discTabAtiva = "Resumo";

async function renderDisciplinaDetail(container, id) {
  const d = await Api.obterDisciplina(id);
  discTabAtiva = discTabAtiva || "Resumo";

  container.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="btn-voltar">${icon("arrowLeft")} Matérias</button>
    <div class="page-header" style="margin-top:var(--space-3);">
      <div>
        <h1>${d.nome}</h1>
        <p class="page-subtitle" style="margin-bottom:0;">${d.codigo || "Sem código"} · ${d.periodo}º período</p>
      </div>
      <button class="btn btn-sm" id="btn-editar-disciplina">${icon("edit")} Editar</button>
    </div>
    <span class="badge ${STATUS_DISC_BADGE[d.status] || ""}" style="margin:var(--space-3) 0; display:inline-flex;">${STATUS_DISC_LABEL[d.status] || d.status}</span>

    <div class="tabs">
      ${DISC_TABS.map((t) => `<button class="tab-btn ${t === discTabAtiva ? "active" : ""}" data-tab="${t}">${t}</button>`).join("")}
    </div>

    <div id="disc-tab-content"></div>
  `;

  container.querySelector("#btn-voltar").addEventListener("click", () => { location.hash = "#/disciplinas"; });
  container.querySelector("#btn-editar-disciplina").addEventListener("click", () => abrirFormDisciplina(d));
  container.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      discTabAtiva = btn.dataset.tab;
      renderDisciplinaDetail(container, id);
    });
  });

  const tabContent = container.querySelector("#disc-tab-content");
  if (discTabAtiva === "Resumo") await renderTabResumo(tabContent, d);
  else if (discTabAtiva === "Notas") await renderTabNotas(tabContent, d);
  else if (discTabAtiva === "Conteúdos") await renderTabConteudos(tabContent, d);
  else if (discTabAtiva === "Avaliações") await renderTabAvaliacoesDisciplina(tabContent, d);
  else if (discTabAtiva === "Tarefas") await renderTabTarefasDisciplina(tabContent, d);
  else if (discTabAtiva === "Estudos") await renderTabEstudosDisciplina(tabContent, d);
}

async function renderTabResumo(container, d) {
  const horarios = (d.horarios || []).map((h) => `${DIAS_SEMANA[h.dia_semana]} ${h.hora_inicio || ""}-${h.hora_fim || ""}`).join(", ") || "—";
  const prereqs = (d.pre_requisitos || []).map((p) => `${p.nome} (${p.status === "concluida" ? "concluída" : "pendente"})`).join(", ") || "Nenhum";
  container.innerHTML = `
    <div class="panel">
      <dl style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--space-4); margin:0;">
        ${infoRow("Professor", d.professor || "—")}
        ${infoRow("Carga horária", d.carga_horaria ? `${d.carga_horaria}h` : "—")}
        ${infoRow("Créditos", d.creditos ?? "—")}
        ${infoRow("Sala", d.sala || "—")}
        ${infoRow("Horário", horarios)}
        ${infoRow("Média", d.media != null ? d.media.toFixed(1) : "—")}
        ${infoRow("Frequência", d.frequencia != null ? d.frequencia + "%" : "—")}
        ${infoRow("Pré-requisitos", prereqs)}
      </dl>
      ${d.observacoes ? `<div class="divider"></div><div><div class="list-row-sub" style="margin-bottom:4px;">Observações</div><p style="margin:0;">${d.observacoes}</p></div>` : ""}
    </div>
  `;
}

function infoRow(label, value) {
  return `<div><div class="list-row-sub" style="margin-bottom:2px;">${label}</div><div style="font-weight:500;">${value}</div></div>`;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ---------- Aba Notas: calculadora "quanto preciso tirar?" ---------- */
async function renderTabNotas(container, d) {
  const avaliacoes = await Api.listarAvaliacoes({ disciplina_id: d.id });
  container.innerHTML = `
    <div class="section">
      <div class="section-header"><h2>Notas lançadas</h2></div>
      ${avaliacoes.length ? `<table class="data-table"><thead><tr><th>Avaliação</th><th>Peso</th><th>Nota</th></tr></thead>
        <tbody>${avaliacoes.map((a) => `<tr><td>${a.titulo}</td><td>${a.peso}</td><td>${a.nota ?? "—"}</td></tr>`).join("")}</tbody></table>`
        : `<p class="empty-state">Nenhuma avaliação com nota lançada ainda.</p>`}
      <p style="margin-top:var(--space-3);">Média atual: <strong>${d.media != null ? d.media.toFixed(2) : "—"}</strong></p>
    </div>

    <div class="section">
      <div class="section-header"><h2>Quanto preciso tirar?</h2></div>
      <div class="panel">
        <p class="field-hint" style="margin-top:0;">Informe a média desejada e o peso das avaliações que faltam para calcular a nota necessária.</p>
        <div class="field-row">
          <div class="field"><label for="fn-meta">Média desejada</label><input id="fn-meta" type="number" step="0.1" min="0" max="10" value="7"></div>
          <div class="field"><label for="fn-peso-restante">Peso restante</label><input id="fn-peso-restante" type="number" step="0.1" value="${somaPesoPendente(avaliacoes) || 1}"></div>
        </div>
        <button class="btn btn-primary" id="btn-calcular-nota">Calcular</button>
        <div id="resultado-nota" style="margin-top:var(--space-4);"></div>
      </div>
    </div>
  `;

  container.querySelector("#btn-calcular-nota").addEventListener("click", () => {
    const metaDesejada = parseFloat(document.getElementById("fn-meta").value);
    const pesoRestante = parseFloat(document.getElementById("fn-peso-restante").value) || 0;
    const lancadas = avaliacoes.filter((a) => a.nota != null);
    const pesoLancado = lancadas.reduce((s, a) => s + (a.peso || 1), 0);
    const somaLancada = lancadas.reduce((s, a) => s + (a.nota || 0) * (a.peso || 1), 0);
    const pesoTotal = pesoLancado + pesoRestante;
    const resultado = document.getElementById("resultado-nota");
    if (pesoRestante <= 0 || pesoTotal <= 0) {
      resultado.innerHTML = `<p class="empty-state">Adicione um peso válido para a(s) avaliação(ões) restante(s).</p>`;
      return;
    }
    const necessario = (metaDesejada * pesoTotal - somaLancada) / pesoRestante;
    const atingivel = necessario <= 10;
    resultado.innerHTML = `<div class="notas-result">
      <div class="field-hint">Para terminar com ${metaDesejada.toFixed(1)}, você precisa tirar:</div>
      <div class="notas-big" style="color:${atingivel ? "var(--success)" : "var(--danger)"}">${necessario.toFixed(1)}</div>
      ${!atingivel ? `<div class="field-hint">Não é matematicamente possível com o peso informado.</div>` : ""}
    </div>`;
  });
}

function somaPesoPendente(avaliacoes) {
  return avaliacoes.filter((a) => a.nota == null).reduce((s, a) => s + (a.peso || 1), 0);
}

/* ---------- Aba Conteúdos ---------- */
const STATUS_CONTEUDO_LABEL = { pendente: "Pendente", andamento: "Em andamento", concluido: "Concluído" };

async function renderTabConteudos(container, d) {
  const conteudos = await Api.listarConteudos({ disciplina_id: d.id });
  container.innerHTML = `
    <div class="page-header"><h2>Conteúdo programático</h2><button class="btn btn-sm" id="btn-novo-conteudo">${icon("plus")} Novo</button></div>
    ${conteudos.length ? `<div class="list">
      ${conteudos.map((c) => `
        <div class="list-row" style="cursor:default;">
          <input type="checkbox" class="list-row-checkbox" data-conteudo="${c.id}" ${c.status === "concluido" ? "checked" : ""}>
          <div class="list-row-main">
            <div class="list-row-title" style="${c.status === "concluido" ? "text-decoration:line-through; color:var(--text-muted);" : ""}">${c.titulo}</div>
            <div class="list-row-sub">${STATUS_CONTEUDO_LABEL[c.status]}</div>
          </div>
          <button class="icon-btn" data-editar-conteudo="${c.id}" aria-label="Editar conteúdo">${icon("edit")}</button>
        </div>`).join("")}
    </div>` : `<p class="empty-state">Nenhum conteúdo cadastrado.</p>`}
  `;

  container.querySelector("#btn-novo-conteudo").addEventListener("click", () => abrirFormConteudo(d.id));
  container.querySelectorAll("[data-conteudo]").forEach((chk) => {
    chk.addEventListener("change", async () => {
      const c = conteudos.find((x) => String(x.id) === chk.dataset.conteudo);
      try {
        await Api.atualizarConteudo(c.id, { ...c, status: chk.checked ? "concluido" : "pendente" });
        App.refresh();
      } catch (e) { UI.showToast(e.message); }
    });
  });
  container.querySelectorAll("[data-editar-conteudo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = conteudos.find((x) => String(x.id) === btn.dataset.editarConteudo);
      abrirFormConteudo(d.id, c);
    });
  });
}

function abrirFormConteudo(disciplinaId, conteudo = null) {
  UI.openModal({
    title: conteudo ? "Editar conteúdo" : "Novo conteúdo",
    bodyHtml: `
      <form id="form-conteudo">
        <div class="field"><label for="fc-titulo">Título *</label><input id="fc-titulo" required value="${conteudo?.titulo || ""}"></div>
        <div class="field-row">
          <div class="field"><label for="fc-status">Status</label>
            <select id="fc-status">${Object.entries(STATUS_CONTEUDO_LABEL).map(([v, l]) => `<option value="${v}" ${(conteudo?.status || "pendente") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="fc-ordem">Ordem</label><input id="fc-ordem" type="number" value="${conteudo?.ordem ?? 0}"></div>
        </div>
      </form>
    `,
    actionsHtml: `
      ${conteudo ? `<button class="btn btn-danger" id="btn-excluir-conteudo">Excluir</button>` : ""}
      <button class="btn btn-primary" id="btn-salvar-conteudo">Salvar</button>
    `,
  });

  document.getElementById("btn-salvar-conteudo").addEventListener("click", async () => {
    const dados = {
      disciplina_id: disciplinaId,
      titulo: document.getElementById("fc-titulo").value.trim(),
      status: document.getElementById("fc-status").value,
      ordem: document.getElementById("fc-ordem").value,
    };
    if (!dados.titulo) { UI.showToast("Informe o título."); return; }
    try {
      if (conteudo) await Api.atualizarConteudo(conteudo.id, dados);
      else await Api.criarConteudo(dados);
      UI.closeModal();
      UI.showToast("Conteúdo salvo.");
      App.refresh();
    } catch (e) { UI.showToast(e.message); }
  });

  const btnExcluir = document.getElementById("btn-excluir-conteudo");
  if (btnExcluir) {
    btnExcluir.addEventListener("click", async () => {
      if (!UI.confirmar("Excluir este conteúdo?")) return;
      try {
        await Api.excluirConteudo(conteudo.id);
        UI.closeModal();
        App.refresh();
      } catch (e) { UI.showToast(e.message); }
    });
  }
}

/* ---------- Aba Avaliações da disciplina ---------- */
async function renderTabAvaliacoesDisciplina(container, d) {
  const avaliacoes = await Api.listarAvaliacoes({ disciplina_id: d.id });
  container.innerHTML = `
    <div class="page-header"><h2>Avaliações</h2><button class="btn btn-sm" id="btn-nova-aval-disc">${icon("plus")} Nova</button></div>
    <div class="list">${avaliacoes.length ? avaliacoes.map((a) => avaliacaoRowHtml(a)).join("") : `<p class="empty-state">Nenhuma avaliação cadastrada.</p>`}</div>
  `;
  container.querySelector("#btn-nova-aval-disc").addEventListener("click", () => abrirFormAvaliacao(null, d.id));
  container.querySelectorAll(".list-row[data-id]").forEach((row) => row.addEventListener("click", () => {
    const a = avaliacoes.find((x) => String(x.id) === row.dataset.id);
    abrirFormAvaliacao(a);
  }));
}

/* ---------- Aba Tarefas da disciplina ---------- */
async function renderTabTarefasDisciplina(container, d) {
  const tarefas = await Api.listarTarefas({ disciplina_id: d.id });
  container.innerHTML = `
    <div class="page-header"><h2>Tarefas</h2><button class="btn btn-sm" id="btn-nova-tarefa-disc">${icon("plus")} Nova</button></div>
    <div class="list">${tarefas.length ? tarefas.map((t) => tarefaRowHtml(t)).join("") : `<p class="empty-state">Nenhuma tarefa cadastrada.</p>`}</div>
  `;
  container.querySelector("#btn-nova-tarefa-disc").addEventListener("click", () => abrirFormTarefa(null, d.id));
  container.querySelectorAll(".list-row[data-id]").forEach((row) => row.addEventListener("click", () => {
    const t = tarefas.find((x) => String(x.id) === row.dataset.id);
    abrirFormTarefa(t);
  }));
}

/* ---------- Aba Estudos da disciplina ---------- */
async function renderTabEstudosDisciplina(container, d) {
  const sessoes = await Api.listarEstudos({ disciplina_id: d.id });
  const totalMin = sessoes.reduce((s, x) => s + x.duracao_min, 0);
  container.innerHTML = `
    <div class="stat-line" style="margin-bottom:var(--space-4);">
      <div class="stat-item"><span class="stat-value">${(totalMin / 60).toFixed(1)}h</span><span class="stat-label">estudadas nesta matéria</span></div>
    </div>
    <div class="page-header"><h2>Sessões</h2><button class="btn btn-sm" id="btn-novo-estudo-disc">${icon("plus")} Registrar</button></div>
    ${sessoes.length ? `<div class="list">
      ${sessoes.map((s) => `
        <div class="list-row" style="cursor:default;">
          <div class="list-row-main">
            <div class="list-row-title">${s.tipo}</div>
            <div class="list-row-sub">${s.observacoes || ""}</div>
          </div>
          <div class="list-row-meta">${formatarData(s.data)} · ${s.duracao_min} min</div>
        </div>`).join("")}
    </div>` : `<p class="empty-state">Nenhuma sessão de estudo registrada.</p>`}
  `;
  container.querySelector("#btn-novo-estudo-disc").addEventListener("click", () => abrirFormEstudo(d.id));
}
