/* Meu Sistema de Estudos - Tarefas */

const STATUS_TAREFA_LABEL = { pendente: "Pendente", andamento: "Em andamento", concluida: "Concluída" };
const STATUS_TAREFA_BADGE = { pendente: "badge-neutral", andamento: "badge-info", concluida: "badge-success" };
let tarefasFiltroStatus = "";

registerPage("tarefas", {
  onFab() { abrirFormTarefa(); },
  async render(container) {
    const tarefas = await Api.listarTarefas(tarefasFiltroStatus ? { status: tarefasFiltroStatus } : {});

    container.innerHTML = `
      <div class="page-header">
        <h1>Tarefas</h1>
        <button class="btn btn-primary btn-sm" id="btn-nova-tarefa">${icon("plus")} Nova tarefa</button>
      </div>
      <div class="filter-row">
        ${["", "pendente", "andamento", "concluida"].map((s) => `
          <button class="filter-chip ${tarefasFiltroStatus === s ? "active" : ""}" data-status="${s}">
            ${s === "" ? "Todas" : STATUS_TAREFA_LABEL[s]}
          </button>`).join("")}
      </div>

      <div class="list">
        ${tarefas.length ? tarefas.map(tarefaRowHtml).join("") : `<p class="empty-state">Você ainda não possui tarefas.</p>`}
      </div>
    `;

    container.querySelector("#btn-nova-tarefa").addEventListener("click", () => abrirFormTarefa());
    container.querySelectorAll("[data-status]").forEach((btn) => btn.addEventListener("click", () => {
      tarefasFiltroStatus = btn.dataset.status;
      App.refresh();
    }));
    container.querySelectorAll(".list-row[data-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-toggle-status]")) return;
        const t = tarefas.find((x) => String(x.id) === row.dataset.id);
        abrirFormTarefa(t);
      });
    });
    container.querySelectorAll("[data-toggle-status]").forEach((chk) => {
      chk.addEventListener("change", async () => {
        const t = tarefas.find((x) => String(x.id) === chk.dataset.toggleStatus);
        try {
          await Api.atualizarTarefa(t.id, { ...t, status: chk.checked ? "concluida" : "pendente" });
          App.refresh();
        } catch (e) { UI.showToast(e.message); }
      });
    });
  },
});

function tarefaRowHtml(t) {
  const dias = t.prazo ? diasRestantes(t.prazo) : null;
  const atrasada = dias !== null && dias < 0 && t.status !== "concluida";
  return `<div class="list-row" data-id="${t.id}">
    <input type="checkbox" class="list-row-checkbox" data-toggle-status="${t.id}" ${t.status === "concluida" ? "checked" : ""}>
    <div class="list-row-main">
      <div class="list-row-title" style="${t.status === "concluida" ? "text-decoration:line-through; color:var(--text-muted);" : ""}">${t.nome}</div>
      <div class="list-row-sub">${t.disciplina_nome || "Geral"}</div>
    </div>
    <div class="list-row-meta">
      <span class="badge ${PRIORIDADE_BADGE[t.prioridade]}">${PRIORIDADE_LABEL[t.prioridade]}</span>
      <span class="badge ${STATUS_TAREFA_BADGE[t.status]}">${STATUS_TAREFA_LABEL[t.status]}</span>
      <span style="min-width:78px; display:inline-block; text-align:right; color:${atrasada ? "var(--danger)" : "inherit"};">${t.prazo ? formatarData(t.prazo) : "Sem prazo"}</span>
    </div>
  </div>`;
}

async function abrirFormTarefa(tarefa = null, disciplinaIdFixo = null) {
  const disciplinas = await Api.listarDisciplinas();
  const discSelecionada = tarefa?.disciplina_id || disciplinaIdFixo || "";

  UI.openModal({
    title: tarefa ? "Editar tarefa" : "Nova tarefa",
    bodyHtml: `
      <form id="form-tarefa">
        <div class="field"><label for="ft-nome">Nome *</label><input id="ft-nome" required value="${tarefa?.nome || ""}"></div>
        <div class="field"><label for="ft-disciplina">Matéria</label>
          <select id="ft-disciplina" ${disciplinaIdFixo ? "disabled" : ""}>
            <option value="">Geral (sem matéria)</option>
            ${disciplinas.map((d) => `<option value="${d.id}" ${String(discSelecionada) === String(d.id) ? "selected" : ""}>${d.nome}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label for="ft-descricao">Descrição</label><textarea id="ft-descricao">${tarefa?.descricao || ""}</textarea></div>
        <div class="field-row">
          <div class="field"><label for="ft-prazo">Prazo</label><input id="ft-prazo" type="date" value="${tarefa?.prazo || ""}"></div>
          <div class="field"><label for="ft-tempo">Tempo estimado (h)</label><input id="ft-tempo" type="number" step="0.5" value="${tarefa?.tempo_estimado ?? ""}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="ft-prioridade">Prioridade</label>
            <select id="ft-prioridade">${Object.entries(PRIORIDADE_LABEL).map(([v, l]) => `<option value="${v}" ${(tarefa?.prioridade || "media") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="ft-status">Status</label>
            <select id="ft-status">${Object.entries(STATUS_TAREFA_LABEL).map(([v, l]) => `<option value="${v}" ${(tarefa?.status || "pendente") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field"><label for="ft-obs">Observações</label><textarea id="ft-obs">${tarefa?.observacoes || ""}</textarea></div>
      </form>
    `,
    actionsHtml: `
      ${tarefa ? `<button class="btn btn-danger" id="btn-excluir-tarefa">Excluir</button>` : ""}
      <button class="btn btn-primary" id="btn-salvar-tarefa">Salvar</button>
    `,
  });

  document.getElementById("btn-salvar-tarefa").addEventListener("click", async () => {
    const dados = {
      nome: document.getElementById("ft-nome").value.trim(),
      disciplina_id: document.getElementById("ft-disciplina").value || null,
      descricao: document.getElementById("ft-descricao").value.trim(),
      prazo: document.getElementById("ft-prazo").value,
      tempo_estimado: document.getElementById("ft-tempo").value,
      prioridade: document.getElementById("ft-prioridade").value,
      status: document.getElementById("ft-status").value,
      observacoes: document.getElementById("ft-obs").value.trim(),
    };
    if (!dados.nome) { UI.showToast("Informe o nome da tarefa."); return; }
    try {
      if (tarefa) await Api.atualizarTarefa(tarefa.id, dados);
      else await Api.criarTarefa(dados);
      UI.closeModal();
      UI.showToast("Tarefa salva.");
      App.refresh();
    } catch (e) { UI.showToast(e.message); }
  });

  const btnExcluir = document.getElementById("btn-excluir-tarefa");
  if (btnExcluir) {
    btnExcluir.addEventListener("click", async () => {
      if (!UI.confirmar("Excluir esta tarefa?")) return;
      try {
        await Api.excluirTarefa(tarefa.id);
        UI.closeModal();
        UI.showToast("Tarefa excluída.");
        App.refresh();
      } catch (e) { UI.showToast(e.message); }
    });
  }
}
