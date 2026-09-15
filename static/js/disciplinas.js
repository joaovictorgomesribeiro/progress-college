/* Meu Sistema de Estudos - Disciplinas (lista, detalhe, CRUD) */

const STATUS_DISC_LABEL = { concluida: "Concluída", andamento: "Em andamento", planejada: "Planejada", bloqueada: "Bloqueada" };
const STATUS_DISC_BADGE = { concluida: "badge-success", andamento: "badge-info", planejada: "badge-warning", bloqueada: "badge-danger" };
let disciplinasViewMode = "cards";

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
  const disciplinas = await Api.listarDisciplinas();

  container.innerHTML = `
    <div class="section-title">
      <h1>Matérias</h1>
      <div class="view-toggle">
        <button data-mode="cards" class="${disciplinasViewMode === "cards" ? "active" : ""}">▦ Cards</button>
        <button data-mode="table" class="${disciplinasViewMode === "table" ? "active" : ""}">☷ Tabela</button>
      </div>
    </div>
    <button class="btn btn-primary btn-block" id="btn-nova-disciplina" style="margin-bottom:16px;">+ Nova matéria</button>

    ${disciplinas.length ? "" : emptyState("📚", "Nenhuma matéria cadastrada ainda.")}

    <div id="disc-cards" class="cards-grid" ${disciplinasViewMode === "cards" ? "" : "hidden"}>
      ${disciplinas.map(disciplinaCardHtml).join("")}
    </div>

    <div id="disc-table" class="scroll-x" ${disciplinasViewMode === "table" ? "" : "hidden"}>
      <table class="data-table">
        <thead><tr><th>Nome</th><th>Período</th><th>Status</th><th>Média</th><th>Frequência</th><th></th></tr></thead>
        <tbody>
          ${disciplinas.map((d) => `
            <tr>
              <td>${d.nome}</td>
              <td>${d.periodo}º</td>
              <td><span class="badge ${STATUS_DISC_BADGE[d.status] || ""}">${STATUS_DISC_LABEL[d.status] || d.status}</span></td>
              <td>${d.media != null ? d.media.toFixed(1) : "—"}</td>
              <td>${d.frequencia != null ? d.frequencia + "%" : "—"}</td>
              <td><button class="btn btn-sm" data-ver="${d.id}">Ver →</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      disciplinasViewMode = btn.dataset.mode;
      renderDisciplinasLista(container);
    });
  });
  container.querySelectorAll("[data-ver]").forEach((btn) => {
    btn.addEventListener("click", () => { location.hash = `#/disciplinas/${btn.dataset.ver}`; });
  });
  container.querySelectorAll(".disciplina-card").forEach((card) => {
    card.addEventListener("click", () => { location.hash = `#/disciplinas/${card.dataset.id}`; });
  });
  container.querySelector("#btn-nova-disciplina").addEventListener("click", () => abrirFormDisciplina());
}

function disciplinaCardHtml(d) {
  return `<div class="card disciplina-card" data-id="${d.id}" role="button" tabindex="0">
    <div class="disciplina-top">
      <span class="disciplina-dot" style="background:${d.cor || "#6366f1"}"></span>
      <div>
        <h3>${d.nome}</h3>
        <div class="disciplina-meta">
          <span>${d.periodo}º período</span>
          <span class="badge ${STATUS_DISC_BADGE[d.status] || ""}">${STATUS_DISC_LABEL[d.status] || d.status}</span>
        </div>
      </div>
    </div>
    <div class="disciplina-numeros">
      <div><div class="num-label">Média</div><div class="num-value">${d.media != null ? d.media.toFixed(1) : "—"}</div></div>
      <div><div class="num-label">Frequência</div><div class="num-value">${d.frequencia != null ? d.frequencia + "%" : "—"}</div></div>
    </div>
    <div class="progress-bar"><span style="width:${d.progresso || 0}%"></span></div>
    <div style="text-align:right;"><span class="btn btn-ghost btn-sm">Ver detalhes →</span></div>
  </div>`;
}

function emptyState(emoji, texto) {
  return `<div class="empty-state"><span class="empty-emoji">${emoji}</span>${texto}</div>`;
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
        <div class="field"><label for="f-cor">Cor</label><input id="f-cor" type="color" value="${disciplina?.cor || "#6366f1"}"></div>
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
    <button class="btn btn-ghost" id="btn-voltar">← Matérias</button>
    <div class="section-title">
      <h1>${d.nome}</h1>
      <button class="btn btn-sm" id="btn-editar-disciplina">✏️ Editar</button>
    </div>
    <div class="badge ${STATUS_DISC_BADGE[d.status] || ""}">${STATUS_DISC_LABEL[d.status] || d.status}</div>

    <div class="tabs" style="margin-top:16px;">
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
  const prereqs = (d.pre_requisitos || []).map((p) => `${p.nome} ${p.status === "concluida" ? "✅" : "⏳"}`).join(", ") || "Nenhum";
  container.innerHTML = `
    <div class="card">
      <dl style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin:0;">
        ${infoRow("Código", d.codigo || "—")}
        ${infoRow("Professor", d.professor || "—")}
        ${infoRow("Carga horária", d.carga_horaria ? `${d.carga_horaria}h` : "—")}
        ${infoRow("Créditos", d.creditos ?? "—")}
        ${infoRow("Sala", d.sala || "—")}
        ${infoRow("Horário", horarios)}
        ${infoRow("Média", d.media != null ? d.media.toFixed(1) : "—")}
        ${infoRow("Frequência", d.frequencia != null ? d.frequencia + "%" : "—")}
      </dl>
      <div class="field" style="margin-top:14px;">
        <label>Pré-requisitos</label>
        <p>${prereqs}</p>
      </div>
      ${d.observacoes ? `<div class="field"><label>Observações</label><p>${d.observacoes}</p></div>` : ""}
    </div>
  `;
}

function infoRow(label, value) {
  return `<div><div class="num-label">${label}</div><div style="font-weight:700;">${value}</div></div>`;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ---------- Aba Notas: calculadora "quanto preciso tirar?" ---------- */
async function renderTabNotas(container, d) {
  const avaliacoes = await Api.listarAvaliacoes({ disciplina_id: d.id });
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <h3>Notas lançadas</h3>
      ${avaliacoes.length ? `<table class="data-table"><thead><tr><th>Avaliação</th><th>Peso</th><th>Nota</th></tr></thead>
        <tbody>${avaliacoes.map((a) => `<tr><td>${a.titulo}</td><td>${a.peso}</td><td>${a.nota ?? "—"}</td></tr>`).join("")}</tbody></table>`
        : emptyState("📝", "Nenhuma avaliação com nota lançada ainda.")}
      <p style="margin-top:12px;">Média atual: <strong>${d.media != null ? d.media.toFixed(2) : "—"}</strong></p>
    </div>

    <div class="card">
      <h3>🎯 Quanto preciso tirar?</h3>
      <p class="foco-sub">Informe a média desejada e a nota que falta lançar para calcular o necessário na próxima avaliação pendente.</p>
      <div class="field"><label for="fn-meta">Média desejada</label><input id="fn-meta" type="number" step="0.1" min="0" max="10" value="7"></div>
      <div class="field"><label for="fn-peso-restante">Peso da(s) avaliação(ões) que faltam</label><input id="fn-peso-restante" type="number" step="0.1" value="${somaPesoPendente(avaliacoes) || 1}"></div>
      <button class="btn btn-primary btn-block" id="btn-calcular-nota">Calcular</button>
      <div id="resultado-nota" style="margin-top:14px;"></div>
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
      resultado.innerHTML = `<div class="empty-state">Adicione um peso válido para a(s) avaliação(ões) restante(s).</div>`;
      return;
    }
    const necessario = (metaDesejada * pesoTotal - somaLancada) / pesoRestante;
    const atingivel = necessario <= 10;
    resultado.innerHTML = `<div class="notas-result">
      <div class="foco-sub">Para terminar com ${metaDesejada.toFixed(1)}, você precisa tirar:</div>
      <div class="notas-big" style="color:${atingivel ? "var(--success)" : "var(--danger)"}">${necessario.toFixed(1)}</div>
      ${!atingivel ? `<div class="foco-sub">Não é matematicamente possível com o peso informado.</div>` : ""}
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
    <button class="btn btn-primary btn-block" id="btn-novo-conteudo" style="margin-bottom:14px;">+ Novo conteúdo</button>
    ${conteudos.length ? `<div class="card" style="padding:4px 16px;">
      ${conteudos.map((c) => `
        <div class="agenda-item" style="align-items:center;">
          <input type="checkbox" data-conteudo="${c.id}" ${c.status === "concluido" ? "checked" : ""} style="width:22px;height:22px;">
          <div style="flex:1;">
            <div style="font-weight:600; ${c.status === "concluido" ? "text-decoration:line-through; color:var(--text-muted);" : ""}">${c.titulo}</div>
            <div class="foco-sub">${STATUS_CONTEUDO_LABEL[c.status]}</div>
          </div>
          <button class="btn btn-sm" data-editar-conteudo="${c.id}">✏️</button>
        </div>`).join("")}
    </div>` : emptyState("📖", "Nenhum conteúdo cadastrado.")}
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
    <button class="btn btn-primary btn-block" id="btn-nova-aval-disc" style="margin-bottom:14px;">+ Nova avaliação</button>
    <div class="cards-grid">${avaliacoes.length ? avaliacoes.map((a) => avaliacaoCardHtml(a)).join("") : emptyState("📝", "Nenhuma avaliação cadastrada.")}</div>
  `;
  container.querySelector("#btn-nova-aval-disc").addEventListener("click", () => abrirFormAvaliacao(null, d.id));
  container.querySelectorAll(".aval-card").forEach((card) => card.addEventListener("click", () => {
    const a = avaliacoes.find((x) => String(x.id) === card.dataset.id);
    abrirFormAvaliacao(a);
  }));
}

/* ---------- Aba Tarefas da disciplina ---------- */
async function renderTabTarefasDisciplina(container, d) {
  const tarefas = await Api.listarTarefas({ disciplina_id: d.id });
  container.innerHTML = `
    <button class="btn btn-primary btn-block" id="btn-nova-tarefa-disc" style="margin-bottom:14px;">+ Nova tarefa</button>
    <div class="cards-grid">${tarefas.length ? tarefas.map((t) => tarefaCardHtml(t)).join("") : emptyState("✅", "Nenhuma tarefa cadastrada.")}</div>
  `;
  container.querySelector("#btn-nova-tarefa-disc").addEventListener("click", () => abrirFormTarefa(null, d.id));
  container.querySelectorAll(".tarefa-card").forEach((card) => card.addEventListener("click", () => {
    const t = tarefas.find((x) => String(x.id) === card.dataset.id);
    abrirFormTarefa(t);
  }));
}

/* ---------- Aba Estudos da disciplina ---------- */
async function renderTabEstudosDisciplina(container, d) {
  const sessoes = await Api.listarEstudos({ disciplina_id: d.id });
  const totalMin = sessoes.reduce((s, x) => s + x.duracao_min, 0);
  container.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <div class="num-label">Total estudado nesta matéria</div>
      <div class="num-value" style="font-size:24px;">${(totalMin / 60).toFixed(1)}h</div>
    </div>
    <button class="btn btn-primary btn-block" id="btn-novo-estudo-disc" style="margin-bottom:14px;">+ Registrar sessão de estudo</button>
    ${sessoes.length ? `<div class="card" style="padding:4px 16px;">
      ${sessoes.map((s) => `
        <div class="agenda-item">
          <div class="agenda-time">${formatarData(s.data)}</div>
          <div style="flex:1;">
            <div style="font-weight:600;">${s.tipo}</div>
            <div class="foco-sub">${s.duracao_min} min ${s.observacoes ? "· " + s.observacoes : ""}</div>
          </div>
        </div>`).join("")}
    </div>` : emptyState("🎯", "Nenhuma sessão de estudo registrada.")}
  `;
  container.querySelector("#btn-novo-estudo-disc").addEventListener("click", () => abrirFormEstudo(d.id));
}
