/* Meu Sistema de Estudos - Plano de estudos, sessões e metas */

const TIPO_SESSAO_LABEL = { estudo: "Estudo", revisao: "Revisão", exercicios: "Exercícios", pomodoro: "Pomodoro" };
const TIPO_META_LABEL = { horas: "Horas", exercicios: "Exercícios", conteudos: "Conteúdos", disciplina: "Disciplina" };

registerPage("estudos", {
  async render(container) {
    const [sessoes, metas] = await Promise.all([Api.listarEstudos(), Api.listarMetas()]);
    const metaSemanal = metas.find((m) => m.tipo === "horas" && m.status === "ativa" && !m.disciplina_id) || null;
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const isoInicioSemana = inicioSemana.toISOString().slice(0, 10);
    const minutosSemana = sessoes.filter((s) => s.data >= isoInicioSemana).reduce((s, x) => s + x.duracao_min, 0);
    const horasSemana = minutosSemana / 60;
    const metaHoras = metaSemanal ? metaSemanal.alvo : 10;
    const pct = Math.min(100, Math.round((horasSemana / metaHoras) * 100));

    container.innerHTML = `
      <div class="page-header"><h1>Plano de estudos</h1></div>

      <div class="panel" style="margin-bottom:var(--space-6);">
        <div class="list-row-sub" style="margin-bottom:var(--space-2);">Meta da semana</div>
        <div class="progress-bar" style="margin-bottom:var(--space-2);"><span style="width:${pct}%"></span></div>
        <div class="field-hint" style="margin:0;">${horasSemana.toFixed(1)}h de ${metaHoras}h</div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Metas</h2><button class="btn btn-sm" id="btn-nova-meta">${icon("plus")} Nova meta</button></div>
        <div class="list">
          ${metas.length ? metas.map(metaRowHtml).join("") : `<p class="empty-state">Nenhuma meta cadastrada.</p>`}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Sessões recentes</h2><button class="btn btn-sm" id="btn-nova-sessao">${icon("plus")} Registrar</button></div>
        <div class="list">
          ${sessoes.length ? sessoes.slice(0, 20).map((s) => `
            <div class="list-row" style="cursor:default;">
              <div class="list-row-main">
                <div class="list-row-title">${s.disciplina_nome || "Estudo geral"}</div>
                <div class="list-row-sub">${TIPO_SESSAO_LABEL[s.tipo] || s.tipo}${s.observacoes ? " · " + s.observacoes : ""}</div>
              </div>
              <div class="list-row-meta">${formatarData(s.data)} · ${s.duracao_min} min</div>
              <button class="icon-btn" data-excluir-estudo="${s.id}" aria-label="Excluir sessão">${icon("trash")}</button>
            </div>`).join("") : `<p class="empty-state">Nenhuma sessão registrada ainda.</p>`}
        </div>
      </div>
    `;

    container.querySelector("#btn-nova-sessao").addEventListener("click", () => abrirFormEstudo());
    container.querySelector("#btn-nova-meta").addEventListener("click", () => abrirFormMeta());
    container.querySelectorAll("[data-excluir-estudo]").forEach((btn) => btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!UI.confirmar("Excluir esta sessão de estudo?")) return;
      await Api.excluirEstudo(btn.dataset.excluirEstudo);
      App.refresh();
    }));
    container.querySelectorAll(".list-row[data-id]").forEach((row) => row.addEventListener("click", () => {
      const m = metas.find((x) => String(x.id) === row.dataset.id);
      abrirFormMeta(m);
    }));
  },
});

function metaRowHtml(m) {
  const pct = m.alvo ? Math.min(100, Math.round((m.atual / m.alvo) * 100)) : 0;
  return `<div class="list-row" data-id="${m.id}">
    <div class="list-row-main">
      <div class="list-row-title">${m.titulo}</div>
      <div class="list-row-sub">${m.disciplina_nome || "Geral"} · ${TIPO_META_LABEL[m.tipo]}</div>
      <div class="progress-bar" style="margin-top:6px; max-width:220px;"><span style="width:${pct}%"></span></div>
    </div>
    <div class="list-row-meta">
      <span class="badge ${m.status === "concluida" ? "badge-success" : "badge-info"}">${m.status === "concluida" ? "Concluída" : "Ativa"}</span>
      <span>${m.atual} / ${m.alvo} ${m.unidade || ""}</span>
    </div>
  </div>`;
}

async function abrirFormEstudo(disciplinaIdFixo = null) {
  const disciplinas = await Api.listarDisciplinas();
  UI.openModal({
    title: "Registrar sessão de estudo",
    bodyHtml: `
      <form id="form-estudo">
        <div class="field"><label for="fe-disciplina">Matéria</label>
          <select id="fe-disciplina" ${disciplinaIdFixo ? "disabled" : ""}>
            <option value="">Estudo geral</option>
            ${disciplinas.map((d) => `<option value="${d.id}" ${String(disciplinaIdFixo) === String(d.id) ? "selected" : ""}>${d.nome}</option>`).join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label for="fe-data">Data</label><input id="fe-data" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label for="fe-duracao">Duração (min) *</label><input id="fe-duracao" type="number" min="1" value="60"></div>
        </div>
        <div class="field"><label for="fe-tipo">Tipo</label>
          <select id="fe-tipo">${Object.entries(TIPO_SESSAO_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        </div>
        <div class="field"><label for="fe-obs">Observações</label><textarea id="fe-obs"></textarea></div>
      </form>
    `,
    actionsHtml: `<button class="btn btn-primary" id="btn-salvar-estudo">Salvar</button>`,
  });

  document.getElementById("btn-salvar-estudo").addEventListener("click", async () => {
    const dados = {
      disciplina_id: document.getElementById("fe-disciplina").value || null,
      data: document.getElementById("fe-data").value,
      duracao_min: document.getElementById("fe-duracao").value,
      tipo: document.getElementById("fe-tipo").value,
      observacoes: document.getElementById("fe-obs").value.trim(),
    };
    if (!dados.duracao_min || dados.duracao_min <= 0) { UI.showToast("Informe uma duração válida."); return; }
    try {
      await Api.criarEstudo(dados);
      UI.closeModal();
      UI.showToast("Sessão registrada.");
      App.refresh();
    } catch (e) { UI.showToast(e.message); }
  });
}

async function abrirFormMeta(meta = null) {
  const disciplinas = await Api.listarDisciplinas();
  UI.openModal({
    title: meta ? "Editar meta" : "Nova meta",
    bodyHtml: `
      <form id="form-meta">
        <div class="field"><label for="fm-titulo">Título *</label><input id="fm-titulo" required value="${meta?.titulo || ""}"></div>
        <div class="field-row">
          <div class="field"><label for="fm-tipo">Tipo</label>
            <select id="fm-tipo">${Object.entries(TIPO_META_LABEL).map(([v, l]) => `<option value="${v}" ${(meta?.tipo || "horas") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="fm-unidade">Unidade</label><input id="fm-unidade" placeholder="horas, exercícios..." value="${meta?.unidade || ""}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="fm-alvo">Alvo *</label><input id="fm-alvo" type="number" step="0.5" value="${meta?.alvo ?? 10}"></div>
          <div class="field"><label for="fm-atual">Atual</label><input id="fm-atual" type="number" step="0.5" value="${meta?.atual ?? 0}"></div>
        </div>
        <div class="field"><label for="fm-disciplina">Matéria (opcional)</label>
          <select id="fm-disciplina"><option value="">Geral</option>${disciplinas.map((d) => `<option value="${d.id}" ${meta?.disciplina_id === d.id ? "selected" : ""}>${d.nome}</option>`).join("")}</select>
        </div>
        <div class="field-row">
          <div class="field"><label for="fm-inicio">Início</label><input id="fm-inicio" type="date" value="${meta?.data_inicio || ""}"></div>
          <div class="field"><label for="fm-fim">Fim</label><input id="fm-fim" type="date" value="${meta?.data_fim || ""}"></div>
        </div>
      </form>
    `,
    actionsHtml: `
      ${meta ? `<button class="btn btn-danger" id="btn-excluir-meta">Excluir</button>` : ""}
      <button class="btn btn-primary" id="btn-salvar-meta">Salvar</button>
    `,
  });

  document.getElementById("btn-salvar-meta").addEventListener("click", async () => {
    const dados = {
      titulo: document.getElementById("fm-titulo").value.trim(),
      tipo: document.getElementById("fm-tipo").value,
      unidade: document.getElementById("fm-unidade").value.trim(),
      alvo: document.getElementById("fm-alvo").value,
      atual: document.getElementById("fm-atual").value,
      disciplina_id: document.getElementById("fm-disciplina").value || null,
      data_inicio: document.getElementById("fm-inicio").value,
      data_fim: document.getElementById("fm-fim").value,
      status: meta?.status || "ativa",
    };
    if (!dados.titulo) { UI.showToast("Informe o título da meta."); return; }
    try {
      if (meta) await Api.atualizarMeta(meta.id, dados);
      else await Api.criarMeta(dados);
      UI.closeModal();
      UI.showToast("Meta salva.");
      App.refresh();
    } catch (e) { UI.showToast(e.message); }
  });

  const btnExcluir = document.getElementById("btn-excluir-meta");
  if (btnExcluir) {
    btnExcluir.addEventListener("click", async () => {
      if (!UI.confirmar("Excluir esta meta?")) return;
      await Api.excluirMeta(meta.id);
      UI.closeModal();
      App.refresh();
    });
  }
}
