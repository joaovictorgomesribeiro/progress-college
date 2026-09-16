/* Meu Sistema de Estudos - Avaliações */

const TIPO_AVAL_LABEL = { prova: "Prova", trabalho: "Trabalho", lista: "Lista", seminario: "Seminário", projeto: "Projeto" };
const PRIORIDADE_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" };
const PRIORIDADE_BADGE = { alta: "badge-danger", media: "badge-warning", baixa: "badge-neutral" };
let avaliacoesFiltroStatus = "";

registerPage("avaliacoes", {
  async render(container) {
    const avaliacoes = await Api.listarAvaliacoes(avaliacoesFiltroStatus ? { status: avaliacoesFiltroStatus } : {});

    container.innerHTML = `
      <div class="page-header">
        <h1>Avaliações</h1>
        <button class="btn btn-primary btn-sm" id="btn-nova-avaliacao">${icon("plus")} Nova avaliação</button>
      </div>
      <div class="filter-row">
        ${["", "pendente", "concluida"].map((s) => `
          <button class="filter-chip ${avaliacoesFiltroStatus === s ? "active" : ""}" data-status="${s}">
            ${s === "" ? "Todas" : s === "pendente" ? "Pendentes" : "Concluídas"}
          </button>`).join("")}
      </div>

      <div class="list">
        ${avaliacoes.length ? avaliacoes.map((a) => avaliacaoRowHtml(a)).join("") : `<p class="empty-state">Nenhuma avaliação cadastrada.</p>`}
      </div>
    `;

    container.querySelectorAll("[data-status]").forEach((btn) => btn.addEventListener("click", () => {
      avaliacoesFiltroStatus = btn.dataset.status;
      App.refresh();
    }));
    container.querySelector("#btn-nova-avaliacao").addEventListener("click", () => abrirFormAvaliacao());
    container.querySelectorAll(".list-row[data-id]").forEach((row) => row.addEventListener("click", () => {
      const a = avaliacoes.find((x) => String(x.id) === row.dataset.id);
      abrirFormAvaliacao(a);
    }));
  },
});

function avaliacaoRowHtml(a) {
  const dias = a.data ? diasRestantes(a.data) : null;
  let prazoTexto = "Sem data";
  if (dias !== null) prazoTexto = dias >= 0 ? `Faltam ${dias} dia(s)` : `Há ${-dias} dia(s)`;
  return `<div class="list-row" data-id="${a.id}">
    <div class="list-row-main">
      <div class="list-row-title">${a.titulo}</div>
      <div class="list-row-sub">${a.disciplina_nome} · ${TIPO_AVAL_LABEL[a.tipo] || a.tipo}</div>
    </div>
    <div class="list-row-meta">
      <span class="badge ${PRIORIDADE_BADGE[a.prioridade]}">${PRIORIDADE_LABEL[a.prioridade]}</span>
      <span class="badge ${a.status === "concluida" ? "badge-success" : "badge-neutral"}">${a.status === "concluida" ? "Concluída" : "Pendente"}</span>
      <span style="min-width:90px; display:inline-block; text-align:right;">${formatarData(a.data)}</span>
    </div>
  </div>`;
}

function diasRestantes(dataIso) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataIso + "T00:00:00");
  return Math.round((alvo - hoje) / 86400000);
}

function formatarData(dataIso) {
  if (!dataIso) return "—";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function abrirFormAvaliacao(avaliacao = null, disciplinaIdFixo = null) {
  const disciplinas = await Api.listarDisciplinas();

  if (!disciplinas.length) {
    UI.openModal({
      title: "Nenhuma matéria cadastrada",
      bodyHtml: `<p class="empty-state">Toda avaliação pertence a uma matéria. Cadastre sua primeira matéria antes de criar uma avaliação.</p>`,
      actionsHtml: `<button class="btn btn-primary" id="btn-ir-cadastrar-materia">Nova matéria</button>`,
    });
    document.getElementById("btn-ir-cadastrar-materia").addEventListener("click", () => {
      UI.closeModal();
      location.hash = "#/disciplinas";
    });
    return;
  }

  const discSelecionada = avaliacao?.disciplina_id || disciplinaIdFixo;

  UI.openModal({
    title: avaliacao ? "Editar avaliação" : "Nova avaliação",
    bodyHtml: `
      <form id="form-avaliacao">
        <div class="field"><label for="fa-disciplina">Matéria *</label>
          <select id="fa-disciplina" ${disciplinaIdFixo ? "disabled" : ""}>
            ${disciplinas.map((d) => `<option value="${d.id}" ${discSelecionada === d.id ? "selected" : ""}>${d.nome}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label for="fa-titulo">Título *</label><input id="fa-titulo" required value="${avaliacao?.titulo || ""}"></div>
        <div class="field-row">
          <div class="field"><label for="fa-tipo">Tipo</label>
            <select id="fa-tipo">${Object.entries(TIPO_AVAL_LABEL).map(([v, l]) => `<option value="${v}" ${avaliacao?.tipo === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="fa-data">Data</label><input id="fa-data" type="date" value="${avaliacao?.data || ""}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="fa-peso">Peso</label><input id="fa-peso" type="number" step="0.1" value="${avaliacao?.peso ?? 1}"></div>
          <div class="field"><label for="fa-nota">Nota</label><input id="fa-nota" type="number" step="0.1" min="0" max="10" value="${avaliacao?.nota ?? ""}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="fa-prioridade">Prioridade</label>
            <select id="fa-prioridade">${Object.entries(PRIORIDADE_LABEL).map(([v, l]) => `<option value="${v}" ${(avaliacao?.prioridade || "media") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="fa-status">Status</label>
            <select id="fa-status"><option value="pendente" ${avaliacao?.status !== "concluida" ? "selected" : ""}>Pendente</option><option value="concluida" ${avaliacao?.status === "concluida" ? "selected" : ""}>Concluída</option></select>
          </div>
        </div>
        <div class="field"><label for="fa-obs">Observações</label><textarea id="fa-obs">${avaliacao?.observacoes || ""}</textarea></div>
      </form>
    `,
    actionsHtml: `
      ${avaliacao ? `<button class="btn btn-danger" id="btn-excluir-avaliacao">Excluir</button>` : ""}
      <button class="btn btn-primary" id="btn-salvar-avaliacao">Salvar</button>
    `,
  });

  document.getElementById("btn-salvar-avaliacao").addEventListener("click", async () => {
    const dados = {
      disciplina_id: document.getElementById("fa-disciplina").value,
      titulo: document.getElementById("fa-titulo").value.trim(),
      tipo: document.getElementById("fa-tipo").value,
      data: document.getElementById("fa-data").value,
      peso: document.getElementById("fa-peso").value,
      nota: document.getElementById("fa-nota").value,
      prioridade: document.getElementById("fa-prioridade").value,
      status: document.getElementById("fa-status").value,
      observacoes: document.getElementById("fa-obs").value.trim(),
    };
    if (!dados.titulo) { UI.showToast("Informe o título."); return; }
    try {
      if (avaliacao) await Api.atualizarAvaliacao(avaliacao.id, dados);
      else await Api.criarAvaliacao(dados);
      UI.closeModal();
      UI.showToast("Avaliação salva.");
      App.refresh();
    } catch (e) { UI.showToast(e.message); }
  });

  const btnExcluir = document.getElementById("btn-excluir-avaliacao");
  if (btnExcluir) {
    btnExcluir.addEventListener("click", async () => {
      if (!UI.confirmar("Excluir esta avaliação?")) return;
      try {
        await Api.excluirAvaliacao(avaliacao.id);
        UI.closeModal();
        UI.showToast("Avaliação excluída.");
        App.refresh();
      } catch (e) { UI.showToast(e.message); }
    });
  }
}
