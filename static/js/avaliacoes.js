/* Meu Sistema de Estudos - Avaliações */

const TIPO_AVAL_LABEL = { prova: "Prova", trabalho: "Trabalho", lista: "Lista", seminario: "Seminário", projeto: "Projeto" };
const TIPO_AVAL_ICON = { prova: "📄", trabalho: "📦", lista: "📋", seminario: "🎤", projeto: "🛠️" };
const PRIORIDADE_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" };
const PRIORIDADE_BADGE = { alta: "badge-danger", media: "badge-warning", baixa: "badge-info" };
let avaliacoesViewMode = "cards";
let avaliacoesFiltroStatus = "";

registerPage("avaliacoes", {
  async render(container) {
    const disciplinas = await Api.listarDisciplinas();
    const avaliacoes = await Api.listarAvaliacoes(avaliacoesFiltroStatus ? { status: avaliacoesFiltroStatus } : {});

    container.innerHTML = `
      <div class="section-title">
        <h1>Avaliações</h1>
        <div class="view-toggle">
          <button data-mode="cards" class="${avaliacoesViewMode === "cards" ? "active" : ""}">▦ Cards</button>
          <button data-mode="table" class="${avaliacoesViewMode === "table" ? "active" : ""}">☷ Tabela</button>
        </div>
      </div>
      <div class="tabs">
        ${["", "pendente", "concluida"].map((s) => `
          <button class="tab-btn ${avaliacoesFiltroStatus === s ? "active" : ""}" data-status="${s}">
            ${s === "" ? "Todas" : s === "pendente" ? "Pendentes" : "Concluídas"}
          </button>`).join("")}
      </div>
      <button class="btn btn-primary btn-block" id="btn-nova-avaliacao" style="margin-bottom:16px;">+ Nova avaliação</button>

      ${avaliacoes.length ? "" : emptyState("📝", "Nenhuma avaliação cadastrada.")}

      <div id="aval-cards" class="cards-grid" ${avaliacoesViewMode === "cards" ? "" : "hidden"}>
        ${avaliacoes.map((a) => avaliacaoCardHtml(a, disciplinas)).join("")}
      </div>
      <div id="aval-table" class="scroll-x" ${avaliacoesViewMode === "table" ? "" : "hidden"}>
        <table class="data-table">
          <thead><tr><th>Matéria</th><th>Tipo</th><th>Título</th><th>Data</th><th>Peso</th><th>Nota</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${avaliacoes.map((a) => `
              <tr>
                <td>${a.disciplina_nome}</td>
                <td>${TIPO_AVAL_LABEL[a.tipo] || a.tipo}</td>
                <td>${a.titulo}</td>
                <td>${formatarData(a.data)}</td>
                <td>${a.peso}</td>
                <td>${a.nota ?? "—"}</td>
                <td><span class="badge ${a.status === "concluida" ? "badge-success" : "badge-warning"}">${a.status === "concluida" ? "Concluída" : "Pendente"}</span></td>
                <td><button class="btn btn-sm" data-editar="${a.id}">Editar</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => {
      avaliacoesViewMode = btn.dataset.mode;
      App.refresh();
    }));
    container.querySelectorAll("[data-status]").forEach((btn) => btn.addEventListener("click", () => {
      avaliacoesFiltroStatus = btn.dataset.status;
      App.refresh();
    }));
    container.querySelector("#btn-nova-avaliacao").addEventListener("click", () => abrirFormAvaliacao());
    container.querySelectorAll("[data-editar]").forEach((btn) => btn.addEventListener("click", async () => {
      const a = avaliacoes.find((x) => String(x.id) === btn.dataset.editar);
      abrirFormAvaliacao(a);
    }));
    container.querySelectorAll(".aval-card").forEach((card) => card.addEventListener("click", async () => {
      const a = avaliacoes.find((x) => String(x.id) === card.dataset.id);
      abrirFormAvaliacao(a);
    }));
  },
});

function avaliacaoCardHtml(a) {
  const dias = a.data ? diasRestantes(a.data) : null;
  return `<div class="card aval-card" data-id="${a.id}" role="button" tabindex="0">
    <div class="disciplina-top">
      <span style="font-size:22px;">${TIPO_AVAL_ICON[a.tipo] || "📄"}</span>
      <div>
        <h3>${a.titulo}</h3>
        <div class="disciplina-meta"><span>${a.disciplina_nome}</span><span class="badge ${PRIORIDADE_BADGE[a.prioridade]}">${PRIORIDADE_LABEL[a.prioridade]}</span></div>
      </div>
    </div>
    <div class="disciplina-numeros">
      <div><div class="num-label">Data</div><div class="num-value" style="font-size:14px;">${formatarData(a.data)}</div></div>
      <div><div class="num-label">Peso</div><div class="num-value" style="font-size:14px;">${a.peso}</div></div>
      <div><div class="num-label">Nota</div><div class="num-value" style="font-size:14px;">${a.nota ?? "—"}</div></div>
    </div>
    <div class="disciplina-meta">
      <span class="badge ${a.status === "concluida" ? "badge-success" : "badge-warning"}">${a.status === "concluida" ? "Concluída" : "Pendente"}</span>
      <span>${dias !== null ? (dias >= 0 ? `Faltam ${dias} dia(s)` : `Há ${-dias} dia(s)`) : ""}</span>
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
      bodyHtml: `<div class="empty-state">
        <span class="empty-emoji">📚</span>
        Toda avaliação pertence a uma matéria. Cadastre sua primeira matéria antes de criar uma avaliação.
      </div>`,
      actionsHtml: `<button class="btn btn-primary" id="btn-ir-cadastrar-materia">+ Nova matéria</button>`,
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
